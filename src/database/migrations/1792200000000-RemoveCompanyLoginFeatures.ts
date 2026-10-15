import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCompanyLoginFeatures1792200000000
  implements MigrationInterface
{
  name = 'RemoveCompanyLoginFeatures1792200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP CONSTRAINT IF EXISTS "CHK_empresas_caracteristicas_login_array"',
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "caracteristicas_login"',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "caracteristicas_login" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD CONSTRAINT "CHK_empresas_caracteristicas_login_array" CHECK (jsonb_typeof("caracteristicas_login") = \'array\' AND jsonb_array_length("caracteristicas_login") <= 3)',
    );
  }
}
