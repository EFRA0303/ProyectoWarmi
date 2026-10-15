import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyLoginPanelBackground1792100000000
  implements MigrationInterface
{
  name = 'CompanyLoginPanelBackground1792100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "imagen_fondo_panel_login_url" varchar(255)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "imagen_fondo_panel_login_url"',
    );
  }
}
