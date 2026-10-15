import type { MigrationInterface, QueryRunner } from 'typeorm';

export class HolidayCalendar1792700000000 implements MigrationInterface {
  name = 'HolidayCalendar1792700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feriados" (
        "id_feriado" SERIAL NOT NULL,
        "id_configuracion_horario" integer NOT NULL,
        "tipo" varchar(10) NOT NULL,
        "nombre" varchar(150) NOT NULL,
        "mes" smallint,
        "dia" smallint,
        "fecha" date,
        CONSTRAINT "PK_feriados" PRIMARY KEY ("id_feriado"),
        CONSTRAINT "CHK_feriados_tipo" CHECK ("tipo" IN ('FIJO', 'DINAMICO')),
        CONSTRAINT "CHK_feriados_fecha_tipo" CHECK (("tipo" = 'FIJO' AND "mes" IS NOT NULL AND "dia" IS NOT NULL AND "fecha" IS NULL) OR ("tipo" = 'DINAMICO' AND "fecha" IS NOT NULL AND "mes" IS NULL AND "dia" IS NULL)),
        CONSTRAINT "CHK_feriados_mes" CHECK ("mes" IS NULL OR ("mes" BETWEEN 1 AND 12)),
        CONSTRAINT "CHK_feriados_dia" CHECK ("dia" IS NULL OR ("dia" BETWEEN 1 AND 31)),
        CONSTRAINT "FK_feriados_configuracion" FOREIGN KEY ("id_configuracion_horario") REFERENCES "configuraciones_horario_atencion"("id_configuracion_horario") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_feriados_fijos" ON "feriados" ("id_configuracion_horario", "mes", "dia") WHERE "tipo" = \'FIJO\'');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_feriados_dinamicos" ON "feriados" ("id_configuracion_horario", "fecha") WHERE "tipo" = \'DINAMICO\'');
    await queryRunner.query(`
      INSERT INTO "feriados" ("id_configuracion_horario", "tipo", "nombre", "fecha")
      SELECT "id_configuracion_horario", 'DINAMICO', COALESCE(NULLIF("motivo", ''), 'Feriado'), "fecha"
      FROM "excepciones_horario_atencion"
      WHERE "tipo" = 'CERRADO'
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`DELETE FROM "tramos_excepcion_horario_atencion" WHERE "id_excepcion_horario" IN (SELECT "id_excepcion_horario" FROM "excepciones_horario_atencion" WHERE "tipo" = 'CERRADO')`);
    await queryRunner.query(`DELETE FROM "excepciones_horario_atencion" WHERE "tipo" = 'CERRADO'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "excepciones_horario_atencion" ("id_configuracion_horario", "fecha", "tipo", "motivo")
      SELECT "id_configuracion_horario", "fecha", 'CERRADO', "nombre"
      FROM "feriados" WHERE "tipo" = 'DINAMICO'
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query('DROP TABLE "feriados"');
  }
}
