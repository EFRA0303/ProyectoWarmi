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

  it('registra exactamente las cuarenta y seis tablas', () => {
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
        'historiales',
        'horarios_personal',
        'horarios_extra_personal',
        'bloqueos_personal',
        'areas',
        'categorias_servicio',
        'servicios',
        'tipos_medida',
        'servicios_medidas',
        'paquetes',
        'paquetes_servicios',
        'promociones',
        'promociones_servicios',
        'adquisiciones',
        'detalles_adquisicion',
        'solicitudes_servicio',
        'tratamientos_paciente',
        'ampliaciones_tratamiento',
        'sesiones',
        'valoraciones',
        'valoraciones_medidas',
        'citas',
        'reprogramaciones_cita',
        'notificaciones_cita',
        'notas_venta',
        'detalles_nota_venta',
        'pagos',
        'productos',
        'lotes_producto',
        'servicios_productos',
        'movimientos_inventario',
        'consumos_sesion',
        'salidas_producto_venta',
        'empresas',
        'configuraciones_documentos',
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

  it('modela un unico historial por paciente', () => {
    expect(
      entity('historiales').uniques.some((unique) =>
        unique.columns.some(
          (uniqueColumn) => uniqueColumn.databaseName === 'id_paciente',
        ),
      ),
    ).toBe(true);
    expect(column('historiales', 'fecha_apertura').isCreateDate).toBe(true);
    expect(column('historiales', 'estado').enum).toEqual(['ACTIVO', 'CERRADO']);
    expect(entity('historiales').relations).toHaveLength(1);
  });

  it('modela la disponibilidad del personal y sus rangos validos', () => {
    expect(column('horarios_personal', 'dia_semana').enum).toEqual([
      'LUNES',
      'MARTES',
      'MIERCOLES',
      'JUEVES',
      'VIERNES',
      'SABADO',
      'DOMINGO',
    ]);
    expect(column('horarios_personal', 'estado').type).toBe('boolean');
    expect(column('horarios_extra_personal', 'estado').enum).toEqual([
      'AUTORIZADO',
      'CANCELADO',
    ]);
    expect(column('horarios_extra_personal', 'autorizado_por').type).toBe(
      'integer',
    );
    expect(column('bloqueos_personal', 'fecha_hora_inicio').type).toBe(
      'timestamptz',
    );
    for (const table of [
      'horarios_personal',
      'horarios_extra_personal',
      'bloqueos_personal',
    ])
      expect(entity(table).checks.length).toBeGreaterThanOrEqual(2);
  });

  it('modela el catalogo y las medidas configurables por servicio', () => {
    expect(entity('servicios_medidas').primaryColumns).toHaveLength(2);
    expect(column('servicios', 'duracion_minutos').type).toBe('integer');
    expect(column('servicios', 'requiere_valoracion').default).toBe(false);
    expect(
      entity('categorias_servicio').uniques.some(
        (unique) => unique.columns.length === 2,
      ),
    ).toBe(true);
    expect(
      entity('servicios').uniques.some((unique) => unique.columns.length === 2),
    ).toBe(true);
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
