import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../dist/app.module.js';
import { databaseConfig } from '../dist/config/database.config.js';
import { PostmanSchema1790000000000 } from '../dist/database/migrations/1790000000000-PostmanSchema.js';
import { AccessAuditEvents1790000001000 } from '../dist/database/migrations/1790000001000-AccessAuditEvents.js';
import { Historiales1790000002000 } from '../dist/database/migrations/1790000002000-Historiales.js';
import { DisponibilidadPersonal1790400000000 } from '../dist/database/migrations/1790400000000-DisponibilidadPersonal.js';
import { CatalogoServicios1790500000000 } from '../dist/database/migrations/1790500000000-CatalogoServicios.js';
import { DomainModulesFiveToEleven1790600000000 } from '../dist/database/migrations/1790600000000-DomainModulesFiveToEleven.js';
import { BusinessIntegrity1790700000000 } from '../dist/database/migrations/1790700000000-BusinessIntegrity.js';
import { hashPassword } from '../dist/common/utils/password.js';
import { Usuario } from '../dist/modules/usuarios/entities/usuario.entity.js';
import { MailService } from '../dist/modules/auth/mail.service.js';

describe('Postman con PostgreSQL temporal, sin datos en la base de trabajo', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let maintenance: DataSource;
  const name = 'warmi_test_' + randomBytes(6).toString('hex');
  const password = 'Prueba-segura-2026!';
  let token: string;
  let limitedToken: string;
  let personId: number;
  let patientId: number;
  let historyId: number;
  let staffId: number;
  let userId: number;
  let roleId: number;
  let configId: number;
  let serviceId: number;
  let measureId: number;
  let resetToken = '';
  const api = () => request(app.getHttpServer());
  const auth = () => 'Bearer ' + token;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-only-secret-012345678901234567890123456789';
    maintenance = new DataSource(databaseConfig());
    await maintenance.initialize();
    await maintenance.query('CREATE DATABASE "' + name + '"');
    db = new DataSource({
      ...databaseConfig(),
      database: name,
      migrations: [
        PostmanSchema1790000000000,
        AccessAuditEvents1790000001000,
        Historiales1790000002000,
        DisponibilidadPersonal1790400000000,
        CatalogoServicios1790500000000,
        DomainModulesFiveToEleven1790600000000,
        BusinessIntegrity1790700000000,
      ],
    });
    await db.initialize();
    await db.runMigrations();
    // Solo fixtures de esta base temporal. No se ejecutan seeds de la aplicacion.
    await db.query("INSERT INTO roles(nombre) VALUES ('ADMINISTRADOR')");
    await db.query(
      "INSERT INTO personas(nombre,ap_paterno,genero,telefono1) VALUES ('Admin','Prueba','FEMENINO','70000001')",
    );
    await db.getRepository(Usuario).save({
      id_persona: 1,
      id_rol: 1,
      correo_acceso: 'admin@test.local',
      contrasena_hash: await hashPassword(password),
    });
    for (const resource of [
      'personas',
      'pacientes',
      'historiales',
      'disponibilidad',
      'catalogo',
      'comercial',
      'adquisiciones',
      'clinica',
      'agenda',
      'ventas',
      'inventario',
      'empresa',
      'usuarios',
      'personal',
      'roles',
      'permisos',
      'configuracion-auditoria',
      'auditoria',
      'accesos-usuario',
    ]) {
      for (const action of [
        'crear',
        'leer',
        'actualizar',
        'asignar',
        'eliminar',
      ]) {
        const [perm] = await db.query(
          `INSERT INTO permisos(permiso) VALUES ($1)
           ON CONFLICT (permiso) DO UPDATE SET permiso = EXCLUDED.permiso
           RETURNING id_permiso`,
          [resource + '.' + action],
        );
        await db.query(
          'INSERT INTO roles_permisos(id_rol,id_permiso,created_by) VALUES (1,$1,1)',
          [perm.id_permiso],
        );
      }
    }
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(db)
      .overrideProvider(MailService)
      .useValue({
        sendPasswordReset: async (_recipient: string, value: string) => {
          resetToken = value;
        },
      })
      .compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  }, 30000);

  it('requiere JWT y permite login con Passport', async () => {
    await api().get('/personas').expect(401);
    await api()
      .post('/auth/login')
      .send({ correo_acceso: 'admin@test.local', contrasena: 'mal' })
      .expect(401);
    const login = await api()
      .post('/auth/login')
      .send({ correo_acceso: 'admin@test.local', contrasena: password })
      .expect(200);
    token = login.body.access_token;
    expect(token).toBeTypeOf('string');
    const me = await api()
      .get('/auth/me')
      .set('Authorization', auth())
      .expect(200);
    expect(me.body).not.toHaveProperty('contrasena_hash');
    expect(me.body).not.toHaveProperty('token_recuperacion_hash');
  });

  it('registra intentos, filtra historiales y cierra la sesion exacta', async () => {
    const history = await api()
      .get('/accesos-usuario')
      .set('Authorization', auth())
      .expect(200);
    expect(history.body.total).toBeGreaterThanOrEqual(2);
    expect(history.body.data[0]).toEqual(
      expect.objectContaining({
        id_acceso: expect.any(String),
        identificador_intento: 'admin@test.local',
        ip: expect.any(String),
        user_agent: expect.any(String),
        login_exitoso: expect.any(Boolean),
      }),
    );
    const successful = await api()
      .get('/accesos-usuario/exitosos')
      .set('Authorization', auth())
      .expect(200);
    expect(
      successful.body.data.every(
        (row: { login_exitoso: boolean }) => row.login_exitoso,
      ),
    ).toBe(true);
    const failed = await api()
      .get('/accesos-usuario/fallidos')
      .set('Authorization', auth())
      .expect(200);
    expect(
      failed.body.data.every(
        (row: { login_exitoso: boolean }) => !row.login_exitoso,
      ),
    ).toBe(true);
    await api()
      .get('/accesos-usuario/usuario/1')
      .set('Authorization', auth())
      .expect(200);
    await api()
      .get('/accesos-usuario/ultimos')
      .set('Authorization', auth())
      .expect(200);

    await api().post('/auth/logout').set('Authorization', auth()).expect(200);
    await api().get('/auth/me').set('Authorization', auth()).expect(401);
    const login = await api()
      .post('/auth/login')
      .send({ correo_acceso: 'admin@test.local', contrasena: password })
      .expect(200);
    token = login.body.access_token;
  });

  it('crea personas con autor real y rechaza campos de autor enviados por el cliente', async () => {
    const data = {
      nombre: 'Ana',
      ap_paterno: 'Perez',
      genero: 'FEMENINO',
      telefono1: '70000002',
    };
    await api()
      .post('/personas')
      .set('Authorization', auth())
      .send({ ...data, created_by: 99 })
      .expect(400);
    const person = await api()
      .post('/personas')
      .set('Authorization', auth())
      .send(data)
      .expect(201);
    personId = person.body.id_persona;
    expect(person.body.created_by).toBe(1);
    expect(person.body.updated_by).toBeNull();
    expect(Number.isFinite(Date.parse(person.body.created_at))).toBe(true);
    await api()
      .post('/personas')
      .set('Authorization', auth())
      .send(data)
      .expect(409);
    const updated = await api()
      .patch('/personas/' + personId)
      .set('Authorization', auth())
      .send({ nombre: 'Ana Maria' })
      .expect(200);
    expect(updated.body.created_by).toBe(1);
    expect(updated.body.created_at).toBe(person.body.created_at);
    expect(updated.body.updated_by).toBe(1);
    expect(Date.parse(updated.body.updated_at)).toBeGreaterThanOrEqual(
      Date.parse(person.body.updated_at),
    );
    await api()
      .patch('/personas/' + personId)
      .set('Authorization', auth())
      .send({ updated_at: '2000-01-01' })
      .expect(400);
    await api().get('/personas/abc').set('Authorization', auth()).expect(400);
    await api()
      .get('/personas/999999')
      .set('Authorization', auth())
      .expect(404);
    await api()
      .get('/personas?limit=101')
      .set('Authorization', auth())
      .expect(400);
    const list = await api()
      .get('/personas?limit=1')
      .set('Authorization', auth())
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.total).toBe(2);
  });

  it('crea pacientes y cambia estado sin eliminar filas', async () => {
    await api()
      .post('/pacientes')
      .set('Authorization', auth())
      .send({ id_persona: 999999 })
      .expect(409);
    const patient = await api()
      .post('/pacientes')
      .set('Authorization', auth())
      .send({ id_persona: personId, ocupacion: 'Docente' })
      .expect(201);
    patientId = patient.body.id_paciente;
    expect(patient.body.created_by).toBe(1);
    const down = await api()
      .patch('/pacientes/' + patientId + '/baja')
      .set('Authorization', auth())
      .send({ motivo_baja: 'Temporal' })
      .expect(200);
    expect(down.body.estado).toBe('BAJA');
    const stored = await api()
      .get('/pacientes/' + patientId)
      .set('Authorization', auth())
      .expect(200);
    expect(stored.body.motivo_baja).toBe('Temporal');
    await api()
      .patch('/pacientes/' + patientId)
      .set('Authorization', auth())
      .send({ estado: 'ACTIVO' })
      .expect(200);
  });

  it('abre un unico historial por paciente y permite cerrarlo', async () => {
    await api()
      .post('/historiales')
      .set('Authorization', auth())
      .send({ id_paciente: 999999 })
      .expect(400);
    const history = await api()
      .post('/historiales')
      .set('Authorization', auth())
      .send({
        id_paciente: patientId,
        observaciones_generales: 'Apertura de historia clinica',
      })
      .expect(201);
    historyId = history.body.id_historial;
    expect(history.body.estado).toBe('ACTIVO');
    expect(Number.isFinite(Date.parse(history.body.fecha_apertura))).toBe(true);
    await api()
      .post('/historiales')
      .set('Authorization', auth())
      .send({ id_paciente: patientId })
      .expect(409);
    const closed = await api()
      .patch('/historiales/' + historyId)
      .set('Authorization', auth())
      .send({ estado: 'CERRADO' })
      .expect(200);
    expect(closed.body.estado).toBe('CERRADO');
    const list = await api()
      .get('/historiales?estado=CERRADO')
      .set('Authorization', auth())
      .expect(200);
    expect(list.body.total).toBe(1);
    await api()
      .patch('/historiales/' + historyId)
      .set('Authorization', auth())
      .send({ id_paciente: patientId })
      .expect(400);
  });

  it('crea usuarios activos, hashea contrasenas y aplica permisos', async () => {
    const role = await api()
      .post('/roles')
      .set('Authorization', auth())
      .send({ nombre: 'LECTOR' })
      .expect(201);
    roleId = role.body.id_rol;
    const user = await api()
      .post('/usuarios')
      .set('Authorization', auth())
      .send({
        id_persona: personId,
        id_rol: roleId,
        correo_acceso: 'user@test.local',
        contrasena: password,
      })
      .expect(201);
    userId = user.body.id_usuario;
    expect(user.body).not.toHaveProperty('contrasena_hash');
    expect(user.body.created_by).toBe(1);
    const [stored] = await db.query(
      'SELECT contrasena_hash FROM usuarios WHERE id_usuario = $1',
      [userId],
    );
    expect(stored.contrasena_hash).not.toBe(password);
    const login = await api()
      .post('/auth/login')
      .send({ correo_acceso: 'user@test.local', contrasena: password })
      .expect(200);
    limitedToken = login.body.access_token;
    await api()
      .get('/personas')
      .set('Authorization', 'Bearer ' + limitedToken)
      .expect(403);
    await api()
      .post('/usuarios')
      .set('Authorization', 'Bearer ' + limitedToken)
      .send({})
      .expect(403);
    await api()
      .patch('/usuarios/1/baja')
      .set('Authorization', auth())
      .send({})
      .expect(400);
  });

  it('asigna permisos sin borrar y deniega con permitido=false', async () => {
    const [perm] = await db.query(
      "SELECT id_permiso FROM permisos WHERE permiso = 'personas.leer'",
    );
    const assigned = await api()
      .post('/roles/' + roleId + '/permisos')
      .set('Authorization', auth())
      .send({ id_permiso: perm.id_permiso })
      .expect(201);
    expect(assigned.body.created_by).toBe(1);
    await api()
      .get('/personas')
      .set('Authorization', 'Bearer ' + limitedToken)
      .expect(200);
    const deny = await api()
      .post('/permisos/usuarios')
      .set('Authorization', auth())
      .send({
        id_usuario: userId,
        id_permiso: perm.id_permiso,
        permitido: false,
      })
      .expect(201);
    expect(deny.body.created_by).toBe(1);
    await api()
      .get('/personas')
      .set('Authorization', 'Bearer ' + limitedToken)
      .expect(403);
    const allow = await api()
      .post('/permisos/usuarios')
      .set('Authorization', auth())
      .send({
        id_usuario: userId,
        id_permiso: perm.id_permiso,
        permitido: true,
      })
      .expect(201);
    expect(allow.body.updated_by).toBe(1);
    expect(allow.body.created_at).toBe(deny.body.created_at);
    const [edit] = await db.query(
      "SELECT id_permiso FROM permisos WHERE permiso = 'personas.actualizar'",
    );
    await api()
      .post('/roles/' + roleId + '/permisos')
      .set('Authorization', auth())
      .send({ id_permiso: edit.id_permiso })
      .expect(201);
    const changed = await api()
      .patch('/personas/' + personId)
      .set('Authorization', 'Bearer ' + limitedToken)
      .send({ nombre: 'Editada' })
      .expect(200);
    expect(changed.body.created_by).toBe(1);
    expect(changed.body.updated_by).toBe(userId);
    await api()
      .get('/roles/' + roleId + '/permisos')
      .set('Authorization', auth())
      .expect(200);
    await api()
      .get('/permisos/usuarios/' + userId)
      .set('Authorization', auth())
      .expect(200);
  });

  it('crea personal y conserva al responsable al modificarlo', async () => {
    const employee = await api()
      .post('/personal')
      .set('Authorization', auth())
      .send({
        id_usuario: userId,
        profesion: 'Medicina',
        cargo: 'Profesional',
        fecha_ingreso: '2026-09-21',
      })
      .expect(201);
    expect(employee.body.created_by).toBe(1);
    staffId = employee.body.id_personal;
    const down = await api()
      .patch('/personal/' + employee.body.id_personal + '/baja')
      .set('Authorization', auth())
      .send({})
      .expect(200);
    expect(down.body.estado).toBe('BAJA');
    expect(down.body.updated_by).toBe(1);
    await api()
      .patch('/personal/' + staffId)
      .set('Authorization', auth())
      .send({ estado: 'ACTIVO' })
      .expect(200);
  });

  it('gestiona horarios, extras y bloqueos sin solapamientos', async () => {
    const schedule = await api()
      .post('/disponibilidad/horarios')
      .set('Authorization', auth())
      .send({
        id_personal: staffId,
        dia_semana: 'LUNES',
        hora_inicio: '08:00',
        hora_fin: '12:00',
      })
      .expect(201);
    expect(schedule.body.estado).toBe(true);
    await api()
      .post('/disponibilidad/horarios')
      .set('Authorization', auth())
      .send({
        id_personal: staffId,
        dia_semana: 'LUNES',
        hora_inicio: '11:00',
        hora_fin: '13:00',
      })
      .expect(409);
    const schedules = await api()
      .get('/disponibilidad/horarios?id_personal=' + staffId)
      .set('Authorization', auth())
      .expect(200);
    expect(schedules.body.total).toBe(1);

    const extra = await api()
      .post('/disponibilidad/horarios-extra')
      .set('Authorization', auth())
      .send({
        id_personal: staffId,
        fecha: '2030-01-10',
        hora_inicio: '14:00',
        hora_fin: '16:00',
        motivo: 'Atencion extraordinaria',
      })
      .expect(201);
    expect(extra.body.autorizado_por).toBe(1);
    expect(extra.body.estado).toBe('AUTORIZADO');
    await api()
      .patch('/disponibilidad/horarios-extra/' + extra.body.id_horario_extra)
      .set('Authorization', auth())
      .send({ estado: 'CANCELADO' })
      .expect(200);

    const block = await api()
      .post('/disponibilidad/bloqueos')
      .set('Authorization', auth())
      .send({
        id_personal: staffId,
        fecha_hora_inicio: '2030-01-10T09:00:00-04:00',
        fecha_hora_fin: '2030-01-10T10:00:00-04:00',
        motivo: 'Reunion',
      })
      .expect(201);
    expect(block.body.id_personal).toBe(staffId);
    await api()
      .post('/disponibilidad/bloqueos')
      .set('Authorization', auth())
      .send({
        id_personal: staffId,
        fecha_hora_inicio: '2030-01-10T09:30:00-04:00',
        fecha_hora_fin: '2030-01-10T10:30:00-04:00',
      })
      .expect(409);
    await api()
      .patch('/disponibilidad/bloqueos/' + block.body.id_bloqueo)
      .set('Authorization', auth())
      .send({
        fecha_hora_inicio: '2030-01-10T11:00:00-04:00',
        fecha_hora_fin: '2030-01-10T10:00:00-04:00',
      })
      .expect(400);
    await api()
      .get('/disponibilidad/bloqueos?id_personal=' + staffId)
      .set('Authorization', auth())
      .expect(200);
  });

  it('gestiona el catalogo jerarquico y medidas por servicio', async () => {
    const area = await api()
      .post('/catalogo/areas')
      .set('Authorization', auth())
      .send({ nombre: 'Fisioterapia', descripcion: 'Area terapeutica' })
      .expect(201);
    const category = await api()
      .post('/catalogo/categorias')
      .set('Authorization', auth())
      .send({ id_area: area.body.id_area, nombre: 'Rehabilitacion' })
      .expect(201);
    const service = await api()
      .post('/catalogo/servicios')
      .set('Authorization', auth())
      .send({
        id_categoria: category.body.id_categoria,
        nombre: 'Terapia manual',
        duracion_minutos: 45,
        requiere_valoracion: true,
      })
      .expect(201);
    serviceId = service.body.id_servicio;
    expect(service.body.duracion_minutos).toBe(45);
    await api()
      .post('/catalogo/servicios')
      .set('Authorization', auth())
      .send({
        id_categoria: category.body.id_categoria,
        nombre: 'Duracion invalida',
        duracion_minutos: 0,
      })
      .expect(400);
    const measure = await api()
      .post('/catalogo/tipos-medida')
      .set('Authorization', auth())
      .send({ nombre: 'Peso', unidad: 'kg' })
      .expect(201);
    measureId = measure.body.id_tipo_medida;
    const assigned = await api()
      .post('/catalogo/servicios/' + service.body.id_servicio + '/medidas')
      .set('Authorization', auth())
      .send({
        id_tipo_medida: measure.body.id_tipo_medida,
        obligatorio: true,
      })
      .expect(201);
    expect(assigned.body.obligatorio).toBe(true);
    const measures = await api()
      .get('/catalogo/servicios/' + service.body.id_servicio + '/medidas')
      .set('Authorization', auth())
      .expect(200);
    expect(measures.body).toHaveLength(1);
    expect(measures.body[0].tipoMedida.nombre).toBe('Peso');
    const services = await api()
      .get(
        '/catalogo/servicios?id_categoria=' +
          category.body.id_categoria +
          '&requiere_valoracion=true',
      )
      .set('Authorization', auth())
      .expect(200);
    expect(services.body.total).toBe(1);
    await api()
      .patch('/catalogo/areas/' + area.body.id_area)
      .set('Authorization', auth())
      .send({ estado: 'BAJA' })
      .expect(200);
    await api()
      .patch('/catalogo/categorias/' + category.body.id_categoria)
      .set('Authorization', auth())
      .send({ estado: 'ACTIVO' })
      .expect(400);
    await api()
      .patch('/catalogo/areas/' + area.body.id_area)
      .set('Authorization', auth())
      .send({ estado: 'ACTIVO' })
      .expect(200);
    await api()
      .patch('/catalogo/categorias/' + category.body.id_categoria)
      .set('Authorization', auth())
      .send({ estado: 'ACTIVO' })
      .expect(200);
  });

  it('gestiona paquetes, adquisiciones y reglas clinicas relacionadas', async () => {
    await api()
      .patch('/historiales/' + historyId)
      .set('Authorization', auth())
      .send({ estado: 'ACTIVO' })
      .expect(200);
    const pkg = await api()
      .post('/comercial/paquetes')
      .set('Authorization', auth())
      .send({ nombre: 'Paquete E2E', precio: '280.00' })
      .expect(201);
    await api()
      .post(`/comercial/paquetes/${pkg.body.id_paquete}/servicios`)
      .set('Authorization', auth())
      .send({ id_servicio: serviceId, sesiones_incluidas: 3 })
      .expect(201);
    const acquisition = await api()
      .post('/adquisiciones')
      .set('Authorization', auth())
      .send({
        id_paciente: patientId,
        id_paquete: pkg.body.id_paquete,
        fecha_adquisicion: '2030-01-01T10:00:00-04:00',
        detalles: [
          {
            id_servicio: serviceId,
            sesiones_incluidas: 3,
            precio_unitario: '100.00',
          },
        ],
      })
      .expect(201);
    expect(acquisition.body.total).toBe('280.00');
    const details = await api()
      .get(`/adquisiciones/${acquisition.body.id_adquisicion}/detalles`)
      .set('Authorization', auth())
      .expect(200);
    expect(details.body[0].nombre_servicio_snapshot).toBe('Terapia manual');

    const application = await api()
      .post('/clinica/solicitudes')
      .set('Authorization', auth())
      .send({
        id_historial: historyId,
        id_servicio: serviceId,
        fecha_solicitud: '2030-01-01T11:00:00-04:00',
      })
      .expect(201);
    const valuation = await api()
      .post('/clinica/valoraciones')
      .set('Authorization', auth())
      .send({
        id_historial: historyId,
        id_solicitud: application.body.id_solicitud,
        id_personal: staffId,
        tipo: 'INICIAL',
        fecha_valoracion: '2030-01-01T11:15:00-04:00',
      })
      .expect(201);
    await api()
      .post(`/clinica/valoraciones/${valuation.body.id_valoracion}/medidas`)
      .set('Authorization', auth())
      .send({ id_tipo_medida: measureId, valor: '65.50' })
      .expect(201);
    const treatment = await api()
      .post('/clinica/tratamientos')
      .set('Authorization', auth())
      .send({
        id_historial: historyId,
        id_servicio: serviceId,
        indicado_por: staffId,
        id_detalle_adquisicion: details.body[0].id_detalle_adquisicion,
        sesiones_iniciales: 3,
      })
      .expect(201);
    expect(treatment.body.estado).toBe('PENDIENTE');
  });

  it('impide cruces de agenda y convierte la cita atendida en sesion', async () => {
    const [treatment] = await db.query(
      'SELECT id_tratamiento FROM tratamientos_paciente ORDER BY id_tratamiento DESC LIMIT 1',
    );
    const appointment = await api()
      .post('/agenda/citas')
      .set('Authorization', auth())
      .send({
        id_paciente: patientId,
        id_tratamiento: treatment.id_tratamiento,
        id_personal: staffId,
        numero_sesion: 1,
        fecha_hora_inicio: '2030-01-07T09:00:00-04:00',
        fecha_hora_fin: '2030-01-07T09:45:00-04:00',
      })
      .expect(201);
    await api()
      .post('/agenda/citas')
      .set('Authorization', auth())
      .send({
        id_paciente: patientId,
        id_personal: staffId,
        fecha_hora_inicio: '2030-01-07T09:15:00-04:00',
        fecha_hora_fin: '2030-01-07T10:00:00-04:00',
      })
      .expect(400);
    await api()
      .patch(`/agenda/citas/${appointment.body.id_cita}`)
      .set('Authorization', auth())
      .send({
        estado: 'EN_ESPERA',
        fecha_llegada: '2030-01-07T08:55:00-04:00',
      })
      .expect(200);
    const session = await api()
      .post('/clinica/sesiones')
      .set('Authorization', auth())
      .send({
        id_tratamiento: treatment.id_tratamiento,
        id_cita: appointment.body.id_cita,
        atendido_por: staffId,
        fecha_sesion: '2030-01-07T09:00:00-04:00',
      })
      .expect(201);
    expect(session.body.id_cita).toBe(appointment.body.id_cita);
    const attended = await api()
      .get(`/agenda/citas/${appointment.body.id_cita}`)
      .set('Authorization', auth())
      .expect(200);
    expect(attended.body.estado).toBe('ATENDIDA');
  });

  it('calcula ventas, controla pagos y protege el stock', async () => {
    const product = await api()
      .post('/inventario/productos')
      .set('Authorization', auth())
      .send({
        nombre: 'Aceite E2E',
        unidad_medida: 'ml',
        es_insumo: true,
        es_vendible: true,
      })
      .expect(201);
    await api()
      .post(`/inventario/servicios/${serviceId}/productos`)
      .set('Authorization', auth())
      .send({
        id_producto: product.body.id_producto,
        cantidad_referencial: '5.00',
      })
      .expect(201);
    const lot = await api()
      .post('/inventario/lotes')
      .set('Authorization', auth())
      .send({
        id_producto: product.body.id_producto,
        numero_lote: 'E2E-001',
        cantidad_inicial: '100.00',
        fecha_ingreso: '2030-01-01',
      })
      .expect(201);
    const initialStock = await api()
      .get(`/inventario/lotes/${lot.body.id_lote}/stock`)
      .set('Authorization', auth())
      .expect(200);
    expect(initialStock.body.stock).toBe('100.00');
    const note = await api()
      .post('/ventas/notas')
      .set('Authorization', auth())
      .send({
        id_paciente: patientId,
        numero_nota: 'E2E-0001',
        fecha_emision: '2030-01-07T10:00:00-04:00',
        detalles: [
          {
            id_producto: product.body.id_producto,
            cantidad: '2.00',
            precio_unitario: '10.00',
          },
        ],
      })
      .expect(201);
    expect(note.body.total).toBe('20.00');
    await api()
      .post('/ventas/pagos')
      .set('Authorization', auth())
      .send({
        id_nota_venta: note.body.id_nota_venta,
        monto: '15.00',
        metodo_pago: 'QR',
        fecha_pago: '2030-01-07T10:05:00-04:00',
      })
      .expect(201);
    await api()
      .post('/ventas/pagos')
      .set('Authorization', auth())
      .send({
        id_nota_venta: note.body.id_nota_venta,
        monto: '6.00',
        metodo_pago: 'EFECTIVO',
        fecha_pago: '2030-01-07T10:06:00-04:00',
      })
      .expect(400);
    await api()
      .post('/inventario/salidas-venta')
      .set('Authorization', auth())
      .send({
        id_detalle: note.body.detalles[0].id_detalle,
        id_lote: lot.body.id_lote,
        cantidad: '2.00',
      })
      .expect(201);
    const [session] = await db.query(
      'SELECT id_sesion FROM sesiones ORDER BY id_sesion DESC LIMIT 1',
    );
    await api()
      .post('/inventario/consumos-sesion')
      .set('Authorization', auth())
      .send({
        id_sesion: session.id_sesion,
        id_lote: lot.body.id_lote,
        cantidad: '5.00',
      })
      .expect(201);
    const stock = await api()
      .get(`/inventario/lotes/${lot.body.id_lote}/stock`)
      .set('Authorization', auth())
      .expect(200);
    expect(stock.body.stock).toBe('93.00');
    await api()
      .post('/inventario/movimientos')
      .set('Authorization', auth())
      .send({
        id_lote: lot.body.id_lote,
        tipo: 'MERMA',
        cantidad: '100.00',
        fecha_movimiento: '2030-01-07T11:00:00-04:00',
      })
      .expect(400);
  });

  it('configura los datos de empresa y documentos', async () => {
    const company = await api()
      .post('/empresa')
      .set('Authorization', auth())
      .send({ nombre_comercial: 'Warmi E2E', moneda: 'BOB' })
      .expect(201);
    const config = await api()
      .post('/empresa/configuraciones-documentos')
      .set('Authorization', auth())
      .send({ id_empresa: company.body.id_empresa, encabezado: 'Warmi E2E' })
      .expect(201);
    expect(config.body.mostrar_logo).toBe(true);
  });

  it('protege configuraciones obligatorias y permite consultar historiales', async () => {
    const config = await api()
      .post('/configuracion-auditoria')
      .set('Authorization', auth())
      .send({ codigo_evento: 'PRUEBA', nombre: 'Prueba', categoria: 'USUARIO' })
      .expect(201);
    configId = config.body.id_configuracion;
    await db.query(
      'UPDATE configuracion_auditoria SET es_obligatorio = true WHERE id_configuracion = $1',
      [configId],
    );
    await api()
      .patch('/configuracion-auditoria/' + configId)
      .set('Authorization', auth())
      .send({ habilitado: false })
      .expect(400);
    await api()
      .patch('/configuracion-auditoria/' + configId)
      .set('Authorization', auth())
      .send({ es_obligatorio: false })
      .expect(400);
    for (const resource of ['auditoria', 'accesos-usuario']) {
      const history = await api()
        .get('/' + resource)
        .set('Authorization', auth())
        .expect(200);
      if (resource === 'auditoria') expect(history.body.total).toBe(0);
      else expect(history.body.total).toBeGreaterThan(0);
      await api()
        .post('/' + resource)
        .set('Authorization', auth())
        .send({})
        .expect(404);
    }
  });

  it('rechaza JWT expirados, roles en BAJA y bloquea cinco intentos fallidos', async () => {
    const expired = await app
      .get(JwtService)
      .signAsync({ sub: 1, id_rol: 1, passwordVersion: 0 }, { expiresIn: -1 });
    await api()
      .get('/auth/me')
      .set('Authorization', 'Bearer ' + expired)
      .expect(401);
    await api()
      .patch('/roles/' + roleId + '/baja')
      .set('Authorization', auth())
      .send({})
      .expect(200);
    await api()
      .get('/auth/me')
      .set('Authorization', 'Bearer ' + limitedToken)
      .expect(401);
    await api()
      .patch('/roles/' + roleId)
      .set('Authorization', auth())
      .send({ estado: 'ACTIVO' })
      .expect(200);
    for (let i = 0; i < 5; i++)
      await api()
        .post('/auth/login')
        .send({
          correo_acceso: 'user@test.local',
          contrasena: 'Incorrecta-2026',
        })
        .expect(401);
    await api()
      .post('/auth/login')
      .send({ correo_acceso: 'user@test.local', contrasena: password })
      .expect(401);
    await db.query(
      'UPDATE usuarios SET bloqueado_hasta = $1 WHERE id_usuario = $2',
      [new Date(Date.now() - 1000), userId],
    );
    await api()
      .post('/auth/login')
      .send({ correo_acceso: 'user@test.local', contrasena: password })
      .expect(200);
  });

  it('invalida JWT al cambiar la contrasena y al dar de baja', async () => {
    await api()
      .post('/auth/change-password')
      .set('Authorization', 'Bearer ' + limitedToken)
      .send({
        contrasena_actual: password,
        nueva_contrasena: 'Nueva-segura-2026!',
      })
      .expect(200);
    await api()
      .get('/auth/me')
      .set('Authorization', 'Bearer ' + limitedToken)
      .expect(401);
    const login = await api()
      .post('/auth/login')
      .send({
        correo_acceso: 'user@test.local',
        contrasena: 'Nueva-segura-2026!',
      })
      .expect(200);
    await api()
      .patch('/usuarios/' + userId + '/baja')
      .set('Authorization', auth())
      .send({})
      .expect(200);
    await api()
      .get('/auth/me')
      .set('Authorization', 'Bearer ' + login.body.access_token)
      .expect(401);
    const user = await api()
      .get('/usuarios/' + userId)
      .set('Authorization', auth())
      .expect(200);
    expect(user.body.estado).toBe('BAJA');
  });

  it('solo expone DELETE para limpiar accesos y no implementa deleted_at o triggers', async () => {
    for (const resource of [
      'personas',
      'pacientes',
      'historiales',
      'usuarios',
      'personal',
      'roles',
      'permisos',
      'configuracion-auditoria',
      'auditoria',
    ])
      await api()
        .delete('/' + resource + '/1')
        .set('Authorization', auth())
        .expect(404);
    const byUser = await api()
      .delete('/accesos-usuario/usuario/1')
      .set('Authorization', auth())
      .expect(200);
    expect(byUser.body.eliminados).toBeGreaterThan(0);
    const all = await api()
      .delete('/accesos-usuario')
      .set('Authorization', auth())
      .expect(200);
    expect(all.body.eliminados).toBeGreaterThanOrEqual(0);
    expect(
      await db.query(
        "SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public'",
      ),
    ).toHaveLength(0);
    expect(
      await db.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'deleted_at'",
      ),
    ).toHaveLength(0);
  });

  it('recupera la contrasena con token temporal, hasheado y de un solo uso', async () => {
    const genericMessage =
      'Si la cuenta existe, recibiras un correo con las instrucciones.';
    const missing = await api()
      .post('/auth/forgot-password')
      .send({ correo_acceso: 'no-existe@test.local' })
      .expect(200);
    expect(missing.body.message).toBe(genericMessage);
    expect(resetToken).toBe('');

    const requested = await api()
      .post('/auth/forgot-password')
      .send({ correo_acceso: 'ADMIN@test.local' })
      .expect(200);
    expect(requested.body.message).toBe(genericMessage);
    expect(resetToken).toMatch(/^[0-9a-f]{64}$/);
    const firstToken = resetToken;
    const [stored] = await db.query(
      'SELECT token_recuperacion_hash, token_recuperacion_expira FROM usuarios WHERE id_usuario = 1',
    );
    expect(stored.token_recuperacion_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.token_recuperacion_hash).not.toBe(firstToken);
    expect(
      new Date(stored.token_recuperacion_expira).getTime(),
    ).toBeGreaterThan(Date.now());

    await db.query(
      'UPDATE usuarios SET token_recuperacion_expira = $1 WHERE id_usuario = 1',
      [new Date(Date.now() - 1000)],
    );
    await api()
      .post('/auth/reset-password')
      .send({
        token: firstToken,
        nueva_contrasena: 'Recuperada-segura-2026!',
      })
      .expect(400);

    await api()
      .post('/auth/forgot-password')
      .send({ correo_acceso: 'admin@test.local' })
      .expect(200);
    expect(resetToken).not.toBe(firstToken);
    const validToken = resetToken;
    await api()
      .post('/auth/reset-password')
      .send({
        token: validToken.toUpperCase(),
        nueva_contrasena: 'Recuperada-segura-2026!',
      })
      .expect(200);
    await api()
      .post('/auth/reset-password')
      .send({
        token: validToken,
        nueva_contrasena: 'No-debe-aplicarse-2026!',
      })
      .expect(400);
    await api().get('/auth/me').set('Authorization', auth()).expect(401);
    await api()
      .post('/auth/login')
      .send({ correo_acceso: 'admin@test.local', contrasena: password })
      .expect(401);
    await api()
      .post('/auth/login')
      .send({
        correo_acceso: 'admin@test.local',
        contrasena: 'Recuperada-segura-2026!',
      })
      .expect(200);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (db?.isInitialized) await db.destroy();
    if (maintenance?.isInitialized) {
      if (!/^warmi_test_[0-9a-f]{12}$/.test(name))
        throw new Error('Nombre temporal invalido');
      await maintenance.query('DROP DATABASE IF EXISTS "' + name + '"');
      await maintenance.destroy();
    }
  }, 15000);
});
