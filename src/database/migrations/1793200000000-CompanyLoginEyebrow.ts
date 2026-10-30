import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyLoginEyebrow1793200000000 implements MigrationInterface {
  name = 'CompanyLoginEyebrow1793200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "texto_superior_login" varchar(60)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "texto_superior_login"',
    );
  }
}
