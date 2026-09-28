import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DisponibilidadPersonal1790400000000 implements MigrationInterface {
  name = 'DisponibilidadPersonal1790400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."dia_semana" AS ENUM(
          'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES',
          'VIERNES', 'SABADO', 'DOMINGO'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."estado_horario_extra"
          AS ENUM('AUTORIZADO', 'CANCELADO');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "horarios_personal" (
        "id_horario" SERIAL NOT NULL,
        "id_personal" integer NOT NULL,
        "dia_semana" "public"."dia_semana" NOT NULL,
        "hora_inicio" time NOT NULL,
        "hora_fin" time NOT NULL,
        "estado" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_horarios_personal" PRIMARY KEY ("id_horario"),
        CONSTRAINT "UQ_horario_personal_tramo"
          UNIQUE ("id_personal", "dia_semana", "hora_inicio", "hora_fin"),
        CONSTRAINT "CHK_horarios_personal_id" CHECK ("id_horario" > 0),
        CONSTRAINT "CHK_horarios_personal_horas"
          CHECK ("hora_inicio" < "hora_fin"),
        CONSTRAINT "FK_horarios_personal_personal"
          FOREIGN KEY ("id_personal") REFERENCES "personal"("id_personal")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "horarios_extra_personal" (
        "id_horario_extra" SERIAL NOT NULL,
        "id_personal" integer NOT NULL,
        "fecha" date NOT NULL,
        "hora_inicio" time NOT NULL,
        "hora_fin" time NOT NULL,
        "autorizado_por" integer NOT NULL,
        "motivo" character varying(255),
        "estado" "public"."estado_horario_extra"
          NOT NULL DEFAULT 'AUTORIZADO',
        CONSTRAINT "PK_horarios_extra_personal"
          PRIMARY KEY ("id_horario_extra"),
        CONSTRAINT "CHK_horarios_extra_id"
          CHECK ("id_horario_extra" > 0),
        CONSTRAINT "CHK_horarios_extra_horas"
          CHECK ("hora_inicio" < "hora_fin"),
        CONSTRAINT "FK_horarios_extra_personal"
          FOREIGN KEY ("id_personal") REFERENCES "personal"("id_personal")
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_horarios_extra_autorizador"
          FOREIGN KEY ("autorizado_por") REFERENCES "usuarios"("id_usuario")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bloqueos_personal" (
        "id_bloqueo" SERIAL NOT NULL,
        "id_personal" integer NOT NULL,
        "fecha_hora_inicio" TIMESTAMP WITH TIME ZONE NOT NULL,
        "fecha_hora_fin" TIMESTAMP WITH TIME ZONE NOT NULL,
        "motivo" character varying(255),
        CONSTRAINT "PK_bloqueos_personal" PRIMARY KEY ("id_bloqueo"),
        CONSTRAINT "CHK_bloqueos_personal_id" CHECK ("id_bloqueo" > 0),
        CONSTRAINT "CHK_bloqueos_personal_fechas"
          CHECK ("fecha_hora_inicio" < "fecha_hora_fin"),
        CONSTRAINT "FK_bloqueos_personal_personal"
          FOREIGN KEY ("id_personal") REFERENCES "personal"("id_personal")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'No se revierte automaticamente: eliminaria disponibilidad registrada.',
    );
  }
}
