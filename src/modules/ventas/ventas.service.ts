import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { DomainResourceService } from '../../common/utils/domain-resource.service.js';
import type {
  CreateNotaVentaDto,
  CreatePagoDto,
  UpdateNotaVentaDto,
  UpdatePagoDto,
} from './dto/ventas.dto.js';
import { Servicio } from '../catalogo/entities/servicio.entity.js';
import { Paquete } from '../comercial/entities/comercial.entities.js';
import { Producto } from '../inventario/entities/inventario.entities.js';
import {
  EstadoNotaVenta,
  EstadoPago,
} from '../../common/enums/domain.enums.js';
import {
  DetalleNotaVenta,
  NotaVenta,
  Pago,
} from './entities/ventas.entities.js';
@Injectable()
export class VentasService {
  private notas: DomainResourceService<NotaVenta>;
  private pagos: DomainResourceService<Pago>;
  constructor(@Inject(DataSource) private db: DataSource) {
    this.notas = new DomainResourceService(
      NotaVenta,
      'id_nota_venta',
      db.getRepository(NotaVenta),
      'Nota de venta',
    );
    this.pagos = new DomainResourceService(
      Pago,
      'id_pago',
      db.getRepository(Pago),
      'Pago',
    );
  }
  async createNota(d: CreateNotaVentaDto, actor: number) {
    return this.db.transaction(async (m) => {
      const { detalles, ...head } = d;
      if (!detalles.length)
        throw new BadRequestException(
          'La nota de venta debe contener al menos un detalle',
        );
      const prepared = await Promise.all(
        detalles.map((detail) => this.prepareDetail(m, detail)),
      );
      const subtotal = this.money(
        prepared.reduce((sum, detail) => sum + Number(detail.subtotal), 0),
      );
      const discount = this.money(Number(head.descuento ?? 0));
      const total = this.money(Number(subtotal) - Number(discount));
      if (Number(total) < 0)
        throw new BadRequestException(
          'El descuento no puede superar el subtotal',
        );
      const origin = await this.validateOrigin(
        m,
        head.id_adquisicion,
        head.id_paciente,
      );
      if (origin?.total !== undefined && Number(origin.total) !== Number(total))
        throw new BadRequestException(
          'El total de la nota no coincide con la adquisicion',
        );
      const nota = await this.notas.create(
        {
          ...head,
          id_paciente: head.id_paciente ?? origin?.id_paciente,
          subtotal,
          descuento: discount,
          total,
          fecha_emision: new Date(head.fecha_emision),
          emitido_por: actor,
          estado: EstadoNotaVenta.EMITIDA,
        },
        m,
      );
      const r = m.getRepository(DetalleNotaVenta);
      const savedDetails = await r.save(
        prepared.map((detail) =>
          r.create({ ...detail, id_nota_venta: nota.id_nota_venta }),
        ),
      );
      return Object.assign({}, nota, { detalles: savedDetails });
    });
  }
  async listNotas(q: DomainQueryDto) {
    const { where, values, parameter } = this.saleFilters(q, 'n', [
      'n.numero_nota',
      "COALESCE(pe.nombre || ' ' || pe.ap_paterno || ' ' || pe.ap_materno, '')",
      "COALESCE(n.observaciones, '')",
    ]);
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [count] = (await this.db.manager.query(
      `SELECT COUNT(*)::int AS total FROM notas_venta n LEFT JOIN pacientes pa ON pa.id_paciente = n.id_paciente LEFT JOIN personas pe ON pe.id_persona = pa.id_persona ${sqlWhere}`,
      values,
    )) as Array<{ total: number }>;
    const limit = parameter(q.limit);
    const offset = parameter((q.page - 1) * q.limit);
    const data = await this.db.manager.query(
      `SELECT n.*, COALESCE(pe.nombre || ' ' || pe.ap_paterno || ' ' || pe.ap_materno, 'Venta general') AS paciente,
              em.nombre || ' ' || em.ap_paterno AS emitido_por_nombre,
              (SELECT COUNT(*)::int FROM detalles_nota_venta d WHERE d.id_nota_venta = n.id_nota_venta) AS detalles,
              COALESCE((SELECT SUM(pg.monto) FROM pagos pg WHERE pg.id_nota_venta = n.id_nota_venta AND pg.estado = 'REGISTRADO'), 0)::numeric(10,2) AS pagado,
              (n.total - COALESCE((SELECT SUM(pg.monto) FROM pagos pg WHERE pg.id_nota_venta = n.id_nota_venta AND pg.estado = 'REGISTRADO'), 0))::numeric(10,2) AS saldo
       FROM notas_venta n
       LEFT JOIN pacientes pa ON pa.id_paciente = n.id_paciente
       LEFT JOIN personas pe ON pe.id_persona = pa.id_persona
       JOIN usuarios u ON u.id_usuario = n.emitido_por
       JOIN personas em ON em.id_persona = u.id_persona
       ${sqlWhere}
       ORDER BY n.fecha_emision DESC, n.id_nota_venta DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return { data, total: Number(count?.total ?? 0), page: q.page, limit: q.limit };
  }
  oneNota(id: number) {
    return this.notas.one(id);
  }
  async updateNota(id: number, d: UpdateNotaVentaDto) {
    const current = await this.notas.one(id);
    if (d.estado && d.estado !== EstadoNotaVenta.ANULADA)
      throw new BadRequestException(
        'Una nota emitida solamente puede cambiar a ANULADA',
      );
    if (current.estado === EstadoNotaVenta.ANULADA)
      throw new BadRequestException('La nota de venta ya esta anulada');
    return this.notas.update(id, d);
  }
  async detalles(id: number) {
    await this.notas.one(id);
    return this.db
      .getRepository(DetalleNotaVenta)
      .find({ where: { id_nota_venta: id }, order: { id_detalle: 'ASC' } });
  }
  createPago(d: CreatePagoDto, actor: number) {
    return this.db.transaction(async (manager) => {
      const note = await manager.getRepository(NotaVenta).findOne({
        where: { id_nota_venta: d.id_nota_venta },
        lock: { mode: 'pessimistic_write' },
      });
      if (!note || note.estado !== EstadoNotaVenta.EMITIDA)
        throw new BadRequestException(
          'La nota no existe o no se encuentra emitida',
        );
      const registered = await manager.getRepository(Pago).find({
        where: {
          id_nota_venta: d.id_nota_venta,
          estado: EstadoPago.REGISTRADO,
        },
      });
      const paid = registered.reduce(
        (sum, payment) => sum + Number(payment.monto),
        0,
      );
      if (paid + Number(d.monto) > Number(note.total))
        throw new BadRequestException(
          `El pago supera el saldo pendiente de ${this.money(Number(note.total) - paid)}`,
        );
      return this.pagos.create(
        Object.assign({}, d, {
          fecha_pago: new Date(d.fecha_pago),
          registrado_por: actor,
          estado: EstadoPago.REGISTRADO,
        }),
        manager,
      );
    });
  }
  async listPagos(q: DomainQueryDto) {
    const { where, values, parameter } = this.saleFilters(q, 'p', [
      'n.numero_nota',
      "COALESCE(pe.nombre || ' ' || pe.ap_paterno || ' ' || pe.ap_materno, '')",
      "COALESCE(p.observaciones, '')",
    ]);
    if (q.tipo) where.push(`p.metodo_pago::text = ${parameter(q.tipo.toUpperCase())}`);
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [count] = (await this.db.manager.query(
      `SELECT COUNT(*)::int AS total FROM pagos p JOIN notas_venta n ON n.id_nota_venta = p.id_nota_venta LEFT JOIN pacientes pa ON pa.id_paciente = n.id_paciente LEFT JOIN personas pe ON pe.id_persona = pa.id_persona ${sqlWhere}`,
      values,
    )) as Array<{ total: number }>;
    const limit = parameter(q.limit);
    const offset = parameter((q.page - 1) * q.limit);
    const data = await this.db.manager.query(
      `SELECT p.*, n.numero_nota, n.total AS total_nota,
              COALESCE(pe.nombre || ' ' || pe.ap_paterno || ' ' || pe.ap_materno, 'Venta general') AS paciente,
              rp.nombre || ' ' || rp.ap_paterno AS registrado_por_nombre
       FROM pagos p
       JOIN notas_venta n ON n.id_nota_venta = p.id_nota_venta
       LEFT JOIN pacientes pa ON pa.id_paciente = n.id_paciente
       LEFT JOIN personas pe ON pe.id_persona = pa.id_persona
       JOIN usuarios u ON u.id_usuario = p.registrado_por
       JOIN personas rp ON rp.id_persona = u.id_persona
       ${sqlWhere}
       ORDER BY p.fecha_pago DESC, p.id_pago DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return { data, total: Number(count?.total ?? 0), page: q.page, limit: q.limit };
  }
  onePago(id: number) {
    return this.pagos.one(id);
  }
  async updatePago(id: number, d: UpdatePagoDto) {
    const current = await this.pagos.one(id);
    if (d.estado && d.estado !== EstadoPago.ANULADO)
      throw new BadRequestException(
        'Un pago registrado solamente puede cambiar a ANULADO',
      );
    if (current.estado === EstadoPago.ANULADO)
      throw new BadRequestException('El pago ya esta anulado');
    return this.pagos.update(id, d);
  }
  async options() {
    const [patients, acquisitions, services, products, packages, notes] =
      await Promise.all([
        this.db.manager.query(`SELECT pa.id_paciente, pe.nombre, pe.ap_paterno, pe.ap_materno, pe.ci FROM pacientes pa JOIN personas pe ON pe.id_persona = pa.id_persona WHERE pa.estado = 'ACTIVO' ORDER BY pe.ap_paterno, pe.nombre`),
        this.db.manager.query(`SELECT a.id_adquisicion, a.id_paciente, a.total, a.fecha_adquisicion, COALESCE(pq.nombre, pr.nombre, 'Adquisición') AS concepto FROM adquisiciones a LEFT JOIN paquetes pq ON pq.id_paquete = a.id_paquete LEFT JOIN promociones pr ON pr.id_promocion = a.id_promocion LEFT JOIN notas_venta n ON n.id_adquisicion = a.id_adquisicion WHERE a.estado <> 'CANCELADA' AND n.id_nota_venta IS NULL ORDER BY a.fecha_adquisicion DESC`),
        this.db.manager.query(`SELECT s.id_servicio AS id, s.nombre, 'SERVICIO' AS tipo FROM servicios s JOIN categorias_servicio c ON c.id_categoria = s.id_categoria JOIN areas a ON a.id_area = c.id_area WHERE s.estado = 'ACTIVO' AND c.estado = 'ACTIVO' AND a.estado = 'ACTIVO' ORDER BY s.nombre`),
        this.db.manager.query(`SELECT id_producto AS id, nombre, 'PRODUCTO' AS tipo, unidad_medida FROM productos WHERE estado = 'ACTIVO' AND es_vendible = true ORDER BY nombre`),
        this.db.manager.query(`SELECT id_paquete AS id, nombre, 'PAQUETE' AS tipo, precio FROM paquetes WHERE estado = 'ACTIVO' ORDER BY nombre`),
        this.db.manager.query(`SELECT n.id_nota_venta, n.numero_nota, n.total, COALESCE(pe.nombre || ' ' || pe.ap_paterno, 'Venta general') AS paciente, (n.total - COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'REGISTRADO'), 0))::numeric(10,2) AS saldo FROM notas_venta n LEFT JOIN pacientes pa ON pa.id_paciente = n.id_paciente LEFT JOIN personas pe ON pe.id_persona = pa.id_persona LEFT JOIN pagos p ON p.id_nota_venta = n.id_nota_venta WHERE n.estado = 'EMITIDA' GROUP BY n.id_nota_venta, pe.id_persona HAVING n.total - COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'REGISTRADO'), 0) > 0 ORDER BY n.fecha_emision DESC`),
      ]);
    return { patients, acquisitions, items: [...services, ...products, ...packages], notes };
  }
  private saleFilters(q: DomainQueryDto, alias: string, search: string[]) {
    const where: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => { values.push(value); return `$${values.length}`; };
    if (q.estado) where.push(`${alias}.estado::text = ${parameter(q.estado.toUpperCase())}`);
    if (q.id_paciente) where.push(`n.id_paciente = ${parameter(q.id_paciente)}`);
    const dateColumn = alias === 'n' ? 'n.fecha_emision' : 'p.fecha_pago';
    if (q.desde) where.push(`${dateColumn} >= ${parameter(q.desde)}`);
    if (q.hasta) where.push(`${dateColumn} <= ${parameter(q.hasta)}`);
    if (q.search) { const value = parameter(`%${q.search}%`); where.push(`(${search.map((column) => `${column} ILIKE ${value}`).join(' OR ')})`); }
    return { where, values, parameter };
  }
  private validateItem(d: {
    id_servicio?: number;
    id_producto?: number;
    id_paquete?: number;
  }) {
    if (
      [d.id_servicio, d.id_producto, d.id_paquete].filter(Boolean).length !== 1
    )
      throw new BadRequestException(
        'Cada detalle debe referenciar exactamente un servicio, producto o paquete',
      );
  }
  private async prepareDetail(
    manager: EntityManager,
    detail: CreateNotaVentaDto['detalles'][number],
  ) {
    this.validateItem(detail);
    let description: string;
    let unit: string | null = null;
    if (detail.id_servicio) {
      const row = await manager
        .getRepository(Servicio)
        .findOneBy({ id_servicio: detail.id_servicio });
      if (!row) throw new BadRequestException('Servicio no encontrado');
      const active = (await manager.query(
        `SELECT 1 FROM servicios s
         JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
         JOIN areas a ON a.id_area = c.id_area
         WHERE s.id_servicio = $1 AND s.estado = 'ACTIVO'
           AND c.estado = 'ACTIVO' AND a.estado = 'ACTIVO'`,
        [detail.id_servicio],
      )) as unknown[];
      if (!active.length)
        throw new BadRequestException('El servicio no esta activo');
      description = row.nombre;
    } else if (detail.id_producto) {
      const row = await manager
        .getRepository(Producto)
        .findOneBy({ id_producto: detail.id_producto });
      if (!row) throw new BadRequestException('Producto no encontrado');
      if (!row.es_vendible || row.estado !== 'ACTIVO')
        throw new BadRequestException(
          'El producto no esta habilitado para venta',
        );
      description = row.nombre;
      unit = row.unidad_medida;
    } else {
      const row = await manager
        .getRepository(Paquete)
        .findOneBy({ id_paquete: detail.id_paquete! });
      if (!row) throw new BadRequestException('Paquete no encontrado');
      if (row.estado !== 'ACTIVO')
        throw new BadRequestException('El paquete no esta activo');
      description = row.nombre;
    }
    const gross = Number(detail.cantidad) * Number(detail.precio_unitario);
    const discount = Number(detail.descuento ?? 0);
    if (discount > gross)
      throw new BadRequestException(
        `El descuento del detalle ${description} supera su importe`,
      );
    return {
      id_servicio: detail.id_servicio,
      id_producto: detail.id_producto,
      id_paquete: detail.id_paquete,
      descripcion_snapshot: description,
      unidad_snapshot: unit,
      cantidad: detail.cantidad,
      precio_unitario: this.money(Number(detail.precio_unitario)),
      descuento: this.money(discount),
      subtotal: this.money(gross - discount),
    };
  }
  private async validateOrigin(
    manager: EntityManager,
    acquisitionId?: number,
    patientId?: number,
  ) {
    if (!acquisitionId) {
      if (patientId) {
        const rows = (await manager.query(
          `SELECT 1 FROM pacientes WHERE id_paciente = $1 AND estado = 'ACTIVO'`,
          [patientId],
        )) as unknown[];
        if (!rows.length)
          throw new BadRequestException('El paciente no esta activo');
      }
      return undefined;
    }
    const rows = (await manager.query(
      `SELECT id_paciente, total FROM adquisiciones
       WHERE id_adquisicion = $1 AND estado <> 'CANCELADA'`,
      [acquisitionId],
    )) as Array<{ id_paciente: number; total: string }>;
    if (!rows.length)
      throw new BadRequestException(
        'La adquisicion no existe o esta cancelada',
      );
    if (patientId && rows[0].id_paciente !== patientId)
      throw new BadRequestException(
        'La adquisicion no corresponde al paciente indicado',
      );
    return rows[0];
  }
  private money(value: number) {
    return value.toFixed(2);
  }
}
