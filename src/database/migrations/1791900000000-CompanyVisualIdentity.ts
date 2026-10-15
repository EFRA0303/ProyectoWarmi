import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyVisualIdentity1791900000000 implements MigrationInterface {
  name = 'CompanyVisualIdentity1791900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "eslogan_principal" varchar(180)',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "titulo_login" varchar(180)',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "descripcion_corta" varchar(320)',
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "caracteristicas_login" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "imagen_fondo_login_url" varchar(255)',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "color_primario" varchar(7)',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "color_secundario" varchar(7)',
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD CONSTRAINT "CHK_empresas_color_primario_hex" CHECK ("color_primario" IS NULL OR "color_primario" ~ '^#[0-9A-Fa-f]{6}$')`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD CONSTRAINT "CHK_empresas_color_secundario_hex" CHECK ("color_secundario" IS NULL OR "color_secundario" ~ '^#[0-9A-Fa-f]{6}$')`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD CONSTRAINT "CHK_empresas_caracteristicas_login_array" CHECK (jsonb_typeof("caracteristicas_login") = 'array' AND jsonb_array_length("caracteristicas_login") <= 3)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP CONSTRAINT IF EXISTS "CHK_empresas_caracteristicas_login_array"',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP CONSTRAINT IF EXISTS "CHK_empresas_color_secundario_hex"',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP CONSTRAINT IF EXISTS "CHK_empresas_color_primario_hex"',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "color_secundario"',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "color_primario"',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "imagen_fondo_login_url"',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "caracteristicas_login"',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "descripcion_corta"',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "titulo_login"',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "eslogan_principal"',
    );
  }
}
