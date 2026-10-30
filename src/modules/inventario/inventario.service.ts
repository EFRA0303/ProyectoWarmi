import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { DomainResourceService } from '../../common/utils/domain-resource.service.js';
import { EstadoGeneral } from '../../common/enums/estado-general.enum.js';
import { CategoriaProducto } from '../catalogo/entities/categoria-producto.entity.js';
import { optimizeProductImage } from '../../common/utils/product-image.js';
import { units, decimal } from '../../common/utils/decimal.js';
import { operationKey } from '../../common/utils/operation-key.js';
import { localInventoryDate, stockUnits, usableLot, syncStockState } from './inventory-ledger.js';
import { DetalleNotaVenta, NotaVenta, Pago } from '../ventas/entities/ventas.entities.js';
import { Adquisicion } from '../comercial/entities/comercial.entities.js';
import { EstadoNotaVenta, EstadoPago } from '../../common/enums/domain.enums.js';
import {
  readProductImage,
  removeProductImage,
  writeProductImage,
} from '../../common/utils/product-image-storage.js';
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
  async createProducto(d: CreateProductoDto) {
    await this.validateProduct(d);
    return this.productos.create(this.cleanProduct(d));
  }
  async listProductos(q: DomainQueryDto) {
    const { where, values, parameter } = this.inventoryFilters(q, 'p', [
      'p.nombre',
      "COALESCE(p.descripcion, '')",
      'p.unidad_medida',
      "COALESCE(p.marca, '')",
      "COALESCE(p.sku, '')",
      "COALESCE(p.codigo_barras, '')",
      'cp.nombre',
    ]);
    const [count] = (await this.db.manager.query(
      `SELECT COUNT(*)::int AS total FROM productos p
       JOIN categorias_producto cp ON cp.id_categoria_producto = p.id_categoria_producto
       ${where}`,
      values,
    )) as Array<{ total: number }>;
    const limit = parameter(q.limit);
    const offset = parameter((q.page - 1) * q.limit);
    const data = await this.db.manager.query(
      `SELECT p.*, cp.nombre AS categoria_producto,
              COUNT(DISTINCT l.id_lote)::int AS lotes,
              COALESCE(SUM(CASE
                WHEN m.tipo IN ('CONSUMO_SESION','VENTA','AJUSTE_SALIDA','MERMA','VENCIMIENTO') THEN -m.cantidad
                ELSE m.cantidad END), 0)::numeric(12,2) AS stock_actual
       FROM productos p
       JOIN categorias_producto cp ON cp.id_categoria_producto = p.id_categoria_producto
       LEFT JOIN lotes_producto l ON l.id_producto = p.id_producto
       LEFT JOIN movimientos_inventario m ON m.id_lote = l.id_lote
       ${where}
       GROUP BY p.id_producto, cp.id_categoria_producto
       ORDER BY p.estado ASC, p.nombre ASC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return { data, total: Number(count?.total ?? 0), page: q.page, limit: q.limit };
  }
  oneProducto(id: number) {
    return this.productos.one(id);
  }
  async updateProducto(id: number, d: UpdateProductoDto) {
    const current = await this.productos.one(id);
    if (d.unidad_medida && d.unidad_medida !== current.unidad_medida) {
      const movements = await this.db.manager.query(`SELECT 1 FROM movimientos_inventario m JOIN lotes_producto l ON l.id_lote=m.id_lote WHERE l.id_producto=$1 LIMIT 1`, [id]) as unknown[];
      if (movements.length) throw new BadRequestException('No cambies la unidad de un producto con movimientos históricos. Crea otro producto para una unidad diferente.');
    }
    const merged = Object.assign({}, current, d);
    await this.validateProduct(merged);
    return this.productos.update(id, this.cleanProduct(d));
  }
  async saveProductImage(
    id: number,
    file: { buffer: Buffer; size: number },
  ) {
    const product = await this.productos.one(id);
    const image = await optimizeProductImage(file);
    const previousPath = product.imagen_url;
    const publicPath = await writeProductImage(image.data, product);
    try {
      await this.db.getRepository(Producto).update(id, {
        imagen_url: publicPath,
      });
    } catch (error) {
      if (publicPath !== previousPath) await removeProductImage(publicPath);
      throw error;
    }
    if (previousPath !== publicPath) await removeProductImage(previousPath);
    return {
      imagen_url: publicPath,
      ancho: image.width,
      alto: image.height,
      bytes: image.size,
    };
  }
  async getProductImage(id: number) {
    const product = await this.productos.one(id);
    if (!product.imagen_url)
      throw new NotFoundException('El producto no tiene una imagen');
    try {
      return {
        data: await readProductImage(product.imagen_url),
        mime: 'image/webp' as const,
      };
    } catch {
      throw new NotFoundException('No se encontró la imagen del producto');
    }
  }
  createLote(d: CreateLoteDto, actor: number) {
    this.loteDates(d);
    return this.db.transaction(async (manager) => {
      const operation = await operationKey(manager, 'lotes_producto', d.clave_operacion, actor, d);
      if (operation.existingId) return manager.getRepository(LoteProducto).findOneByOrFail({ id_lote: operation.existingId });
      const quantity = units(d.cantidad_inicial, 'Cantidad inicial');
      if (d.costo_unitario !== undefined) units(d.costo_unitario, 'Costo unitario');
      if (d.fecha_ingreso > localInventoryDate()) throw new BadRequestException('No registres como recibido un lote con fecha futura');
      if (!(await manager.getRepository(Producto).existsBy({ id_producto: d.id_producto, estado: EstadoGeneral.ACTIVO }))) throw new BadRequestException('El producto no está activo');
      const state = d.fecha_vencimiento && d.fecha_vencimiento < localInventoryDate() ? EstadoLote.VENCIDO : quantity === 0n ? EstadoLote.AGOTADO : EstadoLote.DISPONIBLE;
      const lot = await this.lotes.create(Object.assign({}, d, { cantidad_inicial: decimal(quantity), estado: state, huella_operacion: operation.hash }), manager);
      if (quantity > 0n) {
        await this.movimientos.create(
          {
            id_lote: lot.id_lote,
            tipo: TipoMovimientoInventario.ENTRADA_COMPRA,
            cantidad: decimal(quantity),
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
      `SELECT l.*,
              l.fecha_ingreso::text AS fecha_ingreso,
              l.fecha_vencimiento::text AS fecha_vencimiento,
              p.nombre AS producto, p.unidad_medida,
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
      const operation = await operationKey(manager, 'movimientos_inventario', d.clave_operacion, actor, d);
      if (operation.existingId) return manager.getRepository(MovimientoInventario).findOneByOrFail({ id_movimiento: operation.existingId });
      units(d.cantidad, 'Cantidad del movimiento', true);
      if (!Number.isFinite(new Date(d.fecha_movimiento).getTime()) || new Date(d.fecha_movimiento).getTime() > Date.now() + 300000) throw new BadRequestException('La fecha del movimiento no es válida o está en el futuro');
      if (!d.observaciones || d.observaciones.trim().length < 5) throw new BadRequestException('Indica el motivo o referencia del movimiento, con al menos cinco caracteres');
      await this.ensureStock(manager, d.id_lote, d.tipo, d.cantidad);
      const movement = await this.movimientos.create(
        Object.assign({}, d, {
          fecha_movimiento: new Date(d.fecha_movimiento),
          huella_operacion: operation.hash,
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
      const sessions = await m.query(`SELECT estado FROM sesiones WHERE id_sesion=$1 FOR UPDATE`, [d.id_sesion]) as Array<{ estado: string }>;
      const existing = await m.getRepository(ConsumoSesion).findOneBy({ id_sesion: d.id_sesion, id_lote: d.id_lote });
      if (existing && units(existing.cantidad) === units(d.cantidad, 'Cantidad consumida', true)) return existing;
      if (!sessions[0] || sessions[0].estado !== 'EN_CURSO') throw new BadRequestException('Solo se pueden registrar consumos durante una sesión en curso');
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
      const detail = await m.getRepository(DetalleNotaVenta).findOneBy({ id_detalle: d.id_detalle });
      if (!detail || !detail.id_producto) throw new BadRequestException('El detalle no corresponde a un producto vendido');
      const known = await m.getRepository(NotaVenta).findOneByOrFail({ id_nota_venta: detail.id_nota_venta });
      if (known.id_adquisicion) await m.getRepository(Adquisicion).findOne({ where: { id_adquisicion: known.id_adquisicion }, lock: { mode: 'pessimistic_write' } });
      const note = await m.getRepository(NotaVenta).findOneOrFail({ where: { id_nota_venta: detail.id_nota_venta }, lock: { mode: 'pessimistic_write' } });
      if (note.estado !== EstadoNotaVenta.EMITIDA) throw new BadRequestException('La nota no está emitida');
      const existing = await m.getRepository(SalidaProductoVenta).findOneBy({ id_detalle: d.id_detalle, id_lote: d.id_lote });
      const amount = units(d.cantidad, 'Cantidad entregada', true);
      if (existing && units(existing.cantidad) === amount) return existing;
      const payments = await m.getRepository(Pago).findBy({ id_nota_venta: note.id_nota_venta, estado: EstadoPago.REGISTRADO });
      if (payments.reduce((sum, item) => sum + units(item.monto), 0n) < units(note.total)) throw new BadRequestException('Completa el pago de la nota antes de entregar productos');
      const outputs = await m.getRepository(SalidaProductoVenta).findBy({ id_detalle: d.id_detalle });
      const totalUnits = units(detail.cantidad) * units(detail.factor_stock, 'Contenido por presentación', true);
      if (totalUnits % 100n || amount + outputs.reduce((sum, item) => sum + units(item.cantidad), 0n) > totalUnits / 100n) throw new BadRequestException('La salida supera la cantidad pendiente de entregar');
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
    const [products, lots, productCategories] = await Promise.all([
      this.db.manager.query(
      `SELECT id_producto, nombre, unidad_medida, es_insumo, es_vendible
       FROM productos WHERE estado = 'ACTIVO' ORDER BY nombre`,
      ),
      this.db.manager.query(
      `SELECT l.id_lote, l.id_producto, l.numero_lote,
               l.fecha_vencimiento::text AS fecha_vencimiento, l.fecha_ingreso::text AS fecha_ingreso,
              l.estado, p.nombre AS producto, p.unidad_medida,
              COALESCE(SUM(CASE
                WHEN m.tipo IN ('CONSUMO_SESION','VENTA','AJUSTE_SALIDA','MERMA','VENCIMIENTO') THEN -m.cantidad
                ELSE m.cantidad END), 0)::numeric(12,2) AS stock_actual
       FROM lotes_producto l
       JOIN productos p ON p.id_producto = l.id_producto
       LEFT JOIN movimientos_inventario m ON m.id_lote = l.id_lote
       GROUP BY l.id_lote, p.id_producto
       ORDER BY p.nombre, l.fecha_ingreso DESC`,
      ),
      this.db.manager.query(
        `SELECT id_categoria_producto, nombre, descripcion, estado
         FROM categorias_producto ORDER BY estado ASC, nombre ASC`,
      ),
    ]);
    return { products, lots, productCategories };
  }
  async operationOptions() {
    const [sessions, saleDetails, lots] = await Promise.all([
      this.db.manager.query(`SELECT s.id_sesion, s.fecha_sesion, sv.nombre AS servicio, pe.nombre || ' ' || pe.ap_paterno AS paciente FROM sesiones s JOIN tratamientos_paciente t ON t.id_tratamiento = s.id_tratamiento JOIN servicios sv ON sv.id_servicio = t.id_servicio JOIN historiales h ON h.id_historial = t.id_historial JOIN pacientes pa ON pa.id_paciente = h.id_paciente JOIN personas pe ON pe.id_persona = pa.id_persona WHERE s.estado = 'EN_CURSO' ORDER BY s.fecha_sesion DESC`),
      this.db.manager.query(`SELECT d.id_detalle, d.id_producto, d.descripcion_snapshot AS producto, d.cantidad, n.numero_nota, COALESCE(SUM(spv.cantidad),0)::numeric(10,2) AS cantidad_salida, (d.cantidad*d.factor_stock-COALESCE(SUM(spv.cantidad),0))::numeric(10,2) AS pendiente FROM detalles_nota_venta d JOIN notas_venta n ON n.id_nota_venta = d.id_nota_venta LEFT JOIN salidas_producto_venta spv ON spv.id_detalle = d.id_detalle WHERE d.id_producto IS NOT NULL AND n.estado = 'EMITIDA' AND n.total <= COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.id_nota_venta=n.id_nota_venta AND p.estado='REGISTRADO'),0) GROUP BY d.id_detalle,n.id_nota_venta HAVING d.cantidad*d.factor_stock-COALESCE(SUM(spv.cantidad),0)>0 ORDER BY n.fecha_emision DESC`),
      this.options().then((value) => value.lots.filter((lot: { estado: string; fecha_vencimiento: string | null; fecha_ingreso: string; stock_actual: string }) => lot.estado === 'DISPONIBLE' && Number(lot.stock_actual) > 0 && lot.fecha_ingreso <= localInventoryDate() && (!lot.fecha_vencimiento || lot.fecha_vencimiento >= localInventoryDate()))),
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
  private async validateProduct(d: Partial<CreateProductoDto>) {
    if (d.precio_venta !== undefined && d.precio_venta !== null) units(d.precio_venta, 'Precio de venta');
    if (!d.es_insumo && !d.es_vendible)
      throw new BadRequestException(
        'El producto debe ser un insumo, un artículo vendible o ambos',
      );
    if (d.es_vendible && (d.precio_venta === undefined || d.precio_venta === null))
      throw new BadRequestException(
        'Ingresa el precio de venta del producto vendible',
      );
    if (
      d.id_categoria_producto &&
      !(await this.db.getRepository(CategoriaProducto).existsBy({
        id_categoria_producto: d.id_categoria_producto,
        estado: EstadoGeneral.ACTIVO,
      }))
    )
      throw new BadRequestException(
        'La categoría de producto no existe o está inactiva',
      );
  }
  private cleanProduct<T extends Partial<CreateProductoDto>>(d: T): T {
    const nullable = ['marca', 'sku', 'codigo_barras', 'descripcion', 'precio_venta'] as const;
    const copy: Record<string, unknown> = { ...d };
    for (const field of nullable) {
      if (copy[field] === '') copy[field] = null;
    }
    return copy as T;
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
    const requested = units(quantity, 'Cantidad', true);
    if ([TipoMovimientoInventario.CONSUMO_SESION, TipoMovimientoInventario.VENTA].includes(type)) await usableLot(manager, lotId);
    const lot = await manager.getRepository(LoteProducto).findOne({
      where: { id_lote: lotId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!lot) throw new BadRequestException('El lote no existe');
    if (!this.isOutgoing(type)) {
      if ([EstadoLote.BAJA, EstadoLote.VENCIDO].includes(lot.estado) || lot.fecha_vencimiento && lot.fecha_vencimiento < localInventoryDate()) throw new BadRequestException('No ingreses stock a un lote dado de baja o vencido');
      return;
    }
    const available = await stockUnits(manager, lotId);
    if (available < requested)
      throw new BadRequestException(
        `Stock insuficiente. Disponible: ${decimal(available)}`,
      );
  }
  private async currentStock(manager: EntityManager, lotId: number) {
    return Number(await stockUnits(manager, lotId)) / 100;
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
    await syncStockState(manager, lotId);
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
       JOIN productos p ON p.id_producto=l.id_producto AND p.estado='ACTIVO' AND p.es_insumo
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
