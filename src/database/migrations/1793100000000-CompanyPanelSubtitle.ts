import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyPanelSubtitle1793100000000 implements MigrationInterface {
  name = 'CompanyPanelSubtitle1793100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "subtitulo_panel" varchar(40)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "empresas" DROP COLUMN IF EXISTS "subtitulo_panel"',
    );
  }
}
