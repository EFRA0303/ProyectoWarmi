import type { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffColorAndProfilePhoto1791000000000
  implements MigrationInterface
{
  name = 'StaffColorAndProfilePhoto1791000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "foto_perfil" bytea`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "foto_perfil_mime" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "personal" ADD "color_agenda" character(7) NOT NULL DEFAULT '#2DD4BF'`,
    );
    await queryRunner.query(`
      UPDATE "personal"
      SET "color_agenda" = (ARRAY[
        '#2DD4BF', '#38BDF8', '#A78BFA', '#F59E0B',
        '#F472B6', '#34D399', '#FB7185', '#818CF8'
      ])[(("id_personal" - 1) % 8) + 1]
    `);
    await queryRunner.query(
      `ALTER TABLE "personal" ADD CONSTRAINT "CHK_personal_color_agenda" CHECK ("color_agenda" ~ '^#[0-9A-Fa-f]{6}$')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "personal" DROP CONSTRAINT "CHK_personal_color_agenda"`,
    );
    await queryRunner.query(
      `ALTER TABLE "personal" DROP COLUMN "color_agenda"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "foto_perfil_mime"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "foto_perfil"`,
    );
  }
}
