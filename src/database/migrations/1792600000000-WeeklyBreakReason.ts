import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WeeklyBreakReason1792600000000 implements MigrationInterface {
  name = 'WeeklyBreakReason1792600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "horarios_atencion_semanal" ADD COLUMN "motivo_pausa_anterior" varchar(120)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "horarios_atencion_semanal" DROP COLUMN "motivo_pausa_anterior"',
    );
  }
}
