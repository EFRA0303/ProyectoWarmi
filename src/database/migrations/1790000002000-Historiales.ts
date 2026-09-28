import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Historiales1790000002000 implements MigrationInterface {
  name = 'Historiales1790000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."estado_historial" AS ENUM('ACTIVO', 'CERRADO');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$
    `);
    await queryRunner.query(
      'CREATE TABLE IF NOT EXISTS "historiales" ("id_historial" SERIAL NOT NULL, "id_paciente" integer NOT NULL, "fecha_apertura" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "estado" "public"."estado_historial" NOT NULL DEFAULT \'ACTIVO\', "observaciones_generales" text, CONSTRAINT "UQ_historiales_id_paciente" UNIQUE ("id_paciente"), CONSTRAINT "CHK_historiales_id_historial" CHECK ("id_historial" > 0), CONSTRAINT "CHK_historiales_id_paciente" CHECK ("id_paciente" > 0), CONSTRAINT "PK_historiales_id_historial" PRIMARY KEY ("id_historial"))',
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'public.historiales'::regclass
            AND contype = 'f'
            AND pg_get_constraintdef(oid) LIKE
              'FOREIGN KEY (id_paciente) REFERENCES pacientes(id_paciente)%'
        ) THEN
          ALTER TABLE "historiales"
          ADD CONSTRAINT "FK_historiales_pacientes"
          FOREIGN KEY ("id_paciente") REFERENCES "pacientes"("id_paciente")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END
      $$
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'public.historiales'::regclass
            AND conname = 'CHK_historiales_id_paciente'
        ) THEN
          ALTER TABLE "historiales"
          ADD CONSTRAINT "CHK_historiales_id_paciente"
          CHECK ("id_paciente" > 0);
        END IF;
      END
      $$
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'No se revierte automaticamente: eliminaria historiales clinicos.',
    );
  }
}
