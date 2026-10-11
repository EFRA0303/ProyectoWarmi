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
  async listProductos(q: DomainQueryDto) {
    const { where, values, parameter } = this.inventoryFilters(q, 'p', [
      'p.nombre',
      "COALESCE(p.descripcion, '')",
      'p.unidad_medida',
    ]);
    const [count] = (await this.db.manager.query(
      `SELECT COUNT(*)::int AS total FROM productos p ${where}`,
      values,
    )) as Array<{ total: number }>;
    const limit = parameter(q.limit);
    const offset = parameter((q.page - 1) * q.limit);
    const data = await this.db.manager.query(
      `SELECT p.*,
              COUNT(DISTINCT l.id_lote)::int AS lotes,
              COALESCE(SUM(CASE
                WHEN m.tipo IN ('CONSUMO_SESION','VENTA','AJUSTE_SALIDA','MERMA','VENCIMIENTO') THEN -m.cantidad
                ELSE m.cantidad END), 0)::numeric(12,2) AS stock_actual
       FROM productos p
       LEFT JOIN lotes_producto l ON l.id_producto = p.id_producto
       LEFT JOIN movimientos_inventario m ON m.id_lote = l.id_lote
       ${where}
       GROUP BY p.id_producto
       ORDER BY p.estado ASC, p.nombre ASC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return { data, total: Number(count?.total ?? 0), page: q.page, limit: q.limit };
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
  async listLotes(q: DomainQueryDto) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => { values.push(value); return `$${values.length}`; };
    if (q.estado) conditions.push(`l.estado::text = ${parameter(q.estado.toUpperCase())}`);
    if (q.id_producto) conditions.push(`l.id_producto = ${parameter(q.id_producto)}`);
    if (q.search) {
      const value = parameter(`%${q.search}%`);
      conditions.push(`(p.nombre ILIKE ${value} OR COALESCE(l.numero_lote, '') ILIKE ${value})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [count] = (await this.db.manager.query(
      `SELECT COUNT(*)::int AS total FROM lotes_producto l JOIN productos p ON p.id_producto = l.id_producto ${where}`,
      values,
    )) as Array<{ total: number }>;
    const limit = parameter(q.limit);
    const offset = parameter((q.page - 1) * q.limit);
    const data = await this.db.manager.query(
      `SELECT l.*, p.nombre AS producto, p.unidad_medida,
              COALESCE(SUM(CASE
                WHEN m.tipo IN ('CONSUMO_SESION','VENTA','AJUSTE_SALIDA','MERMA','VENCIMIENTO') THEN -m.cantidad
                ELSE m.cantidad END), 0)::numeric(12,2) AS stock_actual
       FROM lotes_producto l
       JOIN productos p ON p.id_producto = l.id_producto
       LEFT JOIN movimientos_inventario m ON m.id_lote = l.id_lote
       ${where}
       GROUP BY l.id_lote, p.id_producto
       ORDER BY l.fecha_ingreso DESC, l.id_lote DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return { data, total: Number(count?.total ?? 0), page: q.page, limit: q.limit };
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
  async listMovements(q: DomainQueryDto) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => { values.push(value); return `$${values.length}`; };
    if (q.tipo) conditions.push(`m.tipo::text = ${parameter(q.tipo.toUpperCase())}`);
    if (q.id_producto) conditions.push(`l.id_producto = ${parameter(q.id_producto)}`);
    if (q.id_lote) conditions.push(`m.id_lote = ${parameter(q.id_lote)}`);
    if (q.desde) conditions.push(`m.fecha_movimiento >= ${parameter(q.desde)}`);
    if (q.hasta) conditions.push(`m.fecha_movimiento <= ${parameter(q.hasta)}`);
    if (q.search) {
      const value = parameter(`%${q.search}%`);
      conditions.push(`(p.nombre ILIKE ${value} OR COALESCE(l.numero_lote, '') ILIKE ${value} OR COALESCE(m.observaciones, '') ILIKE ${value})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [count] = (await this.db.manager.query(
      `SELECT COUNT(*)::int AS total FROM movimientos_inventario m JOIN lotes_producto l ON l.id_lote = m.id_lote JOIN productos p ON p.id_producto = l.id_producto ${where}`,
      values,
    )) as Array<{ total: number }>;
    const limit = parameter(q.limit);
    const offset = parameter((q.page - 1) * q.limit);
    const data = await this.db.manager.query(
      `SELECT m.*, l.numero_lote, l.id_producto, p.nombre AS producto,
              p.unidad_medida,
              pe.nombre || ' ' || pe.ap_paterno AS registrado_por_nombre
       FROM movimientos_inventario m
       JOIN lotes_producto l ON l.id_lote = m.id_lote
       JOIN productos p ON p.id_producto = l.id_producto
       JOIN usuarios u ON u.id_usuario = m.registrado_por
       JOIN personas pe ON pe.id_persona = u.id_persona
       ${where}
       ORDER BY m.fecha_movimiento DESC, m.id_movimiento DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return { data, total: Number(count?.total ?? 0), page: q.page, limit: q.limit };
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
  async listConsumptions(q: DomainQueryDto) {
    return this.operationList(q, 'consumos_sesion', 'id_consumo', `JOIN sesiones s ON s.id_sesion = x.id_sesion JOIN tratamientos_paciente t ON t.id_tratamiento = s.id_tratamiento JOIN servicios sv ON sv.id_servicio = t.id_servicio`, `x.id_sesion, sv.nombre AS referencia`);
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
  async listSaleOutputs(q: DomainQueryDto) {
    return this.operationList(q, 'salidas_producto_venta', 'id_salida', `JOIN detalles_nota_venta d ON d.id_detalle = x.id_detalle JOIN notas_venta n ON n.id_nota_venta = d.id_nota_venta`, `x.id_detalle, n.numero_nota AS referencia`);
  }
  async stock(id: number) {
    await this.lotes.one(id);
    const total = await this.currentStock(this.db.manager, id);
    return { id_lote: id, stock: total.toFixed(2) };
  }
  async options() {
    const products = await this.db.manager.query(
      `SELECT id_producto, nombre, unidad_medida, es_insumo, es_vendible
       FROM productos WHERE estado = 'ACTIVO' ORDER BY nombre`,
    );
    const lots = await this.db.manager.query(
      `SELECT l.id_lote, l.id_producto, l.numero_lote, l.fecha_vencimiento,
              l.estado, p.nombre AS producto, p.unidad_medida,
              COALESCE(SUM(CASE
                WHEN m.tipo IN ('CONSUMO_SESION','VENTA','AJUSTE_SALIDA','MERMA','VENCIMIENTO') THEN -m.cantidad
                ELSE m.cantidad END), 0)::numeric(12,2) AS stock_actual
       FROM lotes_producto l
       JOIN productos p ON p.id_producto = l.id_producto
       LEFT JOIN movimientos_inventario m ON m.id_lote = l.id_lote
       GROUP BY l.id_lote, p.id_producto
       ORDER BY p.nombre, l.fecha_ingreso DESC`,
    );
    return { products, lots };
  }
  async operationOptions() {
    const [sessions, saleDetails, lots] = await Promise.all([
      this.db.manager.query(`SELECT s.id_sesion, s.fecha_sesion, sv.nombre AS servicio, pe.nombre || ' ' || pe.ap_paterno AS paciente FROM sesiones s JOIN tratamientos_paciente t ON t.id_tratamiento = s.id_tratamiento JOIN servicios sv ON sv.id_servicio = t.id_servicio JOIN historiales h ON h.id_historial = t.id_historial JOIN pacientes pa ON pa.id_paciente = h.id_paciente JOIN personas pe ON pe.id_persona = pa.id_persona WHERE s.estado IN ('EN_CURSO','FINALIZADA') ORDER BY s.fecha_sesion DESC`),
      this.db.manager.query(`SELECT d.id_detalle, d.id_producto, d.descripcion_snapshot AS producto, d.cantidad, n.numero_nota, COALESCE(SUM(spv.cantidad),0)::numeric(10,2) AS cantidad_salida, (d.cantidad-COALESCE(SUM(spv.cantidad),0))::numeric(10,2) AS pendiente FROM detalles_nota_venta d JOIN notas_venta n ON n.id_nota_venta = d.id_nota_venta LEFT JOIN salidas_producto_venta spv ON spv.id_detalle = d.id_detalle WHERE d.id_producto IS NOT NULL AND n.estado = 'EMITIDA' GROUP BY d.id_detalle,n.id_nota_venta HAVING d.cantidad-COALESCE(SUM(spv.cantidad),0)>0 ORDER BY n.fecha_emision DESC`),
      this.options().then((value) => value.lots),
    ]);
    return { sessions, saleDetails, lots };
  }
  private async operationList(q: DomainQueryDto, table: string, key: string, joins: string, extra: string) {
    const values: unknown[] = []; const conditions: string[] = []; const parameter = (value: unknown) => { values.push(value); return `$${values.length}`; };
    if (q.search) { const value = parameter(`%${q.search}%`); conditions.push(`(p.nombre ILIKE ${value} OR COALESCE(l.numero_lote,'') ILIKE ${value})`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [count] = (await this.db.manager.query(`SELECT COUNT(*)::int AS total FROM ${table} x JOIN lotes_producto l ON l.id_lote=x.id_lote JOIN productos p ON p.id_producto=l.id_producto ${joins} ${where}`, values)) as Array<{total:number}>;
    const limit=parameter(q.limit), offset=parameter((q.page-1)*q.limit);
    const data=await this.db.manager.query(`SELECT x.*, ${extra}, p.nombre AS producto, p.unidad_medida, l.numero_lote, m.fecha_movimiento, m.observaciones FROM ${table} x JOIN lotes_producto l ON l.id_lote=x.id_lote JOIN productos p ON p.id_producto=l.id_producto JOIN movimientos_inventario m ON m.id_movimiento=x.id_movimiento ${joins} ${where} ORDER BY m.fecha_movimiento DESC LIMIT ${limit} OFFSET ${offset}`,values);
    return {data,total:Number(count?.total??0),page:q.page,limit:q.limit,key};
  }
  private inventoryFilters(
    q: DomainQueryDto,
    alias: string,
    searchColumns: string[],
  ) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => { values.push(value); return `$${values.length}`; };
    if (q.estado) conditions.push(`${alias}.estado::text = ${parameter(q.estado.toUpperCase())}`);
    if (q.search) {
      const value = parameter(`%${q.search}%`);
      conditions.push(`(${searchColumns.map((column) => `${column} ILIKE ${value}`).join(' OR ')})`);
    }
    return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', values, parameter };
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
