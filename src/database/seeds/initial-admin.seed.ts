import type { DataSource, EntityManager } from 'typeorm';
import { hashPassword } from '../../common/utils/password.js';
import { requiredEnv } from '../../config/env.validation.js';

const ADMIN_ROLE = 'ROOT';
const ADMIN_USERNAME = 'root';
const ADMIN_CI = 'ROOT-001';

const permissions = [
  'personas.crear',
  'personas.leer',
  'personas.actualizar',
  'pacientes.crear',
  'pacientes.leer',
  'pacientes.actualizar',
  'usuarios.crear',
  'usuarios.leer',
  'usuarios.actualizar',
  'personal.crear',
  'personal.leer',
  'personal.actualizar',
  'roles.crear',
  'roles.leer',
  'roles.actualizar',
  'roles.asignar',
  'permisos.crear',
  'permisos.leer',
  'permisos.actualizar',
  'permisos.asignar',
  'configuracion-auditoria.crear',
  'configuracion-auditoria.leer',
  'configuracion-auditoria.actualizar',
  'auditoria.leer',
  'accesos-usuario.leer',
];

type IdRow = { id: number };

async function getOrCreateRole(manager: EntityManager) {
  await manager.query(
    `INSERT INTO roles (nombre, descripcion, estado)
    VALUES ($1, $2, 'ACTIVO')
    ON CONFLICT (nombre) DO NOTHING`,
    [ADMIN_ROLE, 'Administrador principal del sistema'],
  );
  const [role] = (await manager.query(
    'SELECT id_rol AS id FROM roles WHERE nombre = $1',
    [ADMIN_ROLE],
  )) as IdRow[];
  if (!role) throw new Error('No se pudo obtener el rol ROOT');
  return role.id;
}

async function createPermissions(manager: EntityManager) {
  for (const permission of permissions) {
    await manager.query(
      `INSERT INTO permisos (permiso, descripcion, estado)
      VALUES ($1, $2, 'ACTIVO')
      ON CONFLICT (permiso) DO NOTHING`,
      [permission, `Permiso ${permission}`],
    );
  }
}

export async function seedInitialAdmin(dataSource: DataSource) {
  const email = requiredEnv('ADMIN_EMAIL').toLowerCase();
  const password = requiredEnv('ADMIN_PASSWORD');
  const phone = requiredEnv('ADMIN_PHONE');
  const passwordHash = await hashPassword(password);

  await dataSource.transaction(async (manager) => {
    const roleId = await getOrCreateRole(manager);
    await createPermissions(manager);

    let [user] = (await manager.query(
      'SELECT id_usuario AS id, id_rol FROM usuarios WHERE correo_acceso = $1',
      [email],
    )) as Array<{ id: number; id_rol: number }>;

    if (user && user.id_rol !== roleId) {
      throw new Error(
        `El usuario ${email} ya existe con un rol diferente a ROOT`,
      );
    }

    if (!user) {
      await manager.query(
        `INSERT INTO personas (
          nombre, ap_paterno, ap_materno, ci, genero, telefono1
        ) VALUES ($1, $2, $3, $4, 'MASCULINO', $5)
        ON CONFLICT (telefono1) DO NOTHING`,
        ['Root', 'Administrador', null, ADMIN_CI, phone],
      );
      const [person] = (await manager.query(
        'SELECT id_persona AS id FROM personas WHERE telefono1 = $1',
        [phone],
      )) as IdRow[];
      if (!person) throw new Error('No se pudo obtener la persona root');

      await manager.query(
        `INSERT INTO usuarios (
          id_persona, id_rol, correo_acceso, nombre_usuario,
          contrasena_hash, estado
        ) VALUES ($1, $2, $3, $4, $5, 'ACTIVO')`,
        [person.id, roleId, email, ADMIN_USERNAME, passwordHash],
      );
      [user] = (await manager.query(
        'SELECT id_usuario AS id, id_rol FROM usuarios WHERE correo_acceso = $1',
        [email],
      )) as Array<{ id: number; id_rol: number }>;
    }

    if (!user) throw new Error('No se pudo obtener el usuario root');

    await manager.query(
      `INSERT INTO roles_permisos (id_rol, id_permiso, created_by)
      SELECT $1, id_permiso, $2
      FROM permisos
      WHERE estado = 'ACTIVO'
      ON CONFLICT (id_rol, id_permiso) DO NOTHING`,
      [roleId, user.id],
    );

    console.log(`Usuario inicial disponible: ${email} (id ${user.id})`);
  });
}