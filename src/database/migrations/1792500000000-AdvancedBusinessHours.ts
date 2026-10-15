import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdvancedBusinessHours1792500000000 implements MigrationInterface {
  name = 'AdvancedBusinessHours1792500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "horarios_atencion_semanal" (
        "id_horario_atencion" SERIAL NOT NULL,
        "id_configuracion_horario" integer NOT NULL,
        "dia_semana" "public"."dia_semana" NOT NULL,
        "hora_inicio" time NOT NULL,
        "hora_fin" time NOT NULL,
        CONSTRAINT "PK_horarios_atencion_semanal" PRIMARY KEY ("id_horario_atencion"),
        CONSTRAINT "CHK_horarios_atencion_semanal_horas" CHECK ("hora_inicio" < "hora_fin"),
        CONSTRAINT "FK_horarios_atencion_semanal_configuracion" FOREIGN KEY ("id_configuracion_horario") REFERENCES "configuraciones_horario_atencion"("id_configuracion_horario") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "excepciones_horario_atencion" (
        "id_excepcion_horario" SERIAL NOT NULL,
        "id_configuracion_horario" integer NOT NULL,
        "fecha" date NOT NULL,
        "tipo" varchar(20) NOT NULL,
        "motivo" varchar(180),
        CONSTRAINT "PK_excepciones_horario_atencion" PRIMARY KEY ("id_excepcion_horario"),
        CONSTRAINT "UQ_excepciones_horario_atencion_fecha" UNIQUE ("fecha"),
        CONSTRAINT "CHK_excepciones_horario_atencion_tipo" CHECK ("tipo" IN ('CERRADO', 'HORARIO_ESPECIAL')),
        CONSTRAINT "FK_excepciones_horario_atencion_configuracion" FOREIGN KEY ("id_configuracion_horario") REFERENCES "configuraciones_horario_atencion"("id_configuracion_horario") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tramos_excepcion_horario_atencion" (
        "id_tramo_excepcion" SERIAL NOT NULL,
        "id_excepcion_horario" integer NOT NULL,
        "hora_inicio" time NOT NULL,
        "hora_fin" time NOT NULL,
        CONSTRAINT "PK_tramos_excepcion_horario_atencion" PRIMARY KEY ("id_tramo_excepcion"),
        CONSTRAINT "CHK_tramos_excepcion_horario_atencion_horas" CHECK ("hora_inicio" < "hora_fin"),
        CONSTRAINT "FK_tramos_excepcion_horario_atencion_excepcion" FOREIGN KEY ("id_excepcion_horario") REFERENCES "excepciones_horario_atencion"("id_excepcion_horario") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      INSERT INTO "horarios_atencion_semanal" ("id_configuracion_horario", "dia_semana", "hora_inicio", "hora_fin")
      SELECT c."id_configuracion_horario", d.dia, c."hora_inicio", c."hora_fin"
      FROM "configuraciones_horario_atencion" c
      CROSS JOIN LATERAL unnest(c."dias_laborales") AS d(dia)
    `);
    await queryRunner.query(
      'ALTER TABLE "configuraciones_horario_atencion" DROP CONSTRAINT "CHK_configuraciones_horario_atencion_horas"',
    );
    await queryRunner.query(
      'ALTER TABLE "configuraciones_horario_atencion" DROP COLUMN "dias_laborales", DROP COLUMN "hora_fin", DROP COLUMN "hora_inicio"',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "configuraciones_horario_atencion" ADD COLUMN "hora_inicio" time NOT NULL DEFAULT \'07:00\', ADD COLUMN "hora_fin" time NOT NULL DEFAULT \'20:00\', ADD COLUMN "dias_laborales" "public"."dia_semana"[] NOT NULL DEFAULT ARRAY[\'LUNES\',\'MARTES\',\'MIERCOLES\',\'JUEVES\',\'VIERNES\',\'SABADO\']::"public"."dia_semana"[]',
    );
    await queryRunner.query(
      'ALTER TABLE "configuraciones_horario_atencion" ADD CONSTRAINT "CHK_configuraciones_horario_atencion_horas" CHECK ("hora_inicio" < "hora_fin")',
    );
    await queryRunner.query('DROP TABLE "tramos_excepcion_horario_atencion"');
    await queryRunner.query('DROP TABLE "excepciones_horario_atencion"');
    await queryRunner.query('DROP TABLE "horarios_atencion_semanal"');
  }
}
