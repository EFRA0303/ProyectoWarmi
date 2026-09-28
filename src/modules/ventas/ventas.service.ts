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
  listNotas(q: DomainQueryDto) {
    return this.notas.list(q);
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
  listPagos(q: DomainQueryDto) {
    return this.pagos.list(q);
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
