import { MigrationInterface, QueryRunner } from 'typeorm';

export class TreatmentPermissions1791200000000 implements MigrationInterface {
  name = 'TreatmentPermissions1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO permisos (permiso, descripcion, estado)
      VALUES
        ('tratamientos.leer', 'Consultar tratamientos y su progreso', 'ACTIVO'),
        ('tratamientos.crear', 'Crear tratamientos para pacientes', 'ACTIVO'),
        ('tratamientos.actualizar', 'Actualizar tratamientos y ampliar sesiones', 'ACTIVO'),
        ('tratamientos.cancelar', 'Cancelar tratamientos de forma lógica', 'ACTIVO')
      ON CONFLICT (permiso) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO roles_permisos (id_rol, id_permiso, created_by)
      SELECT r.id_rol, p.id_permiso, u.id_usuario
      FROM roles r
      JOIN usuarios u ON u.id_rol = r.id_rol
      CROSS JOIN permisos p
      WHERE r.nombre = 'ROOT'
        AND p.permiso IN (
          'tratamientos.leer',
          'tratamientos.crear',
          'tratamientos.actualizar',
          'tratamientos.cancelar'
        )
      ON CONFLICT (id_rol, id_permiso) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM roles_permisos
      WHERE id_permiso IN (
        SELECT id_permiso FROM permisos
        WHERE permiso IN (
          'tratamientos.leer',
          'tratamientos.crear',
          'tratamientos.actualizar',
          'tratamientos.cancelar'
        )
      )
    `);
    await queryRunner.query(`
      DELETE FROM permisos
      WHERE permiso IN (
        'tratamientos.leer',
        'tratamientos.crear',
        'tratamientos.actualizar',
        'tratamientos.cancelar'
      )
    `);
  }
}
