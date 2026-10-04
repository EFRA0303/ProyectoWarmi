import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPresence1790800000000 implements MigrationInterface {
  name = 'UserPresence1790800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS ultima_actividad_en TIMESTAMPTZ NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE usuarios
      DROP COLUMN IF EXISTS ultima_actividad_en
    `);
  }
}
