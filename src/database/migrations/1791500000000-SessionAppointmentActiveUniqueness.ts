import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SessionAppointmentActiveUniqueness1791500000000
  implements MigrationInterface
{
  name = 'SessionAppointmentActiveUniqueness1791500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE unique_name text;
      BEGIN
        FOR unique_name IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'sesiones'::regclass
            AND contype = 'u'
            AND pg_get_constraintdef(oid) = 'UNIQUE (id_cita)'
        LOOP
          EXECUTE format('ALTER TABLE sesiones DROP CONSTRAINT %I', unique_name);
        END LOOP;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sesiones_cita_vigente"
      ON "sesiones" ("id_cita")
      WHERE "id_cita" IS NOT NULL
        AND "estado" IN ('EN_CURSO', 'FINALIZADA')
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'No se revierte automaticamente: una cita cancelada podria haber sido reiniciada.',
    );
  }
}
