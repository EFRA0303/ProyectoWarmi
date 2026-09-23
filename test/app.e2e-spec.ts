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
  let userId: number;
  let roleId: number;
  let configId: number;
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
      migrations: [PostmanSchema1790000000000, AccessAuditEvents1790000001000],
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
    const down = await api()
      .patch('/personal/' + employee.body.id_personal + '/baja')
      .set('Authorization', auth())
      .send({})
      .expect(200);
    expect(down.body.estado).toBe('BAJA');
    expect(down.body.updated_by).toBe(1);
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
