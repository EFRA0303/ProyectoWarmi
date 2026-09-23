import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AccessAuditEvents1790000001000 implements MigrationInterface {
  name = 'AccessAuditEvents1790000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO configuracion_auditoria
        (codigo_evento, nombre, descripcion, categoria, habilitado, es_obligatorio)
      VALUES
        ('LOGIN_EXITOSO', 'Inicio de sesion exitoso', 'Registra autenticaciones exitosas', 'SEGURIDAD', true, true),
        ('LOGIN_FALLIDO', 'Inicio de sesion fallido', 'Registra autenticaciones fallidas', 'SEGURIDAD', true, true),
        ('LOGOUT', 'Cierre de sesion', 'Registra el cierre de una sesion', 'SEGURIDAD', true, true),
        ('USUARIO_BLOQUEADO', 'Usuario bloqueado', 'Registra bloqueos por intentos fallidos', 'SEGURIDAD', true, true),
        ('CAMBIO_CONTRASENA', 'Cambio de contrasena', 'Registra cambios y restablecimientos de contrasena', 'SEGURIDAD', true, true)
      ON CONFLICT (codigo_evento) DO UPDATE
      SET habilitado = true, es_obligatorio = true
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_accesos_usuario_usuario_fecha"
      ON "accesos_usuario" ("id_usuario", "fecha_login" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_accesos_usuario_resultado_fecha"
      ON "accesos_usuario" ("login_exitoso", "fecha_login" DESC)
    `);
    await queryRunner.query(`
      ALTER TABLE "configuracion_auditoria"
      ADD CONSTRAINT "CHK_configuracion_auditoria_obligatorio_habilitado"
      CHECK (NOT "es_obligatorio" OR "habilitado")
    `);
    await queryRunner.query(`
      INSERT INTO permisos (permiso, descripcion, estado)
      VALUES (
        'accesos-usuario.eliminar',
        'Permite eliminar historiales de acceso',
        'ACTIVO'
      )
      ON CONFLICT (permiso) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO roles_permisos (id_rol, id_permiso, created_by)
      SELECT reader.id_rol, delete_permission.id_permiso, reader.created_by
      FROM roles_permisos reader
      INNER JOIN permisos read_permission
        ON read_permission.id_permiso = reader.id_permiso
      CROSS JOIN permisos delete_permission
      WHERE read_permission.permiso = 'accesos-usuario.leer'
        AND delete_permission.permiso = 'accesos-usuario.eliminar'
      ON CONFLICT (id_rol, id_permiso) DO NOTHING
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'No se revierte automaticamente: eliminaria configuraciones de seguridad.',
    );
  }
}
