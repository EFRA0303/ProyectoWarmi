import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { databaseConfig } from '../dist/config/database.config.js';
import { CatalogoService } from '../dist/modules/catalogo/catalogo.service.js';
import { AdquisicionesService } from '../dist/modules/comercial/adquisiciones.service.js';
import { ClinicaService } from '../dist/modules/clinica/clinica.service.js';
import { VentasService } from '../dist/modules/ventas/ventas.service.js';
import { NotaVenta } from '../dist/modules/ventas/entities/ventas.entities.js';
import { TipoValoracion } from '../dist/common/enums/domain.enums.js';
import { Servicio } from '../dist/modules/catalogo/entities/servicio.entity.js';
import { TipoMedida } from '../dist/modules/catalogo/entities/tipo-medida.entity.js';
import {
  Producto,
  MovimientoInventario,
} from '../dist/modules/inventario/entities/inventario.entities.js';

describe('Configuración atómica del catálogo — PostgreSQL temporal', () => {
  const name = 'warmi_catalog_test_' + randomBytes(6).toString('hex');
  let maintenance: DataSource;
  let db: DataSource;
  let created = false;
  let catalog: CatalogoService;
  let categoryId: number;
  let measureId: number;
  let productId: number;
  const configuration = (nombre: string) => ({
    id_categoria: categoryId,
    nombre,
    duracion_minutos: 60,
    precio: '1000.00',
    sesiones_incluidas: 10,
    medidas: [
      {
        id_tipo_medida: measureId,
        obligatorio: true,
        momentos: ['INICIAL', 'FINAL'],
      },
    ],
    productos: [{ id_producto: productId, cantidad_referencial: '2.50' }],
  });

  beforeAll(async () => {
    const config = databaseConfig();
    if (config.type !== 'postgres')
      throw new Error('Estas pruebas requieren PostgreSQL');
    maintenance = new DataSource({ ...config, database: 'postgres' });
    await maintenance.initialize();
    await maintenance.query(`CREATE DATABASE "${name}"`);
    created = true;
    db = new DataSource({
      ...config,
      database: name,
      migrations: [
        fileURLToPath(
          new URL('../dist/database/migrations/*.js', import.meta.url),
        ).replaceAll('\\', '/'),
      ],
    });
    await db.initialize();
    await db.runMigrations();
    catalog = new CatalogoService(db);
    const area = await catalog.createArea({ nombre: 'Área de pruebas' });
    const category = await catalog.createCategory({
      id_area: area.id_area,
      nombre: 'Categoría de pruebas',
    });
    categoryId = category.id_categoria;
    const measure = await catalog.createMeasureType({
      nombre: 'Cintura',
      unidad: 'cm',
    });
    measureId = measure.id_tipo_medida;
    const productCategory = await catalog.createProductCategory({
      nombre: 'Insumos de pruebas',
    });
    const product = await db.getRepository(Producto).save({
      id_categoria_producto: productCategory.id_categoria_producto,
      nombre: 'Crema',
      unidad_medida: 'ML',
      es_insumo: true,
    });
    productId = product.id_producto;
  }, 120000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    // Solo la base generada por esta prueba; nunca DB_DATABASE ni tablas reales.
    if (
      created &&
      maintenance?.isInitialized &&
      /^warmi_catalog_test_[a-f0-9]{12}$/.test(name)
    )
      await maintenance.query(`DROP DATABASE "${name}"`);
    if (maintenance?.isInitialized) await maintenance.destroy();
  }, 120000);

  it('guarda sesiones, mediciones y productos juntos, sin movimientos de stock', async () => {
    const service = await catalog.createService(
      configuration('Completo') as Parameters<
        CatalogoService['createService']
      >[0],
    );
    const stored = await catalog.findService(service.id_servicio);
    expect(stored.sesiones_incluidas).toBe(10);
    expect(stored.medidas[0].momentos).toEqual(['INICIAL', 'FINAL']);
    expect(stored.productos[0].cantidad_referencial).toBe('2.50');
    expect(await db.getRepository(MovimientoInventario).count()).toBe(0);
  });

  it('revierte el alta completa cuando falla un producto', async () => {
    const dto = configuration('No debe quedar creado');
    dto.productos[0].cantidad_referencial = '0';
    await expect(
      catalog.createService(
        dto as Parameters<CatalogoService['createService']>[0],
      ),
    ).rejects.toThrow();
    expect(
      await db.getRepository(Servicio).findOneBy({ nombre: dto.nombre }),
    ).toBeNull();
  });

  it('mantiene asignaciones en una edición parcial y permite quitarlas explícitamente', async () => {
    const service = await catalog.createService(
      configuration('Edición') as Parameters<
        CatalogoService['createService']
      >[0],
    );
    await catalog.updateService(service.id_servicio, {
      descripcion: 'Cambio parcial',
    });
    expect(
      (await catalog.findService(service.id_servicio)).productos,
    ).toHaveLength(1);
    await catalog.updateService(service.id_servicio, {
      medidas: [],
      productos: [],
    });
    const stored = await catalog.findService(service.id_servicio);
    expect(stored.medidas).toEqual([]);
    expect(stored.productos).toEqual([]);
  });

  it('revierte cambios escalares y mediciones si una cantidad de producto es inválida', async () => {
    const service = await catalog.createService(
      configuration('Edición atómica') as Parameters<
        CatalogoService['createService']
      >[0],
    );
    await expect(
      catalog.updateService(service.id_servicio, {
        nombre: 'No guardar',
        medidas: [],
        productos: [{ id_producto: productId, cantidad_referencial: '-1' }],
      }),
    ).rejects.toThrow();
    const stored = await catalog.findService(service.id_servicio);
    expect(stored.nombre).toBe('Edición atómica');
    expect(stored.medidas).toHaveLength(1);
    expect(stored.productos).toHaveLength(1);
  });

  it('cobra el precio total de las sesiones contratadas y conserva importes históricos', async () => {
    const [role] = await db.query(
      `INSERT INTO roles(nombre) VALUES ('PRUEBA_CATALOGO') RETURNING id_rol`,
    );
    const [person] = await db.query(
      `INSERT INTO personas(nombre, ap_paterno, genero, telefono1) VALUES ('Paciente', 'Prueba', 'FEMENINO', '+59170000001') RETURNING id_persona`,
    );
    const [user] = await db.query(
      `INSERT INTO usuarios(id_persona, id_rol, correo_acceso, contrasena_hash) VALUES ($1, $2, 'prueba@example.invalid', 'solo-fixture-no-utilizable') RETURNING id_usuario`,
      [person.id_persona, role.id_rol],
    );
    const [patient] = await db.query(
      `INSERT INTO pacientes(id_persona, created_by) VALUES ($1, $2) RETURNING id_paciente`,
      [person.id_persona, user.id_usuario],
    );
    const service = await catalog.createService({
      ...configuration('Precio exacto'),
      medidas: [],
      productos: [],
      precio: '100.00',
      sesiones_incluidas: 3,
    });
    const acquisitions = new AdquisicionesService(db);
    const acquisition = await acquisitions.create(
      {
        id_paciente: patient.id_paciente,
        fecha_adquisicion: new Date().toISOString(),
        detalles: [
          {
            id_servicio: service.id_servicio,
            sesiones_incluidas: 3,
            precio_unitario: '9999',
          },
        ],
      },
      user.id_usuario,
    );
    expect(acquisition?.total).toBe('100.00');
    const details = await acquisitions.details(acquisition!.id_adquisicion);
    expect(details[0].precio_unitario).toBe('33.33');
    expect(details[0].subtotal).toBe('100.00');
    await catalog.updateService(service.id_servicio, {
      precio: '5000.00',
      sesiones_incluidas: 1,
    });
    expect(
      (await acquisitions.details(acquisition!.id_adquisicion))[0].subtotal,
    ).toBe('100.00');
    expect((await acquisitions.one(acquisition!.id_adquisicion))?.total).toBe(
      '100.00',
    );
  });

  it('conecta el servicio del paciente con sus sesiones y todas sus valoraciones', async () => {
    const [user] = await db.query(
      `SELECT id_usuario, id_persona FROM usuarios WHERE correo_acceso = 'prueba@example.invalid'`,
    );
    const [patient] = await db.query(
      `SELECT id_paciente FROM pacientes WHERE id_persona = $1`,
      [user.id_persona],
    );
    const [staff] = await db.query(
      `INSERT INTO personal(id_usuario, profesion, cargo, fecha_ingreso, created_by) VALUES ($1, 'Fisioterapia', 'FISIOTERAPEUTA', CURRENT_DATE, $1) RETURNING id_personal`,
      [user.id_usuario],
    );
    const service = await catalog.createService({
      ...configuration('Atención contextual'),
      medidas: [],
      productos: [],
      sesiones_incluidas: 3,
    });
    const clinical = new ClinicaService(db);
    const acquisitions = new AdquisicionesService(db);
    const acquired = await acquisitions.create({ id_paciente: patient.id_paciente, fecha_adquisicion: new Date().toISOString(), detalles: [{ id_servicio: service.id_servicio, sesiones_incluidas: 3, precio_unitario: '0' }] }, user.id_usuario);
    const [detail] = await acquisitions.details(acquired!.id_adquisicion);
    const note = await db.getRepository(NotaVenta).findOneByOrFail({ id_adquisicion: acquired!.id_adquisicion });
    await new VentasService(db).createPago({ id_nota_venta: note.id_nota_venta, monto: '1.00', metodo_pago: 'EFECTIVO' as never, fecha_pago: new Date().toISOString() }, user.id_usuario);
    const treatment = await clinical.createTratamiento({
      id_detalle_adquisicion: detail.id_detalle_adquisicion,
      id_paciente: patient.id_paciente,
      id_servicio: service.id_servicio,
      indicado_por: staff.id_personal,
      sesiones_iniciales: 3,
    });
    const session = await clinical.createSesion({
      id_tratamiento: treatment.id_tratamiento,
      atendido_por: staff.id_personal,
      fecha_sesion: new Date(Date.now() - 60000).toISOString(),
    });
    await clinical.createValoracion({
      id_historial: treatment.id_historial,
      id_tratamiento: treatment.id_tratamiento,
      id_personal: staff.id_personal,
      tipo: TipoValoracion.INICIAL,
      fecha_valoracion: new Date().toISOString(),
    });
    await clinical.createValoracion({
      id_historial: treatment.id_historial,
      id_sesion: session.id_sesion,
      id_personal: staff.id_personal,
      tipo: TipoValoracion.EVOLUCION,
      fecha_valoracion: new Date().toISOString(),
    });
    const context = {
      page: 1,
      limit: 100,
      id_paciente: patient.id_paciente,
      id_tratamiento: treatment.id_tratamiento,
    };
    expect((await clinical.listValoraciones(context)).total).toBe(2);
    expect(
      (
        await clinical.listValoraciones({
          ...context,
          id_sesion: session.id_sesion,
        })
      ).total,
    ).toBe(1);
    expect(
      (await clinical.listValoraciones({ ...context, id_paciente: 99999999 }))
        .total,
    ).toBe(0);
    expect((await clinical.listSesiones(context)).data).toHaveLength(1);
    const options = await clinical.opcionesTratamientos();
    expect(
      options.services.find(
        (item: { id_servicio: number }) =>
          item.id_servicio === service.id_servicio,
      )?.sesiones_incluidas,
    ).toBe(3);
  }, 30000);

  it('rechaza productos no insumo y mediciones nuevas inactivas', async () => {
    const product = await db
      .getRepository(Producto)
      .findOneByOrFail({ id_producto: productId });
    product.es_insumo = false;
    product.es_vendible = true;
    product.precio_venta = '10.00';
    await db.getRepository(Producto).save(product);
    await expect(
      catalog.createService(
        configuration('No insumo') as Parameters<
          CatalogoService['createService']
        >[0],
      ),
    ).rejects.toThrow();
    expect(await catalog.productOptions()).toEqual([]);
    await db
      .getRepository(TipoMedida)
      .update(
        { id_tipo_medida: measureId },
        { estado: 'BAJA' as TipoMedida['estado'] },
      );
    await expect(
      catalog.createService({
        ...configuration('Medida inactiva'),
        productos: [],
      } as Parameters<CatalogoService['createService']>[0]),
    ).rejects.toThrow();
  });
});
