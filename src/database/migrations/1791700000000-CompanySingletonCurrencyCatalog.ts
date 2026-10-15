import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanySingletonCurrencyCatalog1791700000000 implements MigrationInterface {
  name = 'CompanySingletonCurrencyCatalog1791700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_empresas_singleton" ON "empresas" ((true))',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "estado"',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "estado" estado_general NOT NULL DEFAULT \'ACTIVO\'',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_empresas_singleton"');
  }
}
