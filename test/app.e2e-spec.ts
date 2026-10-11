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
import { UserPresence1790800000000 } from '../dist/database/migrations/1790800000000-UserPresence.js';
import { UserStatusReason1790900000000 } from '../dist/database/migrations/1790900000000-UserStatusReason.js';
import { StaffColorAndProfilePhoto1791000000000 } from '../dist/database/migrations/1791000000000-StaffColorAndProfilePhoto.js';
import { ProfilePhotoFileStorage1791100000000 } from '../dist/database/migrations/1791100000000-ProfilePhotoFileStorage.js';
import { TreatmentPermissions1791200000000 } from '../dist/database/migrations/1791200000000-TreatmentPermissions.js';
import { EstadoBloqueosPersonal1791300000000 } from '../dist/database/migrations/1791300000000-EstadoBloqueosPersonal.js';
import { SessionLifecycle1791400000000 } from '../dist/database/migrations/1791400000000-SessionLifecycle.js';
import { SessionAppointmentActiveUniqueness1791500000000 } from '../dist/database/migrations/1791500000000-SessionAppointmentActiveUniqueness.js';
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
        UserPresence1790800000000,
        UserStatusReason1790900000000,
        StaffColorAndProfilePhoto1791000000000,
        ProfilePhotoFileStorage1791100000000,
        TreatmentPermissions1791200000000,
        EstadoBloqueosPersonal1791300000000,
        SessionLifecycle1791400000000,
        SessionAppointmentActiveUniqueness1791500000000,
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
      'tratamientos',
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
        'cancelar',
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
    expect(login.body.expires_in).toBe(3600);
    const me = await api()
      .get('/auth/me')
      .set('Authorization', auth())
      .expect(200);
    expect(me.body).not.toHaveProperty('contrasena_hash');
    expect(me.body).not.toHaveProperty('token_recuperacion_hash');
    expect(me.body.permisos).toEqual(
      expect.arrayContaining(['usuarios.leer', 'usuarios.actualizar']),
    );
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
    const [loggedOutUser] = await db.query(
      'SELECT ultima_actividad_en FROM usuarios WHERE id_usuario = $1',
      [1],
    );
    expect(loggedOutUser.ultima_actividad_en).toBeNull();
    const login = await api()
      .post('/auth/login')
      .send({ correo_acceso: 'admin@test.local', contrasena: password })
      .expect(200);
    token = login.body.access_token;
    const loggedOutPresence = await api()
      .get('/usuarios/presencia?ids=1')
      .set('Authorization', auth())
      .expect(200);
    expect(loggedOutPresence.body[0].ultima_desconexion_en).toEqual(
      expect.any(String),
    );
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
      .get('/historiales?estado=CERRADO&search=Ana')
      .set('Authorization', auth())
      .expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toEqual(
      expect.objectContaining({
        id_historial: historyId,
        id_paciente: patientId,
        nombre: 'Ana Maria',
      }),
    );
    const summary = await api()
      .get(`/historiales/${historyId}/resumen`)
      .set('Authorization', auth())
      .expect(200);
    expect(summary.body.history.id_paciente).toBe(patientId);
    expect(summary.body).toEqual(
      expect.objectContaining({
        requests: [],
        treatments: [],
        sessions: [],
        valuations: [],
        appointments: [],
      }),
    );
    const options = await api()
      .get('/historiales/opciones')
      .set('Authorization', auth())
      .expect(200);
    expect(
      options.body.some(
        (item: { id_paciente: number }) => item.id_paciente === patientId,
      ),
    ).toBe(false);
    const patients = await api()
      .get('/pacientes?search=Ana')
      .set('Authorization', auth())
      .expect(200);
    expect(patients.body.data[0].historial.id_historial).toBe(historyId);
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
      .post('/usuarios/paciente')
      .set('Authorization', auth())
      .send({
        id_persona: personId,
        id_rol: roleId,
        correo_acceso: 'user@test.local',
        nombre_usuario: 'usuario.prueba',
        contrasena: password,
      })
      .expect(201);
    userId = user.body.id_usuario;
    expect(user.body).not.toHaveProperty('contrasena_hash');
    expect(user.body.created_by).toBe(1);
    const users = await api()
      .get('/usuarios?search=ana%20maria&estado=ACTIVO&limit=1')
      .set('Authorization', auth())
      .expect(200);
    expect(users.body).toEqual(
      expect.objectContaining({ total: 1, page: 1, limit: 1 }),
    );
    expect(users.body.data[0]).toEqual(
      expect.objectContaining({
        id_usuario: userId,
        correo_acceso: 'user@test.local',
        persona: expect.objectContaining({
          nombre: 'Ana Maria',
          ap_paterno: 'Perez',
        }),
        rol: expect.objectContaining({ nombre: 'LECTOR' }),
        creador: {
          id_usuario: 1,
          persona: expect.objectContaining({
            nombre: 'Admin',
            ap_paterno: 'Prueba',
          }),
        },
      }),
    );
    const userDetail = await api()
      .get('/usuarios/' + userId)
      .set('Authorization', auth())
      .expect(200);
    expect(userDetail.body).toEqual(
      expect.objectContaining({
        id_usuario: userId,
        persona: expect.objectContaining({ id_persona: personId }),
        rol: expect.objectContaining({ id_rol: roleId }),
        creador: {
          id_usuario: 1,
          persona: expect.objectContaining({
            nombre: 'Admin',
            ap_paterno: 'Prueba',
          }),
        },
      }),
    );
    const patientUsers = await api()
      .get('/usuarios?tipo=PACIENTE&limit=1')
      .set('Authorization', auth())
      .expect(200);
    expect(patientUsers.body).toEqual(
      expect.objectContaining({ total: 1, page: 1, limit: 1 }),
    );
    expect(patientUsers.body.data[0]).toEqual(
      expect.objectContaining({
        id_usuario: userId,
        persona: expect.objectContaining({
          paciente: expect.objectContaining({ id_paciente: patientId }),
        }),
      }),
    );
    for (const search of ['usuario.prueba', 'user@test.local']) {
      const matchingPatient = await api()
        .get('/pacientes?search=' + encodeURIComponent(search))
        .set('Authorization', auth())
        .expect(200);
      expect(matchingPatient.body.data[0].id_paciente).toBe(patientId);
    }
    const patientAndAccessDown = await api()
      .patch('/pacientes/' + patientId + '/estado-acceso')
      .set('Authorization', auth())
      .send({ estado: 'BAJA', motivo_baja: 'Baja coordinada de prueba' })
      .expect(200);
    expect(patientAndAccessDown.body.usuario_actualizado).toBe(true);
    expect(patientAndAccessDown.body.paciente.estado).toBe('BAJA');
    let [coordinatedUser] = await db.query(
      'SELECT estado, motivo_estado FROM usuarios WHERE id_usuario = $1',
      [userId],
    );
    expect(coordinatedUser.estado).toBe('BAJA');
    expect(coordinatedUser.motivo_estado).toBe('Baja coordinada de prueba');
    await api()
      .patch('/pacientes/' + patientId + '/estado-acceso')
      .set('Authorization', auth())
      .send({ estado: 'ACTIVO' })
      .expect(200);
    [coordinatedUser] = await db.query(
      'SELECT estado, motivo_estado FROM usuarios WHERE id_usuario = $1',
      [userId],
    );
    expect(coordinatedUser.estado).toBe('ACTIVO');
    expect(coordinatedUser.motivo_estado).toBeNull();
    for (const estado of ['BAJA', 'BLOQUEADO']) {
      const filtered = await api()
        .get('/usuarios?estado=' + estado)
        .set('Authorization', auth())
        .expect(200);
      expect(filtered.body.total).toBe(0);
    }
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
    const usernameLogin = await api()
      .post('/auth/login')
      .send({ correo_acceso: 'usuario.prueba', contrasena: password })
      .expect(200);
    expect(usernameLogin.body.access_token).toBeTruthy();
    await api()
      .post('/auth/activity')
      .set('Authorization', 'Bearer ' + limitedToken)
      .expect(200, { en_linea: true });
    const ownProfile = await api()
      .patch('/auth/me/personal')
      .set('Authorization', 'Bearer ' + limitedToken)
      .send({ direccion: 'Perfil propio actualizado' })
      .expect(200);
    expect(ownProfile.body).toEqual(
      expect.objectContaining({
        id_persona: personId,
        direccion: 'Perfil propio actualizado',
        updated_by: userId,
      }),
    );
    const onlineUser = await api()
      .get('/usuarios?search=user@test.local')
      .set('Authorization', auth())
      .expect(200);
    expect(onlineUser.body.data[0]).toEqual(
      expect.objectContaining({
        id_usuario: userId,
        en_linea: true,
        ultima_actividad_en: expect.any(String),
      }),
    );
    const presence = await api()
      .get('/usuarios/presencia?ids=' + userId)
      .set('Authorization', auth())
      .expect(200);
    expect(presence.body).toEqual([
      expect.objectContaining({
        id_usuario: userId,
        en_linea: true,
        ultima_actividad_en: expect.any(String),
        ultima_desconexion_en: null,
      }),
    ]);
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
    const effective = await api()
      .get('/auth/me')
      .set('Authorization', 'Bearer ' + limitedToken)
      .expect(200);
    expect(effective.body.permisos).toEqual(
      expect.arrayContaining(['personas.leer', 'personas.actualizar']),
    );
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

  it('crea roles con permisos y sincroniza excepciones individuales', async () => {
    const permissions = await db.query(
      "SELECT id_permiso, permiso FROM permisos WHERE permiso IN ('personas.leer', 'personas.actualizar') ORDER BY permiso",
    );
    const ids = permissions.map((permission: { id_permiso: number }) =>
      Number(permission.id_permiso),
    );
    const created = await api()
      .post('/roles/registro-completo')
      .set('Authorization', auth())
      .send({
        rol: {
          nombre: 'ROL CONFIGURABLE',
          descripcion: 'Creado junto con sus permisos',
        },
        id_permisos: ids,
      })
      .expect(201);
    const initial = await api()
      .get('/roles/' + created.body.id_rol + '/permisos')
      .set('Authorization', auth())
      .expect(200);
    expect(initial.body).toHaveLength(2);

    const updatedRole = await api()
      .put('/roles/' + created.body.id_rol + '/registro-completo')
      .set('Authorization', auth())
      .send({
        rol: {
          nombre: 'ROL CONFIGURABLE EDITADO',
          descripcion: 'Nombre y permisos actualizados juntos',
        },
        id_permisos: ids,
      })
      .expect(200);
    expect(updatedRole.body).toEqual(
      expect.objectContaining({
        nombre: 'ROL CONFIGURABLE EDITADO',
        descripcion: 'Nombre y permisos actualizados juntos',
        updated_by: 1,
      }),
    );

    const createdPermission = await api()
      .post('/permisos')
      .set('Authorization', auth())
      .send({
        permiso: 'pruebas.especial',
        descripcion: 'Permiso creado desde la gestion del sistema',
      })
      .expect(201);
    expect(createdPermission.body.permiso).toBe('pruebas.especial');
    await api()
      .post('/permisos')
      .set('Authorization', auth())
      .send({ permiso: 'Formato Invalido' })
      .expect(400);

    await api()
      .put('/roles/' + created.body.id_rol + '/permisos')
      .set('Authorization', auth())
      .send({ id_permisos: [ids[0]] })
      .expect(200);
    const synchronized = await api()
      .get('/roles/' + created.body.id_rol + '/permisos')
      .set('Authorization', auth())
      .expect(200);
    expect(synchronized.body).toHaveLength(1);
    expect(synchronized.body[0].id_permiso).toBe(ids[0]);

    await api()
      .put('/permisos/usuarios/' + userId)
      .set('Authorization', auth())
      .send({
        excepciones: [
          { id_permiso: ids[0], permitido: false },
          { id_permiso: ids[1], permitido: true },
        ],
      })
      .expect(200);
    const exceptions = await api()
      .get('/permisos/usuarios/' + userId)
      .set('Authorization', auth())
      .expect(200);
    expect(exceptions.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id_permiso: ids[0], permitido: false }),
        expect.objectContaining({ id_permiso: ids[1], permitido: true }),
      ]),
    );

    await api()
      .put('/permisos/usuarios/' + userId)
      .set('Authorization', auth())
      .send({ excepciones: [] })
      .expect(200);
    const inherited = await api()
      .get('/permisos/usuarios/' + userId)
      .set('Authorization', auth())
      .expect(200);
    expect(inherited.body).toHaveLength(0);
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
    const staffUsers = await api()
      .get('/usuarios?tipo=PERSONAL&limit=1')
      .set('Authorization', auth())
      .expect(200);
    expect(staffUsers.body).toEqual(
      expect.objectContaining({ total: 1, page: 1, limit: 1 }),
    );
    expect(staffUsers.body.data[0]).toEqual(
      expect.objectContaining({
        id_usuario: userId,
        personal: expect.objectContaining({ id_personal: staffId }),
      }),
    );
    const down = await api()
      .patch('/personal/' + employee.body.id_personal + '/estado')
      .set('Authorization', auth())
      .send({ estado: 'BAJA', motivo_baja: 'Fin de relación laboral' })
      .expect(200);
    expect(down.body.estado).toBe('BAJA');
    expect(down.body.updated_by).toBe(1);
    let [staffUser] = await db.query(
      'SELECT estado, motivo_estado FROM usuarios WHERE id_usuario = $1',
      [userId],
    );
    expect(staffUser.estado).toBe('BAJA');
    expect(staffUser.motivo_estado).toBe('Fin de relación laboral');
    await api()
      .patch('/personal/' + staffId + '/estado')
      .set('Authorization', auth())
      .send({ estado: 'ACTIVO' })
      .expect(200);
    [staffUser] = await db.query(
      'SELECT estado, motivo_estado FROM usuarios WHERE id_usuario = $1',
      [userId],
    );
    expect(staffUser.estado).toBe('ACTIVO');
    expect(staffUser.motivo_estado).toBeNull();
  });

  it('registra un paciente completo de forma atomica y permite consultarlo', async () => {
    const payload = {
      persona: {
        nombre: 'pACIENTE',
        ap_paterno: 'cOMPLETA',
        ap_materno: 'pRUEBA',
        ci: 'CI-PAC-COMP',
        fecha_nac: '1995-05-10',
        genero: 'FEMENINO',
        telefono1: '71110001',
        direccion: 'Direccion de prueba',
      },
      ocupacion: 'Arquitecta',
    };
    await api()
      .post('/pacientes/registro-completo')
      .set('Authorization', 'Bearer ' + limitedToken)
      .send(payload)
      .expect(403);

    const created = await api()
      .post('/pacientes/registro-completo')
      .set('Authorization', auth())
      .send(payload)
      .expect(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        ocupacion: 'Arquitecta',
        created_by: 1,
        persona: expect.objectContaining({
          nombre: 'Paciente',
          ap_paterno: 'Completa',
          created_by: 1,
        }),
      }),
    );
    const patientPersonId = created.body.persona.id_persona;
    const linkedUsers = await db.query(
      'SELECT id_usuario FROM usuarios WHERE id_persona = $1',
      [patientPersonId],
    );
    expect(linkedUsers).toHaveLength(0);
    const unavailablePersonData = await api()
      .get('/personas/disponibilidad?ci=CI-PAC-COMP&telefono1=71110001')
      .set('Authorization', auth())
      .expect(200);
    expect(unavailablePersonData.body).toEqual({
      ci_disponible: false,
      telefono1_disponible: false,
    });
    const availablePersonData = await api()
      .get('/personas/disponibilidad?ci=CI-NUEVO&telefono1=71119999')
      .set('Authorization', auth())
      .expect(200);
    expect(availablePersonData.body).toEqual({
      ci_disponible: true,
      telefono1_disponible: true,
    });

    await api()
      .post('/pacientes/registro-completo')
      .set('Authorization', auth())
      .send({
        ...payload,
        persona: {
          ...payload.persona,
          ci: 'CI-PAC-ROLLBACK',
        },
      })
      .expect(409);
    const rolledBackPeople = await db.query(
      'SELECT id_persona FROM personas WHERE ci = $1',
      ['CI-PAC-ROLLBACK'],
    );
    expect(rolledBackPeople).toHaveLength(0);

    const paginated = await api()
      .get('/pacientes?estado=ACTIVO&limit=1')
      .set('Authorization', auth())
      .expect(200);
    expect(paginated.body.total).toBeGreaterThanOrEqual(2);
    expect(paginated.body.data).toHaveLength(1);
    const searched = await api()
      .get('/pacientes?search=71110001&estado=ACTIVO&limit=1')
      .set('Authorization', auth())
      .expect(200);
    expect(searched.body).toEqual(
      expect.objectContaining({ total: 1, page: 1, limit: 1 }),
    );
    expect(searched.body.data[0].persona.ci).toBe('CI-PAC-COMP');
    await api()
      .patch(
        '/pacientes/' + created.body.id_paciente + '/actualizacion-completa',
      )
      .set('Authorization', 'Bearer ' + limitedToken)
      .send({ persona: payload.persona, paciente: { ocupacion: 'Medica' } })
      .expect(403);
    const updated = await api()
      .patch(
        '/pacientes/' + created.body.id_paciente + '/actualizacion-completa',
      )
      .set('Authorization', auth())
      .send({
        persona: { ...payload.persona, nombre: 'Paciente Editada' },
        paciente: { ocupacion: 'Medica' },
      })
      .expect(200);
    expect(updated.body).toEqual(
      expect.objectContaining({
        ocupacion: 'Medica',
        updated_by: 1,
        persona: expect.objectContaining({
          nombre: 'Paciente Editada',
          updated_by: 1,
        }),
      }),
    );
    await api()
      .patch('/pacientes/' + created.body.id_paciente + '/baja')
      .set('Authorization', auth())
      .send({ motivo_baja: 'Prueba de filtro' })
      .expect(200);
    const inactive = await api()
      .get('/pacientes?search=CI-PAC-COMP&estado=BAJA')
      .set('Authorization', auth())
      .expect(200);
    expect(inactive.body.total).toBe(1);
    expect(inactive.body.data[0].estado).toBe('BAJA');
  });

  it('registra personal completo con rollback, cifrado y listados enriquecidos', async () => {
    const payload = {
      persona: {
        nombre: 'eMPLEADA',
        ap_paterno: 'iNTEGRAL',
        ap_materno: 'pRUEBA',
        ci: 'CI-PER-COMP',
        fecha_nac: '1992-03-15',
        genero: 'FEMENINO',
        telefono1: '72220001',
      },
      usuario: {
        id_rol: roleId,
        correo_acceso: 'EMPLEADA.COMP@example.com',
        nombre_usuario: 'empleada.comp',
        contrasena: 'Personal-segura-2026!',
      },
      personal: {
        profesion: 'Nutricion',
        cargo: 'Nutricionista',
        fecha_ingreso: '2026-09-29',
      },
    };
    await api()
      .post('/personal/registro-completo')
      .set('Authorization', 'Bearer ' + limitedToken)
      .send(payload)
      .expect(403);

    const invalidRolePayload = {
      ...payload,
      persona: {
        ...payload.persona,
        ci: 'CI-PER-ROLLBACK',
        telefono1: '72220002',
      },
      usuario: {
        ...payload.usuario,
        id_rol: 32767,
        correo_acceso: 'rollback@example.com',
        nombre_usuario: 'rollback.personal',
      },
    };
    await api()
      .post('/personal/registro-completo')
      .set('Authorization', auth())
      .send(invalidRolePayload)
      .expect(400);
    expect(
      await db.query('SELECT id_persona FROM personas WHERE ci = $1', [
        'CI-PER-ROLLBACK',
      ]),
    ).toHaveLength(0);
    expect(
      await db.query(
        'SELECT id_usuario FROM usuarios WHERE correo_acceso = $1',
        ['rollback@example.com'],
      ),
    ).toHaveLength(0);

    const created = await api()
      .post('/personal/registro-completo')
      .set('Authorization', auth())
      .send(payload)
      .expect(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        profesion: 'Nutricion',
        cargo: 'Nutricionista',
        created_by: 1,
        usuario: expect.objectContaining({
          correo_acceso: 'empleada.comp@example.com',
          created_by: 1,
          persona: expect.objectContaining({
            nombre: 'Empleada',
            created_by: 1,
          }),
          rol: expect.objectContaining({ id_rol: roleId }),
        }),
      }),
    );
    expect(JSON.stringify(created.body)).not.toContain('contrasena_hash');
    const [storedAccount] = await db.query(
      'SELECT contrasena_hash FROM usuarios WHERE id_usuario = $1',
      [created.body.usuario.id_usuario],
    );
    expect(storedAccount.contrasena_hash).not.toBe(payload.usuario.contrasena);
    const unavailableAccountData = await api()
      .get(
        '/usuarios/disponibilidad?correo_acceso=EMPLEADA.COMP@example.com&nombre_usuario=empleada.comp',
      )
      .set('Authorization', auth())
      .expect(200);
    expect(unavailableAccountData.body).toEqual({
      correo_disponible: false,
      nombre_usuario_disponible: false,
    });

    const paginated = await api()
      .get('/personal?estado=ACTIVO&limit=1')
      .set('Authorization', auth())
      .expect(200);
    expect(paginated.body.total).toBeGreaterThanOrEqual(2);
    expect(paginated.body.data).toHaveLength(1);
    const searched = await api()
      .get('/personal?search=nutricion&estado=ACTIVO&limit=1')
      .set('Authorization', auth())
      .expect(200);
    expect(searched.body).toEqual(
      expect.objectContaining({ total: 1, page: 1, limit: 1 }),
    );
    expect(searched.body.data[0]).toEqual(
      expect.objectContaining({
        id_personal: created.body.id_personal,
        usuario: expect.objectContaining({
          persona: expect.objectContaining({ ci: 'CI-PER-COMP' }),
          rol: expect.objectContaining({ id_rol: roleId }),
        }),
      }),
    );
    const searchedByUsername = await api()
      .get('/personal?search=empleada.comp&estado=ACTIVO')
      .set('Authorization', auth())
      .expect(200);
    expect(searchedByUsername.body.data[0].id_personal).toBe(
      created.body.id_personal,
    );
    expect(JSON.stringify(searched.body)).not.toContain('contrasena_hash');
    await api()
      .patch(
        '/personal/' + created.body.id_personal + '/actualizacion-completa',
      )
      .set('Authorization', 'Bearer ' + limitedToken)
      .send({
        persona: payload.persona,
        usuario: {
          correo_acceso: 'empleada.editada@example.com',
          nombre_usuario: 'empleada.editada',
        },
        personal: {
          profesion: 'Fisioterapia',
          cargo: 'Fisioterapeuta',
          fecha_ingreso: '2026-09-29',
        },
      })
      .expect(403);
    const updated = await api()
      .patch(
        '/personal/' + created.body.id_personal + '/actualizacion-completa',
      )
      .set('Authorization', auth())
      .send({
        persona: { ...payload.persona, nombre: 'Empleada Editada' },
        usuario: {
          correo_acceso: 'EMPLEADA.EDITADA@example.com',
          nombre_usuario: 'empleada.editada',
        },
        personal: {
          profesion: 'Fisioterapia',
          cargo: 'Fisioterapeuta',
          fecha_ingreso: '2026-09-29',
        },
      })
      .expect(200);
    expect(updated.body).toEqual(
      expect.objectContaining({
        profesion: 'Fisioterapia',
        cargo: 'Fisioterapeuta',
        updated_by: 1,
        usuario: expect.objectContaining({
          correo_acceso: 'empleada.editada@example.com',
          nombre_usuario: 'empleada.editada',
          updated_by: 1,
          persona: expect.objectContaining({
            nombre: 'Empleada Editada',
            updated_by: 1,
          }),
        }),
      }),
    );
    await api()
      .patch('/personal/' + created.body.id_personal + '/baja')
      .set('Authorization', auth())
      .send({ motivo_baja: 'Prueba de filtro' })
      .expect(200);
    const inactive = await api()
      .get('/personal?search=empleada.editada@example.com&estado=BAJA')
      .set('Authorization', auth())
      .expect(200);
    expect(inactive.body.total).toBe(1);
    expect(inactive.body.data[0].estado).toBe('BAJA');
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
    const packageOptions = await api()
      .get('/comercial/paquetes-opciones')
      .set('Authorization', auth())
      .expect(200);
    expect(
      packageOptions.body.services.some(
        (item: { id_servicio: number }) => item.id_servicio === serviceId,
      ),
    ).toBe(true);
    await api()
      .put(`/comercial/paquetes/${pkg.body.id_paquete}/servicios`)
      .set('Authorization', auth())
      .send({
        servicios: [{ id_servicio: serviceId, sesiones_incluidas: 3 }],
      })
      .expect(200);
    const packageList = await api()
      .get('/comercial/paquetes?search=Terapia&estado=ACTIVO')
      .set('Authorization', auth())
      .expect(200);
    const listedPackage = packageList.body.data.find(
      (item: { id_paquete: number }) =>
        item.id_paquete === pkg.body.id_paquete,
    );
    expect(listedPackage.servicios[0].sesiones_incluidas).toBe(3);
    const promotion = await api()
      .post('/comercial/promociones')
      .set('Authorization', auth())
      .send({
        nombre: 'Promocion E2E',
        tipo_descuento: 'PORCENTAJE',
        valor_descuento: '15.00',
        fecha_inicio: '2030-01-01T08:00:00-04:00',
        fecha_fin: '2030-02-01T08:00:00-04:00',
      })
      .expect(201);
    const promotionOptions = await api()
      .get('/comercial/promociones-opciones')
      .set('Authorization', auth())
      .expect(200);
    expect(
      promotionOptions.body.services.some(
        (item: { id_servicio: number }) => item.id_servicio === serviceId,
      ),
    ).toBe(true);
    await api()
      .put(`/comercial/promociones/${promotion.body.id_promocion}/servicios`)
      .set('Authorization', auth())
      .send({
        servicios: [{ id_servicio: serviceId, sesiones_incluidas: 2 }],
      })
      .expect(200);
    const promotionList = await api()
      .get('/comercial/promociones?search=Terapia&estado=PROGRAMADA')
      .set('Authorization', auth())
      .expect(200);
    const listedPromotion = promotionList.body.data.find(
      (item: { id_promocion: number }) =>
        item.id_promocion === promotion.body.id_promocion,
    );
    expect(listedPromotion.servicios[0].sesiones_incluidas).toBe(2);
    await api()
      .patch(`/comercial/promociones/${promotion.body.id_promocion}`)
      .set('Authorization', auth())
      .send({ estado: 'ACTIVA' })
      .expect(200);
    await api()
      .patch(`/comercial/promociones/${promotion.body.id_promocion}`)
      .set('Authorization', auth())
      .send({ estado: 'FINALIZADA' })
      .expect(200);
    await api()
      .patch(`/comercial/promociones/${promotion.body.id_promocion}`)
      .set('Authorization', auth())
      .send({ nombre: 'No permitido' })
      .expect(400);
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
    const acquisitionOptions = await api()
      .get('/adquisiciones/opciones')
      .set('Authorization', auth())
      .expect(200);
    expect(
      acquisitionOptions.body.offers.some(
        (item: { id: number; tipo: string }) =>
          item.id === pkg.body.id_paquete && item.tipo === 'PAQUETE',
      ),
    ).toBe(true);
    const acquisitionList = await api()
      .get('/adquisiciones?search=Paquete&estado=ACTIVA')
      .set('Authorization', auth())
      .expect(200);
    const listedAcquisition = acquisitionList.body.data.find(
      (item: { id_adquisicion: number }) =>
        item.id_adquisicion === acquisition.body.id_adquisicion,
    );
    expect(listedAcquisition.sesiones_incluidas).toBe(3);

    const application = await api()
      .post('/clinica/solicitudes')
      .set('Authorization', auth())
      .send({
        id_historial: historyId,
        id_servicio: serviceId,
        fecha_solicitud: '2030-01-01T11:00:00-04:00',
      })
      .expect(201);
    const requestOptions = await api()
      .get('/clinica/solicitudes-opciones')
      .set('Authorization', auth())
      .expect(200);
    expect(
      requestOptions.body.services.some(
        (item: { id_servicio: number }) => item.id_servicio === serviceId,
      ),
    ).toBe(true);
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
    const applications = await api()
      .get('/clinica/solicitudes?estado=VALORADO&search=Terapia')
      .set('Authorization', auth())
      .expect(200);
    expect(
      applications.body.data.some(
        (item: { id_solicitud: number; valoraciones: number }) =>
          item.id_solicitud === application.body.id_solicitud &&
          item.valoraciones === 1,
      ),
    ).toBe(true);
    await api()
      .post(`/clinica/valoraciones/${valuation.body.id_valoracion}/medidas`)
      .set('Authorization', auth())
      .send({ id_tipo_medida: measureId, valor: '65.50' })
      .expect(201);
    const valuationOptions = await api()
      .get('/clinica/valoraciones-opciones')
      .set('Authorization', auth())
      .expect(200);
    expect(
      valuationOptions.body.measureTypes.some(
        (item: { id_tipo_medida: number }) =>
          item.id_tipo_medida === measureId,
      ),
    ).toBe(true);
    await api()
      .put(`/clinica/valoraciones/${valuation.body.id_valoracion}/medidas`)
      .set('Authorization', auth())
      .send({
        medidas: [{ id_tipo_medida: measureId, valor: '66.25' }],
      })
      .expect(200);
    const valuations = await api()
      .get('/clinica/valoraciones?tipo=INICIAL&search=Terapia')
      .set('Authorization', auth())
      .expect(200);
    expect(
      valuations.body.data.some(
        (item: { id_valoracion: number; medidas: Array<{ valor: number }> }) =>
          item.id_valoracion === valuation.body.id_valoracion &&
          Number(item.medidas[0]?.valor) === 66.25,
      ),
    ).toBe(true);
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

  it('impide cruces de agenda y gestiona el ciclo de vida de una sesion', async () => {
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
        fecha_hora_inicio: '2025-01-06T09:00:00-04:00',
        fecha_hora_fin: '2025-01-06T09:45:00-04:00',
      })
      .expect(201);
    await api()
      .post('/agenda/citas')
      .set('Authorization', auth())
      .send({
        id_paciente: patientId,
        id_personal: staffId,
        fecha_hora_inicio: '2025-01-06T09:15:00-04:00',
        fecha_hora_fin: '2025-01-06T10:00:00-04:00',
      })
      .expect(400);
    await api()
      .patch(`/agenda/citas/${appointment.body.id_cita}`)
      .set('Authorization', auth())
      .send({
        estado: 'EN_ESPERA',
        fecha_llegada: '2025-01-06T08:55:00-04:00',
      })
      .expect(200);
    const session = await api()
      .post('/clinica/sesiones')
      .set('Authorization', auth())
      .send({
        id_tratamiento: treatment.id_tratamiento,
        id_cita: appointment.body.id_cita,
        atendido_por: staffId,
        fecha_sesion: '2025-01-06T09:00:00-04:00',
      })
      .expect(201);
    expect(session.body.id_cita).toBe(appointment.body.id_cita);
    expect(session.body.estado).toBe('EN_CURSO');
    expect(session.body.finalizada_en).toBeNull();

    const waiting = await api()
      .get(`/agenda/citas/${appointment.body.id_cita}`)
      .set('Authorization', auth())
      .expect(200);
    expect(waiting.body.estado).toBe('EN_ESPERA');

    await api()
      .post('/clinica/sesiones')
      .set('Authorization', auth())
      .send({
        id_tratamiento: treatment.id_tratamiento,
        id_cita: appointment.body.id_cita,
        atendido_por: staffId,
        fecha_sesion: '2025-01-06T09:05:00-04:00',
      })
      .expect(400);

    const cancelled = await api()
      .patch(`/clinica/sesiones/${session.body.id_sesion}/cancelar`)
      .set('Authorization', auth())
      .expect(200);
    expect(cancelled.body.estado).toBe('CANCELADA');
    expect(cancelled.body.finalizada_en).toBeNull();

    const optionsAfterCancellation = await api()
      .get('/clinica/sesiones-opciones')
      .set('Authorization', auth())
      .expect(200);
    expect(
      optionsAfterCancellation.body.appointments.some(
        (item: { id_cita: number }) =>
          item.id_cita === appointment.body.id_cita,
      ),
    ).toBe(true);

    const restarted = await api()
      .post('/clinica/sesiones')
      .set('Authorization', auth())
      .send({
        id_tratamiento: treatment.id_tratamiento,
        id_cita: appointment.body.id_cita,
        atendido_por: staffId,
        fecha_sesion: '2025-01-06T09:10:00-04:00',
      })
      .expect(201);
    expect(restarted.body.estado).toBe('EN_CURSO');
    expect(restarted.body.id_sesion).not.toBe(session.body.id_sesion);

    const finished = await api()
      .patch(`/clinica/sesiones/${restarted.body.id_sesion}/finalizar`)
      .set('Authorization', auth())
      .expect(200);
    expect(finished.body.estado).toBe('FINALIZADA');
    expect(finished.body.finalizada_en).toBeTruthy();

    await api()
      .patch(`/clinica/sesiones/${restarted.body.id_sesion}/cancelar`)
      .set('Authorization', auth())
      .expect(400);

    const attended = await api()
      .get(`/agenda/citas/${appointment.body.id_cita}`)
      .set('Authorization', auth())
      .expect(200);
    expect(attended.body.estado).toBe('ATENDIDA');

    const sessions = await api()
      .get(`/clinica/sesiones?id_tratamiento=${treatment.id_tratamiento}`)
      .set('Authorization', auth())
      .expect(200);
    expect(sessions.body.total).toBe(2);
    expect(
      sessions.body.data.map((item: { estado: string }) => item.estado),
    ).toEqual(expect.arrayContaining(['CANCELADA', 'FINALIZADA']));
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
    const inventoryOptions = await api()
      .get('/inventario/opciones')
      .set('Authorization', auth())
      .expect(200);
    expect(
      inventoryOptions.body.lots.some(
        (item: { id_lote: number }) => item.id_lote === lot.body.id_lote,
      ),
    ).toBe(true);
    const products = await api()
      .get('/inventario/productos?search=Aceite&estado=ACTIVO')
      .set('Authorization', auth())
      .expect(200);
    const listedProduct = products.body.data.find(
      (item: { id_producto: number }) =>
        item.id_producto === product.body.id_producto,
    );
    expect(listedProduct.stock_actual).toBe('100.00');
    const lots = await api()
      .get('/inventario/lotes?search=E2E-001&estado=DISPONIBLE')
      .set('Authorization', auth())
      .expect(200);
    expect(lots.body.data[0].stock_actual).toBe('100.00');
    const movements = await api()
      .get('/inventario/movimientos?tipo=ENTRADA_COMPRA&search=Aceite')
      .set('Authorization', auth())
      .expect(200);
    expect(movements.body.data[0].tipo).toBe('ENTRADA_COMPRA');
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
    const saleOptions = await api()
      .get('/ventas/opciones')
      .set('Authorization', auth())
      .expect(200);
    expect(
      saleOptions.body.notes.some(
        (item: { id_nota_venta: number }) =>
          item.id_nota_venta === note.body.id_nota_venta,
      ),
    ).toBe(true);
    const saleNotes = await api()
      .get('/ventas/notas?search=E2E-0001&estado=EMITIDA')
      .set('Authorization', auth())
      .expect(200);
    expect(saleNotes.body.data[0].saldo).toBe('20.00');
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
    const payments = await api()
      .get('/ventas/pagos?search=E2E-0001&tipo=QR&estado=REGISTRADO')
      .set('Authorization', auth())
      .expect(200);
    expect(payments.body.data[0].monto).toBe('15.00');
    const updatedNotes = await api()
      .get('/ventas/notas?search=E2E-0001')
      .set('Authorization', auth())
      .expect(200);
    expect(updatedNotes.body.data[0].saldo).toBe('5.00');
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
    const operationOptions = await api()
      .get('/inventario/operaciones-opciones')
      .set('Authorization', auth())
      .expect(200);
    expect(Array.isArray(operationOptions.body.lots)).toBe(true);
    const consumptions = await api()
      .get('/inventario/consumos-sesion?search=Aceite')
      .set('Authorization', auth())
      .expect(200);
    expect(consumptions.body.data[0].cantidad).toBe('5.00');
    const saleOutputs = await api()
      .get('/inventario/salidas-venta?search=Aceite')
      .set('Authorization', auth())
      .expect(200);
    expect(saleOutputs.body.data[0].cantidad).toBe('2.00');
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
    const companies = await api()
      .get('/empresa?search=Warmi')
      .set('Authorization', auth())
      .expect(200);
    expect(companies.body.data[0].nombre_comercial).toBe('Warmi E2E');
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
      expect(history.body.total).toBeGreaterThan(0);
      await api()
        .post('/' + resource)
        .set('Authorization', auth())
        .send({})
        .expect(404);
    }
    await api()
      .patch('/usuarios/' + userId)
      .set('Authorization', auth())
      .send({ nombre_usuario: 'usuario-auditado' })
      .expect(200);
    const audit = await api()
      .get('/auditoria?limit=100')
      .set('Authorization', auth())
      .expect(200);
    expect(audit.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accion: 'USUARIO_ACTUALIZADO',
          id_usuario_accion: 1,
          id_usuario_afectado: userId,
          entidad: 'usuarios',
        }),
      ]),
    );
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
    const blockedLogin = await api()
      .post('/auth/login')
      .send({ correo_acceso: 'user@test.local', contrasena: password })
      .expect(401);
    expect(blockedLogin.body.message).toContain('Vuelve a intentarlo en');
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
      .send({ motivo_baja: 'Baja directa de prueba' })
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
    expect(user.body.motivo_estado).toBe('Baja directa de prueba');
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
