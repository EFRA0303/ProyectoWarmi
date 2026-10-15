import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveGeneralBreakReason1792900000000
  implements MigrationInterface
{
  name = 'RemoveGeneralBreakReason1792900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "horarios_atencion_semanal" DROP COLUMN "motivo_pausa_anterior"',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "horarios_atencion_semanal" ADD COLUMN "motivo_pausa_anterior" varchar(120)',
    );
  }
}
