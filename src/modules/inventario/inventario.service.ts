import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { DomainResourceService } from '../../common/utils/domain-resource.service.js';
import {
  EstadoLote,
  TipoMovimientoInventario,
} from '../../common/enums/domain.enums.js';
import type {
  CreateConsumoDto,
  CreateLoteDto,
  CreateMovimientoDto,
  CreateProductoDto,
  CreateSalidaVentaDto,
  UpdateLoteDto,
  UpdateProductoDto,
  VincularServicioProductoDto,
} from './dto/inventario.dto.js';
import {
  ConsumoSesion,
  LoteProducto,
  MovimientoInventario,
  Producto,
  SalidaProductoVenta,
  ServicioProducto,
} from './entities/inventario.entities.js';
@Injectable()
export class InventarioService {
  private productos: DomainResourceService<Producto>;
  private lotes: DomainResourceService<LoteProducto>;
  private movimientos: DomainResourceService<MovimientoInventario>;
  constructor(@Inject(DataSource) private db: DataSource) {
    this.productos = new DomainResourceService(
      Producto,
      'id_producto',
      db.getRepository(Producto),
      'Producto',
    );
    this.lotes = new DomainResourceService(
      LoteProducto,
      'id_lote',
      db.getRepository(LoteProducto),
      'Lote',
    );
    this.movimientos = new DomainResourceService(
      MovimientoInventario,
      'id_movimiento',
      db.getRepository(MovimientoInventario),
      'Movimiento',
    );
  }
  createProducto(d: CreateProductoDto) {
    return this.productos.create(d);
  }
  listProductos(q: DomainQueryDto) {
    return this.productos.list(q);
  }
  oneProducto(id: number) {
    return this.productos.one(id);
  }
  updateProducto(id: number, d: UpdateProductoDto) {
    return this.productos.update(id, d);
  }
  createLote(d: CreateLoteDto, actor: number) {
    this.loteDates(d);
    return this.db.transaction(async (manager) => {
      const lot = await this.lotes.create(d, manager);
      if (Number(d.cantidad_inicial) > 0) {
        await this.movimientos.create(
          {
            id_lote: lot.id_lote,
            tipo: TipoMovimientoInventario.ENTRADA_COMPRA,
            cantidad: d.cantidad_inicial,
            registrado_por: actor,
            fecha_movimiento: new Date(`${d.fecha_ingreso}T12:00:00Z`),
            observaciones: 'Stock inicial del lote',
          },
          manager,
        );
      }
      return lot;
    });
  }
  listLotes(q: DomainQueryDto) {
    return this.lotes.list(q);
  }
  oneLote(id: number) {
    return this.lotes.one(id);
  }
  async updateLote(id: number, d: UpdateLoteDto) {
    const c = await this.lotes.one(id);
    this.loteDates(Object.assign({}, c, d));
    return this.lotes.update(id, d);
  }
  async linkService(id: number, d: VincularServicioProductoDto) {
    const valid = (await this.db.manager.query(
      `SELECT 1 FROM servicios s
       JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
       JOIN areas a ON a.id_area = c.id_area
       JOIN productos p ON p.id_producto = $2
       WHERE s.id_servicio = $1 AND s.estado = 'ACTIVO'
         AND c.estado = 'ACTIVO' AND a.estado = 'ACTIVO'
         AND p.estado = 'ACTIVO'`,
      [id, d.id_producto],
    )) as unknown[];
    if (!valid.length)
      throw new BadRequestException(
        'El servicio o producto no existe o esta inactivo',
      );
    const r = this.db.getRepository(ServicioProducto);
    const c = await r.findOneBy({
      id_servicio: id,
      id_producto: d.id_producto,
    });
    return r.save(r.create(Object.assign({}, c, d, { id_servicio: id })));
  }
  listServiceProducts(id: number) {
    return this.db.getRepository(ServicioProducto).find({
      where: { id_servicio: id },
      relations: { producto: true },
      order: { id_producto: 'ASC' },
    });
  }
  createMovement(d: CreateMovimientoDto, actor: number) {
    if (
      [
        TipoMovimientoInventario.CONSUMO_SESION,
        TipoMovimientoInventario.VENTA,
      ].includes(d.tipo)
    )
      throw new BadRequestException(
        'Los consumos y ventas deben registrarse desde su operacion especifica',
      );
    return this.db.transaction(async (manager) => {
      await this.ensureStock(manager, d.id_lote, d.tipo, d.cantidad);
      const movement = await this.movimientos.create(
        Object.assign({}, d, {
          fecha_movimiento: new Date(d.fecha_movimiento),
          registrado_por: actor,
        }),
        manager,
      );
      await this.syncLotState(manager, d.id_lote);
      return movement;
    });
  }
  listMovements(q: DomainQueryDto) {
    return this.movimientos.list(q);
  }
  oneMovement(id: number) {
    return this.movimientos.one(id);
  }
  createConsumption(d: CreateConsumoDto, actor: number) {
    return this.db.transaction(async (m) => {
      await this.ensureStock(
        m,
        d.id_lote,
        TipoMovimientoInventario.CONSUMO_SESION,
        d.cantidad,
      );
      await this.ensureConsumptionCompatibility(m, d.id_sesion, d.id_lote);
      if (
        await m.getRepository(ConsumoSesion).existsBy({
          id_sesion: d.id_sesion,
          id_lote: d.id_lote,
        })
      )
        throw new BadRequestException(
          'El consumo de este lote ya fue registrado para la sesion',
        );
      const movement = await this.movimientos.create(
        {
          id_lote: d.id_lote,
          tipo: TipoMovimientoInventario.CONSUMO_SESION,
          cantidad: d.cantidad,
          registrado_por: actor,
          fecha_movimiento: new Date(),
          observaciones: d.observaciones,
        },
        m,
      );
      const r = m.getRepository(ConsumoSesion);
      const consumption = await r.save(
        r.create({
          id_sesion: d.id_sesion,
          id_lote: d.id_lote,
          id_movimiento: movement.id_movimiento,
          cantidad: d.cantidad,
        }),
      );
      await this.syncLotState(m, d.id_lote);
      return consumption;
    });
  }
  listConsumptions(q: DomainQueryDto) {
    const r = new DomainResourceService(
      ConsumoSesion,
      'id_consumo',
      this.db.getRepository(ConsumoSesion),
      'Consumo',
    );
    return r.list(q);
  }
  createSaleOutput(d: CreateSalidaVentaDto, actor: number) {
    return this.db.transaction(async (m) => {
      await this.ensureStock(
        m,
        d.id_lote,
        TipoMovimientoInventario.VENTA,
        d.cantidad,
      );
      await this.ensureSaleCompatibility(m, d.id_detalle, d.id_lote);
      if (
        await m.getRepository(SalidaProductoVenta).existsBy({
          id_detalle: d.id_detalle,
          id_lote: d.id_lote,
        })
      )
        throw new BadRequestException(
          'La salida de este lote ya fue registrada para el detalle',
        );
      const movement = await this.movimientos.create(
        {
          id_lote: d.id_lote,
          tipo: TipoMovimientoInventario.VENTA,
          cantidad: d.cantidad,
          registrado_por: actor,
          fecha_movimiento: new Date(),
          observaciones: d.observaciones,
        },
        m,
      );
      const r = m.getRepository(SalidaProductoVenta);
      const output = await r.save(
        r.create({
          id_detalle: d.id_detalle,
          id_lote: d.id_lote,
          id_movimiento: movement.id_movimiento,
          cantidad: d.cantidad,
        }),
      );
      await this.syncLotState(m, d.id_lote);
      return output;
    });
  }
  listSaleOutputs(q: DomainQueryDto) {
    const r = new DomainResourceService(
      SalidaProductoVenta,
      'id_salida',
      this.db.getRepository(SalidaProductoVenta),
      'Salida',
    );
    return r.list(q);
  }
  async stock(id: number) {
    await this.lotes.one(id);
    const total = await this.currentStock(this.db.manager, id);
    return { id_lote: id, stock: total.toFixed(2) };
  }
  private async ensureStock(
    manager: EntityManager,
    lotId: number,
    type: TipoMovimientoInventario,
    quantity: string,
  ) {
    const lot = await manager.getRepository(LoteProducto).findOne({
      where: { id_lote: lotId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!lot) throw new BadRequestException('El lote no existe');
    if (!this.isOutgoing(type)) return;
    const available = await this.currentStock(manager, lotId);
    if (available < Number(quantity))
      throw new BadRequestException(
        `Stock insuficiente. Disponible: ${available.toFixed(2)}`,
      );
  }
  private async currentStock(manager: EntityManager, lotId: number) {
    const rows = await manager.getRepository(MovimientoInventario).find({
      where: { id_lote: lotId },
    });
    return rows.reduce(
      (sum, row) =>
        sum +
        (this.isOutgoing(row.tipo)
          ? -Number(row.cantidad)
          : Number(row.cantidad)),
      0,
    );
  }
  private isOutgoing(type: TipoMovimientoInventario) {
    return [
      TipoMovimientoInventario.CONSUMO_SESION,
      TipoMovimientoInventario.VENTA,
      TipoMovimientoInventario.AJUSTE_SALIDA,
      TipoMovimientoInventario.MERMA,
      TipoMovimientoInventario.VENCIMIENTO,
    ].includes(type);
  }
  private async syncLotState(manager: EntityManager, lotId: number) {
    const lot = await manager.getRepository(LoteProducto).findOneBy({
      id_lote: lotId,
    });
    if (!lot || [EstadoLote.BAJA, EstadoLote.VENCIDO].includes(lot.estado))
      return;
    const stock = await this.currentStock(manager, lotId);
    lot.estado = stock <= 0 ? EstadoLote.AGOTADO : EstadoLote.DISPONIBLE;
    await manager.getRepository(LoteProducto).save(lot);
  }
  private async ensureConsumptionCompatibility(
    manager: EntityManager,
    sessionId: number,
    lotId: number,
  ) {
    const rows = (await manager.query(
      `SELECT 1
       FROM sesiones s
       JOIN tratamientos_paciente t ON t.id_tratamiento = s.id_tratamiento
       JOIN lotes_producto l ON l.id_lote = $2
       JOIN servicios_productos sp
         ON sp.id_servicio = t.id_servicio AND sp.id_producto = l.id_producto
       WHERE s.id_sesion = $1`,
      [sessionId, lotId],
    )) as unknown[];
    if (!rows.length)
      throw new BadRequestException(
        'El producto del lote no esta configurado para el servicio de la sesion',
      );
  }
  private async ensureSaleCompatibility(
    manager: EntityManager,
    detailId: number,
    lotId: number,
  ) {
    const rows = (await manager.query(
      `SELECT 1
       FROM detalles_nota_venta d
       JOIN lotes_producto l ON l.id_lote = $2
       JOIN notas_venta n ON n.id_nota_venta = d.id_nota_venta
       WHERE d.id_detalle = $1 AND d.id_producto = l.id_producto
         AND n.estado = 'EMITIDA'`,
      [detailId, lotId],
    )) as unknown[];
    if (!rows.length)
      throw new BadRequestException(
        'El lote no corresponde al producto vendido o la nota no esta emitida',
      );
  }
  private loteDates(d: {
    fecha_ingreso: string;
    fecha_vencimiento?: string | null;
  }) {
    if (d.fecha_vencimiento && d.fecha_ingreso > d.fecha_vencimiento)
      throw new BadRequestException(
        'fecha_vencimiento no puede ser anterior a fecha_ingreso',
      );
  }
}
