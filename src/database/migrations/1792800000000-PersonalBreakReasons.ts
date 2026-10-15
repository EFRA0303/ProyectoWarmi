import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PersonalBreakReasons1792800000000 implements MigrationInterface {
  name = 'PersonalBreakReasons1792800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "horarios_personal" ADD COLUMN "motivo_pausa_anterior" varchar(120)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "horarios_personal" DROP COLUMN "motivo_pausa_anterior"',
    );
  }
}
