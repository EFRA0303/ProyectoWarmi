import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceConfiguration1793300000000 implements MigrationInterface {
  name = 'ServiceConfiguration1793300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Un servicio anterior representa una sesión. No recalcular adquisiciones históricas.
    await queryRunner.query(`ALTER TABLE servicios ADD COLUMN sesiones_incluidas integer NOT NULL DEFAULT 1,
      ADD CONSTRAINT "CHK_servicios_sesiones" CHECK (sesiones_incluidas > 0)`);
    await queryRunner.query(`ALTER TABLE servicios_medidas ADD COLUMN momentos text[] NOT NULL DEFAULT ARRAY['INICIAL', 'FINAL']::text[],
      ADD CONSTRAINT "CHK_servicios_medidas_momentos" CHECK (
        cardinality(momentos) BETWEEN 1 AND 3
        AND momentos <@ ARRAY['INICIAL', 'CADA_SESION', 'FINAL']::text[]
        AND array_position(momentos, NULL) IS NULL)`);
    await queryRunner.query(`ALTER TABLE detalles_adquisicion
      ADD COLUMN precio_total_servicio_snapshot numeric(10,2),
      ADD COLUMN sesiones_servicio_snapshot integer,
      DROP CONSTRAINT chk_detalle_adquisicion_calculado,
      ADD CONSTRAINT "CHK_detalle_adquisicion_precio_total" CHECK (
        (precio_total_servicio_snapshot IS NULL AND sesiones_servicio_snapshot IS NULL
          AND subtotal = ROUND(precio_unitario * sesiones_incluidas - descuento, 2)) OR
        (precio_total_servicio_snapshot IS NOT NULL AND sesiones_servicio_snapshot IS NOT NULL
          AND precio_total_servicio_snapshot >= 0 AND sesiones_servicio_snapshot > 0
          AND precio_unitario = ROUND(precio_total_servicio_snapshot / sesiones_servicio_snapshot, 2)
          AND subtotal = ROUND(precio_total_servicio_snapshot * sesiones_incluidas / sesiones_servicio_snapshot, 2) - descuento))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM detalles_adquisicion WHERE precio_total_servicio_snapshot IS NOT NULL) THEN
        RAISE EXCEPTION 'No se puede revertir: existen adquisiciones con precio total del servicio';
      END IF;
    END $$`);
    await queryRunner.query(`ALTER TABLE detalles_adquisicion
      DROP CONSTRAINT "CHK_detalle_adquisicion_precio_total",
      DROP COLUMN precio_total_servicio_snapshot,
      DROP COLUMN sesiones_servicio_snapshot,
      ADD CONSTRAINT chk_detalle_adquisicion_calculado CHECK (subtotal = ROUND(precio_unitario * sesiones_incluidas - descuento, 2))`);
    await queryRunner.query(
      `ALTER TABLE servicios_medidas DROP CONSTRAINT "CHK_servicios_medidas_momentos", DROP COLUMN momentos`,
    );
    await queryRunner.query(
      `ALTER TABLE servicios DROP CONSTRAINT "CHK_servicios_sesiones", DROP COLUMN sesiones_incluidas`,
    );
  }
}
