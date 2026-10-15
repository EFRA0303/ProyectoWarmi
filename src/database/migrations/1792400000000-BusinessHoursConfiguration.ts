import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BusinessHoursConfiguration1792400000000
  implements MigrationInterface
{
  name = 'BusinessHoursConfiguration1792400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "configuraciones_horario_atencion" (
        "id_configuracion_horario" SERIAL NOT NULL,
        "id_empresa" integer NOT NULL,
        "hora_inicio" time NOT NULL DEFAULT '07:00',
        "hora_fin" time NOT NULL DEFAULT '20:00',
        "intervalo_minutos" integer NOT NULL DEFAULT 30,
        "dias_laborales" "public"."dia_semana"[] NOT NULL DEFAULT ARRAY['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO']::"public"."dia_semana"[],
        CONSTRAINT "PK_configuraciones_horario_atencion" PRIMARY KEY ("id_configuracion_horario"),
        CONSTRAINT "UQ_configuraciones_horario_atencion_empresa" UNIQUE ("id_empresa"),
        CONSTRAINT "CHK_configuraciones_horario_atencion_horas" CHECK ("hora_inicio" < "hora_fin"),
        CONSTRAINT "CHK_configuraciones_horario_atencion_intervalo" CHECK ("intervalo_minutos" >= 5 AND "intervalo_minutos" <= 240),
        CONSTRAINT "FK_configuraciones_horario_atencion_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresas"("id_empresa") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      INSERT INTO "configuraciones_horario_atencion" ("id_empresa")
      SELECT "id_empresa" FROM "empresas" ORDER BY "id_empresa" ASC LIMIT 1
      ON CONFLICT ("id_empresa") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE IF EXISTS "configuraciones_horario_atencion"',
    );
  }
}
