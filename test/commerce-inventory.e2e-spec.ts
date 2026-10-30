import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { databaseConfig } from '../dist/config/database.config.js';
import { CatalogoService } from '../dist/modules/catalogo/catalogo.service.js';
import { AdquisicionesService } from '../dist/modules/comercial/adquisiciones.service.js';
import { InventarioService } from '../dist/modules/inventario/inventario.service.js';
import { VentasService } from '../dist/modules/ventas/ventas.service.js';
import { ClinicaService } from '../dist/modules/clinica/clinica.service.js';
import { NotaVenta, Pago, DetalleNotaVenta } from '../dist/modules/ventas/entities/ventas.entities.js';
import { MovimientoInventario, SalidaProductoVenta } from '../dist/modules/inventario/entities/inventario.entities.js';
import { EstadoNotaVenta, EstadoPago, EstadoAdquisicion, MetodoPago, TipoMovimientoInventario } from '../dist/common/enums/domain.enums.js';

describe('Comercio e inventario — PostgreSQL temporal, sin datos reales', () => {
  const name = 'warmi_commerce_test_' + randomBytes(6).toString('hex');
  let maintenance: DataSource, db: DataSource;
  let created = false;
  let sales: VentasService, inventory: InventarioService, acquisitions: AdquisicionesService, clinical: ClinicaService;
  let actor: number, patient: number, product: number, service: number, staff: number, productCategory: number;
  const date = () => new Date().toISOString();
  const query = { page: 1, limit: 100 };
  const purchase = () => ({ clave_operacion: randomUUID(), id_paciente: patient, fecha_adquisicion: date(), detalles: [{ id_servicio: service, sesiones_incluidas: 1, precio_unitario: '0' }] });
  const note = (quantity = '1', productId = product) => sales.createNota({ clave_operacion: randomUUID(), fecha_emision: date(), detalles: [{ id_producto: productId, cantidad: quantity, precio_unitario: '0.01' }] }, actor);
  const pay = (id: number, amount: string) => sales.createPago({ clave_operacion: randomUUID(), id_nota_venta: id, monto: amount, metodo_pago: MetodoPago.EFECTIVO, fecha_pago: date() }, actor);
  const lot = (amount: string, expiry?: string, productId = product) => inventory.createLote({ clave_operacion: randomUUID(), id_producto: productId, fecha_ingreso: '2026-01-01', fecha_vencimiento: expiry, cantidad_inicial: amount }, actor);

  beforeAll(async () => {
    const config = databaseConfig();
    if (config.type !== 'postgres') throw new Error('Se requiere PostgreSQL');
    maintenance = new DataSource({ ...config, database: 'postgres' });
    await maintenance.initialize();
    await maintenance.query(`CREATE DATABASE "${name}"`);
    created = true;
    db = new DataSource({ ...config, database: name, migrations: [fileURLToPath(new URL('../dist/database/migrations/*.js', import.meta.url)).replaceAll('\\', '/')] });
    await db.initialize();
    await db.runMigrations();
    const [role] = await db.query(`INSERT INTO roles(nombre) VALUES ('COMERCIO_TEST') RETURNING id_rol`);
    const [person] = await db.query(`INSERT INTO personas(nombre,ap_paterno,genero,telefono1) VALUES ('Comercio','Prueba','FEMENINO','+59170000002') RETURNING id_persona`);
    const [user] = await db.query(`INSERT INTO usuarios(id_persona,id_rol,correo_acceso,contrasena_hash) VALUES ($1,$2,'commerce@example.invalid','no-utilizable') RETURNING id_usuario`, [person.id_persona, role.id_rol]);
    actor = user.id_usuario;
    const [pa] = await db.query(`INSERT INTO pacientes(id_persona,created_by) VALUES ($1,$2) RETURNING id_paciente`, [person.id_persona, actor]);
    patient = pa.id_paciente;
    const [professional] = await db.query(`INSERT INTO personal(id_usuario,profesion,cargo,fecha_ingreso,created_by) VALUES ($1,'Fisioterapia','FISIOTERAPEUTA',CURRENT_DATE,$1) RETURNING id_personal`, [actor]);
    staff = professional.id_personal;
    const catalog = new CatalogoService(db);
    const area = await catalog.createArea({ nombre: 'Spa pruebas' });
    const category = await catalog.createCategory({ nombre: 'Servicios pruebas', id_area: area.id_area });
    const pc = await catalog.createProductCategory({ nombre: 'Productos pruebas' });
    productCategory = pc.id_categoria_producto;
    inventory = new InventarioService(db); sales = new VentasService(db); acquisitions = new AdquisicionesService(db); clinical = new ClinicaService(db);
    product = (await inventory.createProducto({ id_categoria_producto: pc.id_categoria_producto, nombre: 'Frasco 100 ml', unidad_medida: 'ML', presentacion: 'Frasco', contenido_presentacion: '100', es_insumo: true, es_vendible: true, precio_venta: '50.00' })).id_producto;
    service = (await catalog.createService({ id_categoria: category.id_categoria, nombre: 'Sesión spa', duracion_minutos: 30, precio: '100.00', sesiones_incluidas: 1, productos: [{ id_producto: product, cantidad_referencial: '2.50' }], medidas: [] })).id_servicio;
  }, 120000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (created && maintenance?.isInitialized && /^warmi_commerce_test_[a-f0-9]{12}$/.test(name)) await maintenance.query(`DROP DATABASE "${name}"`);
    if (maintenance?.isInitialized) await maintenance.destroy();
  }, 120000);

  it('emite una única nota y ningún pago en adquisiciones concurrentes reintentadas', async () => {
    const dto = purchase();
    const [a, b] = await Promise.all([acquisitions.create(dto, actor), acquisitions.create(dto, actor)]);
    expect(a!.id_adquisicion).toBe(b!.id_adquisicion);
    expect(await db.getRepository(NotaVenta).countBy({ id_adquisicion: a!.id_adquisicion })).toBe(1);
    expect(await db.getRepository(Pago).count()).toBe(0);
    await expect(acquisitions.create({ ...dto, descuento: '1' }, actor)).rejects.toThrow('otros datos');
  });

  it('usa precio de catálogo, congela conversión y protege reintentos de nota', async () => {
    const dto = { clave_operacion: randomUUID(), fecha_emision: date(), detalles: [{ id_producto: product, cantidad: '2', precio_unitario: '0.01' }] };
    const a = await sales.createNota(dto, actor), b = await sales.createNota(dto, actor);
    expect(a.id_nota_venta).toBe(b.id_nota_venta);
    expect(a.total).toBe('100.00');
    const detail = await db.getRepository(DetalleNotaVenta).findOneByOrFail({ id_nota_venta: a.id_nota_venta });
    expect(detail.factor_stock).toBe('100.000');
    expect(detail.unidad_snapshot).toBe('Frasco');
    await inventory.updateProducto(product, { contenido_presentacion: '200', precio_venta: '75.00' });
    expect((await db.getRepository(DetalleNotaVenta).findOneByOrFail({ id_detalle: detail.id_detalle })).factor_stock).toBe('100.000');
    await inventory.updateProducto(product, { contenido_presentacion: '100', precio_venta: '50.00' });
    await expect(note('0.5')).rejects.toThrow('presentaciones completas');
  });

  it('registra abonos exactos, reintentos únicos y rechaza sobrepago concurrente', async () => {
    const n = await note();
    const dto = { clave_operacion: randomUUID(), id_nota_venta: n.id_nota_venta, monto: '10.10', metodo_pago: MetodoPago.QR, fecha_pago: date() };
    const [a, b] = await Promise.all([sales.createPago(dto, actor), sales.createPago(dto, actor)]);
    expect(a.id_pago).toBe(b.id_pago);
    const results = await Promise.allSettled([pay(n.id_nota_venta, '30'), pay(n.id_nota_venta, '30')]);
    expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect((await sales.listNotas(query)).data.find((item: NotaVenta) => item.id_nota_venta === n.id_nota_venta).saldo).toBe('9.90');
    await pay(n.id_nota_venta, '9.90');
    await expect(pay(n.id_nota_venta, '0.01')).rejects.toThrow('saldo');
  });

  it('crea el stock inicial una sola vez y los ajustes exigen motivo', async () => {
    const dto = { clave_operacion: randomUUID(), id_producto: product, fecha_ingreso: '2026-01-01', cantidad_inicial: '10' };
    const [a, b] = await Promise.all([inventory.createLote(dto, actor), inventory.createLote(dto, actor)]);
    expect(a.id_lote).toBe(b.id_lote);
    expect((await inventory.stock(a.id_lote)).stock).toBe('10.00');
    await expect(inventory.createMovement({ id_lote: a.id_lote, tipo: TipoMovimientoInventario.AJUSTE_ENTRADA, cantidad: '1', fecha_movimiento: date() }, actor)).rejects.toThrow('motivo');
    const movement = { clave_operacion: randomUUID(), id_lote: a.id_lote, tipo: TipoMovimientoInventario.AJUSTE_SALIDA, cantidad: '10', fecha_movimiento: date(), observaciones: 'Ajuste de prueba' };
    await inventory.createMovement(movement, actor); await inventory.createMovement(movement, actor);
    expect((await inventory.stock(a.id_lote)).stock).toBe('0.00');
  });

  it('exige pago completo y entrega por FEFO, excluyendo vencidos; repetir no duplica', async () => {
    const expired = await lot('100', '2026-01-02');
    const later = await lot('100', '2099-02-01');
    const first = await lot('60', '2099-01-01');
    const n = await note();
    await pay(n.id_nota_venta, '25');
    await expect(sales.deliverProducts(n.id_nota_venta, actor)).rejects.toThrow('Completa el pago');
    await pay(n.id_nota_venta, '25');
    const [a, b] = await Promise.all([sales.deliverProducts(n.id_nota_venta, actor), sales.deliverProducts(n.id_nota_venta, actor)]);
    expect(a).toHaveLength(2); expect(b).toHaveLength(2);
    expect((await inventory.stock(expired.id_lote)).stock).toBe('100.00');
    expect((await inventory.stock(first.id_lote)).stock).toBe('0.00');
    expect((await inventory.stock(later.id_lote)).stock).toBe('60.00');
    const payment = await db.getRepository(Pago).findOneByOrFail({ id_nota_venta: n.id_nota_venta });
    await expect(sales.updatePago(payment.id_pago, { estado: EstadoPago.ANULADO, motivo_anulacion: 'Prueba devolución' }, actor)).rejects.toThrow('devolución');
    await expect(sales.updateNota(n.id_nota_venta, { estado: EstadoNotaVenta.ANULADA, motivo_anulacion: 'Prueba anulación' }, actor)).rejects.toThrow();
  });

  it('revierte todas las salidas de una entrega con stock insuficiente', async () => {
    const n = await note('100'); await pay(n.id_nota_venta, '5000');
    const before = await db.getRepository(MovimientoInventario).count();
    await expect(sales.deliverProducts(n.id_nota_venta, actor)).rejects.toThrow('Stock disponible insuficiente');
    expect(await db.getRepository(MovimientoInventario).count()).toBe(before);
    expect(await db.getRepository(SalidaProductoVenta).createQueryBuilder('s').innerJoin('s.detalle', 'd').where('d.id_nota_venta=:id', { id: n.id_nota_venta }).getCount()).toBe(0);
  });

  it('completa una entrega parcial del mismo lote sin alterar el movimiento previo', async () => {
    const l = await lot('200', '2098-01-01'); const n = await note(); await pay(n.id_nota_venta, '50');
    const d = await db.getRepository(DetalleNotaVenta).findOneByOrFail({ id_nota_venta: n.id_nota_venta });
    const partial = await inventory.createSaleOutput({ id_detalle: d.id_detalle, id_lote: l.id_lote, cantidad: '20' }, actor);
    expect((await inventory.operationOptions()).saleDetails.find((item: { id_detalle: number }) => item.id_detalle === d.id_detalle).pendiente).toBe('80.00');
    await sales.deliverProducts(n.id_nota_venta, actor);
    expect((await db.getRepository(MovimientoInventario).findOneByOrFail({ id_movimiento: partial.id_movimiento })).cantidad).toBe('20.00');
    expect((await inventory.stock(l.id_lote)).stock).toBe('100.00');
    expect(await db.getRepository(SalidaProductoVenta).countBy({ id_detalle: d.id_detalle })).toBe(2);
  });

  it('dos notas compiten por stock sin producir cantidades negativas', async () => {
    const p = await inventory.createProducto({ id_categoria_producto: productCategory, nombre: 'Solo para concurrencia', unidad_medida: 'ML', presentacion: 'Frasco', contenido_presentacion: '100', es_insumo: false, es_vendible: true, precio_venta: '50.00' });
    await lot('100', undefined, p.id_producto);
    const a = await note('1', p.id_producto), b = await note('1', p.id_producto); await pay(a.id_nota_venta, '50'); await pay(b.id_nota_venta, '50');
    const result = await Promise.allSettled([sales.deliverProducts(a.id_nota_venta, actor), sales.deliverProducts(b.id_nota_venta, actor)]);
    expect(result.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    const options = await inventory.options();
    expect(options.lots.every((l: { stock_actual: string }) => Number(l.stock_actual) >= 0)).toBe(true);
  });

  it('anula con actor y motivo conservando importes y cancela adquisición junto a nota', async () => {
    const a = await acquisitions.create(purchase(), actor);
    const n = await db.getRepository(NotaVenta).findOneByOrFail({ id_adquisicion: a!.id_adquisicion });
    await expect(acquisitions.update(a!.id_adquisicion, { estado: EstadoAdquisicion.COMPLETADA }, actor)).rejects.toThrow('manualmente');
    await expect(sales.updateNota(n.id_nota_venta, { estado: EstadoNotaVenta.ANULADA }, actor)).rejects.toThrow('motivo');
    await sales.updateNota(n.id_nota_venta, { estado: EstadoNotaVenta.ANULADA, motivo_anulacion: 'Error de selección' }, actor);
    expect((await acquisitions.one(a!.id_adquisicion))!.estado).toBe('CANCELADA');
    const stored = await sales.oneNota(n.id_nota_venta);
    expect(stored.total).toBe('100.00'); expect(stored.anulado_por).toBe(actor);
    expect((await sales.listNotas(query)).data.find((item: NotaVenta) => item.id_nota_venta === n.id_nota_venta).saldo).toBe('0.00');
  });

  it('habilita clínica con primer abono, consume solo en curso y completa al pagar y atender', async () => {
    const a = await acquisitions.create(purchase(), actor);
    const [d] = await acquisitions.details(a!.id_adquisicion);
    const dto = { id_paciente: patient, id_servicio: service, indicado_por: staff, sesiones_iniciales: 1, id_detalle_adquisicion: d.id_detalle_adquisicion };
    await expect(clinical.createTratamiento(dto)).rejects.toThrow('primer abono');
    const n = await db.getRepository(NotaVenta).findOneByOrFail({ id_adquisicion: a!.id_adquisicion });
    await pay(n.id_nota_venta, '10');
    const t = await clinical.createTratamiento(dto);
    const s = await clinical.createSesion({ id_tratamiento: t.id_tratamiento, atendido_por: staff, fecha_sesion: date() });
    const l = await lot('20');
    const consumption = { id_sesion: s.id_sesion, id_lote: l.id_lote, cantidad: '2.50' };
    const c = await inventory.createConsumption(consumption, actor);
    expect((await inventory.createConsumption(consumption, actor)).id_consumo).toBe(c.id_consumo);
    expect((await inventory.stock(l.id_lote)).stock).toBe('17.50');
    await expect(clinical.cancelarSesion(s.id_sesion)).rejects.toThrow('consumidos');
    await clinical.finalizarSesion(s.id_sesion);
    await expect(inventory.createConsumption({ ...consumption, id_lote: (await lot('10')).id_lote }, actor)).rejects.toThrow('en curso');
    expect((await acquisitions.one(a!.id_adquisicion))!.estado).toBe('ACTIVA');
    await pay(n.id_nota_venta, '90');
    expect((await acquisitions.one(a!.id_adquisicion))!.estado).toBe('COMPLETADA');
  });

  it('conserva precios de paquetes y descuentos de promociones sin duplicar sus notas', async () => {
    const [pkg] = await db.query(`INSERT INTO paquetes(nombre,precio) VALUES ('Paquete comercial prueba', '70.00') RETURNING id_paquete`);
    await db.query(`INSERT INTO paquetes_servicios(id_paquete,id_servicio,sesiones_incluidas) VALUES ($1,$2,1)`, [pkg.id_paquete, service]);
    const a = await acquisitions.create({ ...purchase(), id_paquete: pkg.id_paquete }, actor);
    const n = await db.getRepository(NotaVenta).findOneByOrFail({ id_adquisicion: a!.id_adquisicion });
    expect(a!.total).toBe('70.00'); expect(n.total).toBe('70.00');
    expect((await db.getRepository(DetalleNotaVenta).findOneByOrFail({ id_nota_venta: n.id_nota_venta })).id_paquete).toBe(pkg.id_paquete);
    await db.query(`UPDATE paquetes SET precio=999 WHERE id_paquete=$1`, [pkg.id_paquete]);
    expect((await sales.oneNota(n.id_nota_venta)).total).toBe('70.00');
    const [promotion] = await db.query(`INSERT INTO promociones(nombre,tipo_descuento,valor_descuento,fecha_inicio,fecha_fin,estado) VALUES ('Promoción prueba','PORCENTAJE',15,now()-interval '1 day',now()+interval '1 day','ACTIVA') RETURNING id_promocion`);
    await db.query(`INSERT INTO promociones_servicios(id_promocion,id_servicio,sesiones_incluidas) VALUES ($1,$2,1)`, [promotion.id_promocion, service]);
    const p = await acquisitions.create({ ...purchase(), id_promocion: promotion.id_promocion }, actor);
    expect(p!.total).toBe('85.00');
    expect((await db.getRepository(NotaVenta).findOneByOrFail({ id_adquisicion: p!.id_adquisicion })).total).toBe('85.00');
    await acquisitions.options(); await sales.options();
  });

  it('revierte adquisición y detalles si falla la emisión automática de su nota', async () => {
    const before = (await acquisitions.list(query)).total;
    await db.query(`CREATE FUNCTION fail_test_note() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fallo controlado de nota'; END $$`);
    await db.query(`CREATE TRIGGER fail_test_note BEFORE INSERT ON notas_venta FOR EACH ROW EXECUTE FUNCTION fail_test_note()`);
    try {
      await expect(acquisitions.create(purchase(), actor)).rejects.toThrow('Fallo controlado');
      expect((await acquisitions.list(query)).total).toBe(before);
      expect((await db.query(`SELECT COUNT(*)::int AS total FROM detalles_adquisicion d LEFT JOIN adquisiciones a ON a.id_adquisicion=d.id_adquisicion WHERE a.id_adquisicion IS NULL`))[0].total).toBe(0);
    } finally {
      await db.query(`DROP TRIGGER fail_test_note ON notas_venta`);
      await db.query(`DROP FUNCTION fail_test_note()`);
    }
  });

  it('permite corregir un pago sin entregas, conservando actor, motivo y saldo', async () => {
    const n = await note(); const p = await pay(n.id_nota_venta, '10');
    await sales.updatePago(p.id_pago, { estado: EstadoPago.ANULADO, motivo_anulacion: 'Registro equivocado' }, actor);
    const stored = await db.getRepository(Pago).findOneByOrFail({ id_pago: p.id_pago });
    expect(stored.monto).toBe('10.00'); expect(stored.anulado_por).toBe(actor);
    expect((await sales.listNotas(query)).data.find((item: NotaVenta) => item.id_nota_venta === n.id_nota_venta).saldo).toBe('50.00');
  });

  it('bloquea revertir una migración que ya tiene registros trazables', async () => {
    await expect(db.undoLastMigration()).rejects.toThrow('no es seguro revertir');
    expect(await db.showMigrations()).toBe(false);
  });
});
