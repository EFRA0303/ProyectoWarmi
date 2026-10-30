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
import { Producto } from '../inventario/entities/inventario.entities.js';
import { Adquisicion } from '../comercial/entities/comercial.entities.js';
import { units, decimal, multiply } from '../../common/utils/decimal.js';
import { operationKey } from '../../common/utils/operation-key.js';
import { issueAcquisitionNote, noteIdentity } from './acquisition-note.js';
import { cancelAcquisition, completeAcquisition } from './commercial-cancellation.js';
import { deliverSaleProducts } from '../inventario/inventory-ledger.js';
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
      const operation = await operationKey(m, 'notas_venta', d.clave_operacion, actor, d);
      if (operation.existingId) return m.getRepository(NotaVenta).findOneByOrFail({ id_nota_venta: operation.existingId });
      const { detalles, ...head } = d;
      if (!Number.isFinite(new Date(head.fecha_emision).getTime()) || new Date(head.fecha_emision).getTime() > Date.now() + 300000) throw new BadRequestException('La fecha de emisión no es válida o está en el futuro');
      if (head.id_adquisicion) {
        if (detalles.length) throw new BadRequestException('La nota de una adquisición usa sus importes congelados; no agregues conceptos manuales');
        await this.validateOrigin(m, head.id_adquisicion, head.id_paciente);
        return issueAcquisitionNote(m, head.id_adquisicion, actor);
      }
      if (!detalles.length)
        throw new BadRequestException(
          'La nota de venta debe contener al menos un detalle',
        );
      if (detalles.some(item => !item.id_producto || item.id_servicio || item.id_paquete)) throw new BadRequestException('Registra servicios, paquetes y promociones desde Adquisiciones del paciente. Su nota se genera automáticamente.');
      const prepared = await Promise.all(
        detalles.map((detail) => this.prepareDetail(m, detail)),
      );
      const subtotal = prepared.reduce((sum, detail) => sum + units(detail.subtotal), 0n);
      const discount = units(head.descuento ?? '0', 'Descuento general');
      if (discount > subtotal)
        throw new BadRequestException(
          'El descuento no puede superar el subtotal',
        );
      await this.validateOrigin(m, undefined, head.id_paciente);
      const identity = await noteIdentity(m, head.numero_nota);
      const nota = await this.notas.create(
        {
          ...head,
          ...identity,
          huella_operacion: operation.hash,
          subtotal: decimal(subtotal),
          descuento: decimal(discount),
          total: decimal(subtotal - discount),
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
               (CASE WHEN n.estado='ANULADA' THEN 0 ELSE n.total - COALESCE((SELECT SUM(pg.monto) FROM pagos pg WHERE pg.id_nota_venta = n.id_nota_venta AND pg.estado = 'REGISTRADO'), 0) END)::numeric(10,2) AS saldo,
               (SELECT COUNT(*)::int FROM detalles_nota_venta d WHERE d.id_nota_venta=n.id_nota_venta AND d.id_producto IS NOT NULL AND d.cantidad*d.factor_stock > COALESCE((SELECT SUM(s.cantidad) FROM salidas_producto_venta s WHERE s.id_detalle=d.id_detalle),0)) AS productos_pendientes,
               (SELECT COUNT(*)::int FROM salidas_producto_venta s JOIN detalles_nota_venta d ON d.id_detalle=s.id_detalle WHERE d.id_nota_venta=n.id_nota_venta) AS entregas_registradas
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
  async updateNota(id: number, d: UpdateNotaVentaDto, actor: number) {
    return this.db.transaction(async manager => {
      const current = await this.lockNote(manager, id);
      if (current.estado === EstadoNotaVenta.ANULADA) return current;
      if (d.estado) {
        if (d.estado !== EstadoNotaVenta.ANULADA) throw new BadRequestException('La nota solo puede anularse');
        if (!d.motivo_anulacion || d.motivo_anulacion.trim().length < 5) throw new BadRequestException('Indica un motivo de anulación de al menos cinco caracteres');
        if (current.id_adquisicion) {
          await cancelAcquisition(manager, current.id_adquisicion, actor, d.motivo_anulacion);
          return manager.getRepository(NotaVenta).findOneByOrFail({ id_nota_venta: id });
        }
        if (await manager.getRepository(Pago).existsBy({ id_nota_venta: id, estado: EstadoPago.REGISTRADO })) throw new BadRequestException('La nota tiene pagos registrados. Anular no equivale a devolver dinero.');
        if ((await manager.query(`SELECT 1 FROM salidas_producto_venta s JOIN detalles_nota_venta d ON d.id_detalle=s.id_detalle WHERE d.id_nota_venta=$1 LIMIT 1`, [id])).length) throw new BadRequestException('Hay productos entregados. Registra una devolución controlada antes de anular.');
        current.estado = EstadoNotaVenta.ANULADA;
        current.anulado_por = actor;
        current.motivo_anulacion = d.motivo_anulacion.trim();
      }
      if (d.observaciones !== undefined) current.observaciones = d.observaciones;
      return manager.getRepository(NotaVenta).save(current);
    });
  }

  async deliverProducts(id: number, actor: number) {
    return this.db.transaction(async manager => {
      const note = await this.lockNote(manager, id);
      if (note.estado !== EstadoNotaVenta.EMITIDA) throw new BadRequestException('La nota no está emitida');
      const payments = await manager.getRepository(Pago).findBy({ id_nota_venta: id, estado: EstadoPago.REGISTRADO });
      if (payments.reduce((sum, item) => sum + units(item.monto), 0n) < units(note.total)) throw new BadRequestException('Completa el pago de la nota antes de confirmar la entrega de productos');
      return deliverSaleProducts(manager, id, actor);
    });
  }

  private async lockNote(manager: EntityManager, id: number) {
    const repo = manager.getRepository(NotaVenta);
    const known = await repo.findOneBy({ id_nota_venta: id });
    if (!known) throw new BadRequestException('Nota de venta no encontrada');
    if (known.id_adquisicion) await manager.getRepository(Adquisicion).findOne({ where: { id_adquisicion: known.id_adquisicion }, lock: { mode: 'pessimistic_write' } });
    return repo.findOneOrFail({ where: { id_nota_venta: id }, lock: { mode: 'pessimistic_write' } });
  }
  async detalles(id: number) {
    await this.notas.one(id);
    return this.db
      .getRepository(DetalleNotaVenta)
      .find({ where: { id_nota_venta: id }, order: { id_detalle: 'ASC' } });
  }
  createPago(d: CreatePagoDto, actor: number) {
    return this.db.transaction(async (manager) => {
      const operation = await operationKey(manager, 'pagos', d.clave_operacion, actor, d);
      if (operation.existingId) return manager.getRepository(Pago).findOneByOrFail({ id_pago: operation.existingId });
      const amount = units(d.monto, 'Monto del pago', true);
      if (new Date(d.fecha_pago).getTime() > Date.now() + 300000 || !Number.isFinite(new Date(d.fecha_pago).getTime())) throw new BadRequestException('La fecha del pago no es válida o está en el futuro');
      const note = await this.lockNote(manager, d.id_nota_venta);
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
        (sum, payment) => sum + units(payment.monto),
        0n,
      );
      if (paid + amount > units(note.total))
        throw new BadRequestException(
          `El pago supera el saldo pendiente de ${decimal(units(note.total) - paid)}`,
        );
      const payment = await this.pagos.create(
        Object.assign({}, d, {
          monto: decimal(amount),
          huella_operacion: operation.hash,
          fecha_pago: new Date(d.fecha_pago),
          registrado_por: actor,
          estado: EstadoPago.REGISTRADO,
        }),
        manager,
      );
      if (note.id_adquisicion) await completeAcquisition(manager, note.id_adquisicion);
      return payment;
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
  async updatePago(id: number, d: UpdatePagoDto, actor: number) {
    return this.db.transaction(async manager => {
      const known = await manager.getRepository(Pago).findOneByOrFail({ id_pago: id });
      const note = await this.lockNote(manager, known.id_nota_venta);
      const current = await manager.getRepository(Pago).findOneOrFail({ where: { id_pago: id }, lock: { mode: 'pessimistic_write' } });
      if (current.estado === EstadoPago.ANULADO) return current;
      if (note.estado !== EstadoNotaVenta.EMITIDA) throw new BadRequestException('No se puede modificar un pago de una nota anulada');
      if (d.estado) {
        if (d.estado !== EstadoPago.ANULADO || !d.motivo_anulacion || d.motivo_anulacion.trim().length < 5) throw new BadRequestException('Para anular, indica un motivo de al menos cinco caracteres');
        const outputs = await manager.query(`SELECT 1 FROM salidas_producto_venta s JOIN detalles_nota_venta d ON d.id_detalle=s.id_detalle WHERE d.id_nota_venta=$1 LIMIT 1`, [note.id_nota_venta]) as unknown[];
        const sessions = note.id_adquisicion ? await manager.query(`SELECT 1 FROM detalles_adquisicion d JOIN tratamientos_paciente t ON t.id_detalle_adquisicion=d.id_detalle_adquisicion JOIN sesiones s ON s.id_tratamiento=t.id_tratamiento WHERE d.id_adquisicion=$1 AND s.estado IN ('EN_CURSO','FINALIZADA') LIMIT 1`, [note.id_adquisicion]) as unknown[] : [];
        if (outputs.length || sessions.length) throw new BadRequestException('La venta ya tiene entregas o atención clínica. Requiere un procedimiento de devolución, no anular el pago.');
        current.estado = EstadoPago.ANULADO;
        current.anulado_por = actor;
        current.motivo_anulacion = d.motivo_anulacion.trim();
      }
      if (d.observaciones !== undefined) current.observaciones = d.observaciones;
      return manager.getRepository(Pago).save(current);
    });
  }
  async options() {
    const [patients, acquisitions, products, notes] =
      await Promise.all([
        this.db.manager.query(`SELECT pa.id_paciente, pe.nombre, pe.ap_paterno, pe.ap_materno, pe.ci FROM pacientes pa JOIN personas pe ON pe.id_persona = pa.id_persona WHERE pa.estado = 'ACTIVO' ORDER BY pe.ap_paterno, pe.nombre`),
        this.db.manager.query(`SELECT a.id_adquisicion, a.id_paciente, a.total, a.fecha_adquisicion, COALESCE(pq.nombre, pr.nombre, 'Adquisición') AS concepto FROM adquisiciones a LEFT JOIN paquetes pq ON pq.id_paquete = a.id_paquete LEFT JOIN promociones pr ON pr.id_promocion = a.id_promocion LEFT JOIN notas_venta n ON n.id_adquisicion = a.id_adquisicion WHERE a.estado <> 'CANCELADA' AND n.id_nota_venta IS NULL ORDER BY a.fecha_adquisicion DESC`),
        this.db.manager.query(`SELECT id_producto AS id, nombre, 'PRODUCTO' AS tipo, unidad_medida, presentacion, contenido_presentacion, precio_venta AS precio FROM productos WHERE estado = 'ACTIVO' AND es_vendible = true AND precio_venta IS NOT NULL ORDER BY nombre`),
        this.db.manager.query(`SELECT n.id_nota_venta, n.numero_nota, n.total, COALESCE(pe.nombre || ' ' || pe.ap_paterno, 'Venta general') AS paciente, (n.total - COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'REGISTRADO'), 0))::numeric(10,2) AS saldo FROM notas_venta n LEFT JOIN pacientes pa ON pa.id_paciente = n.id_paciente LEFT JOIN personas pe ON pe.id_persona = pa.id_persona LEFT JOIN pagos p ON p.id_nota_venta = n.id_nota_venta WHERE n.estado = 'EMITIDA' GROUP BY n.id_nota_venta, pe.id_persona HAVING n.total - COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'REGISTRADO'), 0) > 0 ORDER BY n.fecha_emision DESC`),
      ]);
    return { patients, acquisitions, items: products, notes };
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
    if (!detail.id_producto) throw new BadRequestException('Selecciona un producto vendible');
    const row = await manager.getRepository(Producto).findOneBy({ id_producto: detail.id_producto });
    if (!row || !row.es_vendible || row.estado !== 'ACTIVO' || row.precio_venta === null) throw new BadRequestException('El producto no está habilitado para venta o no tiene precio');
    const quantity = units(detail.cantidad, 'Cantidad de presentaciones', true);
    if (quantity % 100n) throw new BadRequestException('La venta de productos se registra en presentaciones completas; el consumo clínico usa la unidad base');
    const price = units(row.precio_venta, 'Precio de catálogo');
    const factor = units(row.contenido_presentacion, 'Contenido por presentación', true);
    const gross = multiply(quantity, price);
    const discount = units(detail.descuento ?? '0', 'Descuento de detalle');
    if (discount > gross)
      throw new BadRequestException(
        `El descuento del detalle ${row.nombre} supera su importe`,
      );
    return {
      id_servicio: detail.id_servicio,
      id_producto: detail.id_producto,
      id_paquete: detail.id_paquete,
      descripcion_snapshot: row.nombre,
      unidad_snapshot: row.presentacion,
      factor_stock: decimal(factor),
      cantidad: decimal(quantity),
      precio_unitario: decimal(price),
      descuento: decimal(discount),
      subtotal: decimal(gross - discount),
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
}
