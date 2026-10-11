import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EstadoBloqueosPersonal1791300000000
  implements MigrationInterface
{
  name = 'EstadoBloqueosPersonal1791300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bloqueos_personal"
      ADD COLUMN IF NOT EXISTS "estado" boolean NOT NULL DEFAULT true
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'No se revierte automaticamente: se perderia el estado logico de los bloqueos.',
    );
  }
}
