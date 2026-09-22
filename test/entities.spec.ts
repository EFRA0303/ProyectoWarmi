import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { entities } from '../dist/database/entities.js';

class MetadataSource extends DataSource {
  async inspect() {
    await this.buildMetadatas();
  }
}

describe('Modelo TypeORM del diagrama', () => {
  const db = new MetadataSource({
    type: 'postgres',
    entities,
    synchronize: false,
  });
  beforeAll(async () => {
    await db.inspect();
  });
  const entity = (table: string) =>
    db.entityMetadatas.find((m) => m.tableName === table)!;
  const column = (table: string, name: string) =>
    entity(table).columns.find((c) => c.databaseName === name)!;

  it('registra exactamente las once tablas', () => {
    expect(db.entityMetadatas.map((m) => m.tableName).sort()).toEqual(
      [
        'personas',
        'pacientes',
        'usuarios',
        'personal',
        'roles',
        'permisos',
        'roles_permisos',
        'usuarios_permisos',
        'accesos_usuario',
        'auditoria',
        'configuracion_auditoria',
      ].sort(),
    );
  });

  it('resuelve todas las relaciones con integridad referencial', () => {
    for (const metadata of db.entityMetadatas) {
      for (const relation of metadata.relations) {
        expect(relation.inverseEntityMetadata).toBeDefined();
        if (relation.isOwning) {
          expect(relation.foreignKeys).toHaveLength(1);
          expect(relation.onDelete).toBe('RESTRICT');
        }
      }
    }
  });

  it.each(['roles_permisos', 'usuarios_permisos'])(
    '%s tiene PK compuesta',
    (table) => {
      expect(entity(table).primaryColumns).toHaveLength(2);
      expect(column(table, 'created_by').isNullable).toBe(false);
      expect(column(table, 'created_at').isCreateDate).toBe(true);
    },
  );

  it('respeta autores requeridos y excepcion para el administrador inicial', () => {
    expect(column('usuarios', 'created_by').isNullable).toBe(true);
    for (const table of ['personal', 'pacientes'])
      expect(column(table, 'created_by').isNullable).toBe(false);
    for (const table of ['usuarios', 'personal', 'pacientes']) {
      expect(column(table, 'updated_by').isNullable).toBe(true);
      expect(column(table, 'updated_at').isNullable).toBe(false);
      expect(column(table, 'updated_at').isUpdateDate).toBe(true);
    }
  });

  it('mantiene estados sin aprobacion y secretos fuera de consultas normales', () => {
    expect(column('usuarios', 'estado').enum).toEqual([
      'ACTIVO',
      'BAJA',
      'BLOQUEADO',
    ]);
    expect(column('usuarios', 'contrasena_hash').isSelect).toBe(false);
    expect(column('usuarios', 'token_recuperacion_hash').isSelect).toBe(false);
    for (const field of ['autorizado_por', 'autorizado_en', 'motivo_rechazo'])
      expect(column('usuarios', field)).toBeUndefined();
  });

  it('preserva BIGINT y acceso sin usuario conocido', () => {
    expect(column('auditoria', 'id_auditoria').type).toBe('bigint');
    expect(column('accesos_usuario', 'id_acceso').type).toBe('bigint');
    expect(column('auditoria', 'id_registro').type).toBe('bigint');
    expect(column('accesos_usuario', 'id_usuario').isNullable).toBe(true);
    expect(column('auditoria', 'id_usuario_accion').isNullable).toBe(false);
  });

  it('unifica los cuatro campos sin agregar borrado logico', () => {
    for (const table of [
      'personas',
      'pacientes',
      'usuarios',
      'personal',
      'roles',
      'permisos',
      'roles_permisos',
      'usuarios_permisos',
      'configuracion_auditoria',
    ]) {
      expect(column(table, 'created_at').isCreateDate).toBe(true);
      expect(column(table, 'updated_at').isUpdateDate).toBe(true);
      expect(column(table, 'created_by').type).toBe('integer');
      expect(column(table, 'updated_by').type).toBe('integer');
      expect(entity(table).deleteDateColumn).toBeUndefined();
    }
  });
});
