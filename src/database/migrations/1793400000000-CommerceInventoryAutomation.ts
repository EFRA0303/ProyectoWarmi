import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CommerceInventoryAutomation1793400000000 implements MigrationInterface {
  name = 'CommerceInventoryAutomation1793400000000';
  async up(runner: QueryRunner): Promise<void> {
    for (const table of ['adquisiciones', 'notas_venta', 'pagos', 'lotes_producto', 'movimientos_inventario']) {
      await runner.query(`ALTER TABLE ${table} ADD COLUMN clave_operacion uuid UNIQUE, ADD COLUMN huella_operacion varchar(64), ADD CONSTRAINT "CHK_${table}_operacion" CHECK ((clave_operacion IS NULL) = (huella_operacion IS NULL))`);
    }
    for (const table of ['adquisiciones', 'notas_venta', 'pagos']) await runner.query(`ALTER TABLE ${table} ADD COLUMN anulado_por integer REFERENCES usuarios(id_usuario) ON DELETE RESTRICT, ADD COLUMN motivo_anulacion varchar(255)`);
    // Lo histórico sigue expresado en la unidad que tenía al registrarse. No convertir salidas previas.
    await runner.query(`ALTER TABLE detalles_nota_venta ADD COLUMN factor_stock numeric(12,3) NOT NULL DEFAULT 1, ADD CONSTRAINT "CHK_detalles_nota_factor_stock" CHECK (factor_stock > 0)`);
    await runner.query(`DROP INDEX uq_salida_detalle_lote`);
  }
  async down(runner: QueryRunner): Promise<void> {
    for (const table of ['adquisiciones', 'notas_venta', 'pagos']) await runner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM ${table} WHERE anulado_por IS NOT NULL OR motivo_anulacion IS NOT NULL) THEN RAISE EXCEPTION 'Existen anulaciones trazables; no es seguro revertir'; END IF; END $$`);
    await runner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM salidas_producto_venta GROUP BY id_detalle,id_lote HAVING COUNT(*)>1) THEN RAISE EXCEPTION 'Existen entregas parciales; no es seguro revertir'; END IF; END $$`);
    for (const table of ['adquisiciones', 'notas_venta', 'pagos', 'lotes_producto', 'movimientos_inventario']) {
      await runner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM ${table} WHERE clave_operacion IS NOT NULL) THEN RAISE EXCEPTION 'Existen operaciones trazables; no es seguro revertir esta migración'; END IF; END $$`);
    }
    await runner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM detalles_nota_venta WHERE factor_stock <> 1) THEN RAISE EXCEPTION 'Existen ventas con conversión de stock; no es seguro revertir'; END IF; END $$`);
    await runner.query(`CREATE UNIQUE INDEX uq_salida_detalle_lote ON salidas_producto_venta(id_detalle,id_lote)`);
    await runner.query(`ALTER TABLE detalles_nota_venta DROP CONSTRAINT "CHK_detalles_nota_factor_stock", DROP COLUMN factor_stock`);
    for (const table of ['adquisiciones', 'notas_venta', 'pagos']) await runner.query(`ALTER TABLE ${table} DROP COLUMN anulado_por, DROP COLUMN motivo_anulacion`);
    for (const table of ['adquisiciones', 'notas_venta', 'pagos', 'lotes_producto', 'movimientos_inventario']) await runner.query(`ALTER TABLE ${table} DROP CONSTRAINT "CHK_${table}_operacion", DROP COLUMN clave_operacion, DROP COLUMN huella_operacion`);
  }
}
