import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductCatalogStructure1792300000000
  implements MigrationInterface
{
  name = 'ProductCatalogStructure1792300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categorias_producto" (
        "id_categoria_producto" SERIAL NOT NULL,
        "nombre" varchar(100) NOT NULL,
        "descripcion" varchar(255),
        "estado" "estado_general" NOT NULL DEFAULT 'ACTIVO',
        CONSTRAINT "UQ_categorias_producto_nombre" UNIQUE ("nombre"),
        CONSTRAINT "PK_categorias_producto" PRIMARY KEY ("id_categoria_producto")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "categorias_producto" ("nombre", "descripcion")
      VALUES ('Sin categoría', 'Productos pendientes de clasificación')
    `);
    await queryRunner.query(
      'ALTER TABLE "productos" ADD COLUMN "id_categoria_producto" integer',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" ADD COLUMN "marca" varchar(100)',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" ADD COLUMN "sku" varchar(80)',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" ADD COLUMN "codigo_barras" varchar(80)',
    );
    await queryRunner.query(
      `ALTER TABLE "productos" ADD COLUMN "presentacion" varchar(50) NOT NULL DEFAULT 'Unidad'`,
    );
    await queryRunner.query(
      'ALTER TABLE "productos" ADD COLUMN "contenido_presentacion" numeric(12,3) NOT NULL DEFAULT 1',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" ADD COLUMN "precio_venta" numeric(12,2)',
    );
    await queryRunner.query(`
      UPDATE "productos"
      SET "id_categoria_producto" = (
        SELECT "id_categoria_producto" FROM "categorias_producto"
        WHERE "nombre" = 'Sin categoría'
      ), "es_insumo" = TRUE
      WHERE "id_categoria_producto" IS NULL
    `);
    await queryRunner.query(
      'ALTER TABLE "productos" ALTER COLUMN "id_categoria_producto" SET NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_productos_sku" ON "productos" (LOWER("sku")) WHERE "sku" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_productos_codigo_barras" ON "productos" (LOWER("codigo_barras")) WHERE "codigo_barras" IS NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" ADD CONSTRAINT "CHK_productos_contenido_presentacion" CHECK ("contenido_presentacion" > 0)',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" ADD CONSTRAINT "CHK_productos_precio_venta" CHECK ("precio_venta" IS NULL OR "precio_venta" >= 0)',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" ADD CONSTRAINT "CHK_productos_uso" CHECK ("es_insumo" OR "es_vendible")',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" ADD CONSTRAINT "FK_productos_categoria" FOREIGN KEY ("id_categoria_producto") REFERENCES "categorias_producto"("id_categoria_producto") ON DELETE RESTRICT',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "productos" DROP CONSTRAINT IF EXISTS "FK_productos_categoria"',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" DROP CONSTRAINT IF EXISTS "CHK_productos_uso"',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" DROP CONSTRAINT IF EXISTS "CHK_productos_precio_venta"',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" DROP CONSTRAINT IF EXISTS "CHK_productos_contenido_presentacion"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_productos_codigo_barras"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_productos_sku"');
    await queryRunner.query(
      'ALTER TABLE "productos" DROP COLUMN IF EXISTS "precio_venta"',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" DROP COLUMN IF EXISTS "contenido_presentacion"',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" DROP COLUMN IF EXISTS "presentacion"',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" DROP COLUMN IF EXISTS "codigo_barras"',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" DROP COLUMN IF EXISTS "sku"',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" DROP COLUMN IF EXISTS "marca"',
    );
    await queryRunner.query(
      'ALTER TABLE "productos" DROP COLUMN IF EXISTS "id_categoria_producto"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "categorias_producto"');
  }
}
