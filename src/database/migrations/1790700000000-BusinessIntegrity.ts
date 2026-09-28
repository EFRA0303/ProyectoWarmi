import { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessIntegrity1790700000000 implements MigrationInterface {
  name = 'BusinessIntegrity1790700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_consumo_sesion_lote
      ON consumos_sesion(id_sesion, id_lote)
    `);
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_salida_detalle_lote
      ON salidas_producto_venta(id_detalle, id_lote)
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_citas_paciente_inicio
      ON citas(id_paciente, fecha_hora_inicio)
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_pagos_nota_estado
      ON pagos(id_nota_venta, estado)
    `);
    await q.query(`DO $$ BEGIN
      ALTER TABLE detalles_adquisicion
        ADD CONSTRAINT chk_detalle_adquisicion_calculado
        CHECK (subtotal = ROUND(precio_unitario * sesiones_incluidas - descuento, 2))
        NOT VALID;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q.query(`DO $$ BEGIN
      ALTER TABLE detalles_nota_venta
        ADD CONSTRAINT chk_detalle_nota_calculado
        CHECK (subtotal = ROUND(precio_unitario * cantidad - descuento, 2))
        NOT VALID;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE detalles_nota_venta DROP CONSTRAINT IF EXISTS chk_detalle_nota_calculado',
    );
    await q.query(
      'ALTER TABLE detalles_adquisicion DROP CONSTRAINT IF EXISTS chk_detalle_adquisicion_calculado',
    );
    await q.query('DROP INDEX IF EXISTS idx_pagos_nota_estado');
    await q.query('DROP INDEX IF EXISTS idx_citas_paciente_inicio');
    await q.query('DROP INDEX IF EXISTS uq_salida_detalle_lote');
    await q.query('DROP INDEX IF EXISTS uq_consumo_sesion_lote');
  }
}
