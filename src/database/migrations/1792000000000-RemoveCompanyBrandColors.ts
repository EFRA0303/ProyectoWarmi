import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCompanyBrandColors1792000000000
  implements MigrationInterface
{
  name = 'RemoveCompanyBrandColors1792000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  async down(queryRunner: QueryRunner): Promise<void> {
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
  }
}
