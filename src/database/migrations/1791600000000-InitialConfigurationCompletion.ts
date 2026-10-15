import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialConfigurationCompletion1791600000000
  implements MigrationInterface
{
  name = 'InitialConfigurationCompletion1791600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "nit" character varying(30)',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "actividad_economica" character varying(180)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_empresas_nit" ON "empresas" ("nit") WHERE "nit" IS NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "servicios" ADD COLUMN IF NOT EXISTS "precio" numeric(10,2) NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE "servicios" DROP CONSTRAINT IF EXISTS "CHK_servicios_precio"',
    );
    await queryRunner.query(
      'ALTER TABLE "servicios" ADD CONSTRAINT "CHK_servicios_precio" CHECK ("precio" >= 0)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "servicios" DROP CONSTRAINT IF EXISTS "CHK_servicios_precio"',
    );
    await queryRunner.query(
      'ALTER TABLE "servicios" DROP COLUMN IF EXISTS "precio"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_empresas_nit"');
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "actividad_economica"',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "nit"',
    );
  }
}
