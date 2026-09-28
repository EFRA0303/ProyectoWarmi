import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogoServicios1790500000000 implements MigrationInterface {
  name = 'CatalogoServicios1790500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "areas" (
        "id_area" SERIAL NOT NULL,
        "nombre" character varying(100) NOT NULL,
        "descripcion" character varying(255),
        "estado" "public"."estado_general" NOT NULL DEFAULT 'ACTIVO',
        CONSTRAINT "PK_areas" PRIMARY KEY ("id_area"),
        CONSTRAINT "UQ_areas_nombre" UNIQUE ("nombre")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categorias_servicio" (
        "id_categoria" SERIAL NOT NULL,
        "id_area" integer NOT NULL,
        "nombre" character varying(100) NOT NULL,
        "descripcion" character varying(255),
        "estado" "public"."estado_general" NOT NULL DEFAULT 'ACTIVO',
        CONSTRAINT "PK_categorias_servicio" PRIMARY KEY ("id_categoria"),
        CONSTRAINT "UQ_categoria_area_nombre" UNIQUE ("id_area", "nombre"),
        CONSTRAINT "FK_categorias_servicio_area"
          FOREIGN KEY ("id_area") REFERENCES "areas"("id_area")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "servicios" (
        "id_servicio" SERIAL NOT NULL,
        "id_categoria" integer NOT NULL,
        "nombre" character varying(100) NOT NULL,
        "duracion_minutos" integer NOT NULL,
        "descripcion" character varying(255),
        "requiere_valoracion" boolean NOT NULL DEFAULT false,
        "estado" "public"."estado_general" NOT NULL DEFAULT 'ACTIVO',
        CONSTRAINT "PK_servicios" PRIMARY KEY ("id_servicio"),
        CONSTRAINT "UQ_servicio_categoria_nombre"
          UNIQUE ("id_categoria", "nombre"),
        CONSTRAINT "CHK_servicios_duracion" CHECK ("duracion_minutos" > 0),
        CONSTRAINT "FK_servicios_categoria"
          FOREIGN KEY ("id_categoria")
          REFERENCES "categorias_servicio"("id_categoria")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tipos_medida" (
        "id_tipo_medida" SERIAL NOT NULL,
        "nombre" character varying(80) NOT NULL,
        "unidad" character varying(20),
        "estado" "public"."estado_general" NOT NULL DEFAULT 'ACTIVO',
        CONSTRAINT "PK_tipos_medida" PRIMARY KEY ("id_tipo_medida"),
        CONSTRAINT "UQ_tipos_medida_nombre" UNIQUE ("nombre")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "servicios_medidas" (
        "id_servicio" integer NOT NULL,
        "id_tipo_medida" integer NOT NULL,
        "obligatorio" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_servicios_medidas"
          PRIMARY KEY ("id_servicio", "id_tipo_medida"),
        CONSTRAINT "FK_servicios_medidas_servicio"
          FOREIGN KEY ("id_servicio") REFERENCES "servicios"("id_servicio")
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_servicios_medidas_tipo"
          FOREIGN KEY ("id_tipo_medida")
          REFERENCES "tipos_medida"("id_tipo_medida")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'No se revierte automaticamente: eliminaria el catalogo de servicios.',
    );
  }
}
