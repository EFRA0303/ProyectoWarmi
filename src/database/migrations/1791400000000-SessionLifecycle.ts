import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SessionLifecycle1791400000000 implements MigrationInterface {
  name = 'SessionLifecycle1791400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."estado_sesion"
          AS ENUM('EN_CURSO', 'FINALIZADA', 'CANCELADA');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$
    `);
    await queryRunner.query(`
      ALTER TABLE "sesiones"
      ADD COLUMN IF NOT EXISTS "estado" "public"."estado_sesion"
    `);
    await queryRunner.query(`
      ALTER TABLE "sesiones"
      ADD COLUMN IF NOT EXISTS "finalizada_en" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      UPDATE "sesiones"
      SET "estado" = 'FINALIZADA',
          "finalizada_en" = COALESCE("finalizada_en", "fecha_sesion")
      WHERE "estado" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "sesiones"
      ALTER COLUMN "estado" SET DEFAULT 'EN_CURSO',
      ALTER COLUMN "estado" SET NOT NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "sesiones"
        ADD CONSTRAINT "CHK_sesiones_finalizacion"
        CHECK (
          ("estado" <> 'FINALIZADA' OR "finalizada_en" IS NOT NULL)
          AND ("finalizada_en" IS NULL OR "finalizada_en" >= "fecha_sesion")
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'No se revierte automaticamente: se perderia el ciclo de vida de las sesiones.',
    );
  }
}
