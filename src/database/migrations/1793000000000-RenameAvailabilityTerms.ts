import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameAvailabilityTerms1793000000000 implements MigrationInterface {
  name = 'RenameAvailabilityTerms1793000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bloqueos_personal" RENAME TO "permisos_personal";
      ALTER TABLE "permisos_personal" RENAME COLUMN "id_bloqueo" TO "id_permiso";

      DO $migration$
      DECLARE item record;
      DECLARE next_name text;
      BEGIN
        FOR item IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'permisos_personal'::regclass
            AND conname LIKE '%bloqueos_personal%'
        LOOP
          next_name := REPLACE(REPLACE(item.conname, 'bloqueos_personal', 'permisos_personal'), 'id_bloqueo', 'id_permiso');
          EXECUTE format('ALTER TABLE permisos_personal RENAME CONSTRAINT %I TO %I', item.conname, next_name);
        END LOOP;

        SELECT conname INTO next_name
        FROM pg_constraint
        WHERE conrelid = 'permisos_personal'::regclass AND contype = 'p';
        IF next_name IS NOT NULL AND next_name <> 'PK_permisos_personal' THEN
          EXECUTE format('ALTER TABLE permisos_personal RENAME CONSTRAINT %I TO PK_permisos_personal', next_name);
        END IF;

        SELECT conname INTO next_name
        FROM pg_constraint
        WHERE conrelid = 'permisos_personal'::regclass AND contype = 'f'
        LIMIT 1;
        IF next_name IS NOT NULL AND next_name <> 'FK_permisos_personal_personal' THEN
          EXECUTE format('ALTER TABLE permisos_personal RENAME CONSTRAINT %I TO FK_permisos_personal_personal', next_name);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'permisos_personal'::regclass
            AND conname = 'CHK_permisos_personal_id'
        ) THEN
          ALTER TABLE "permisos_personal"
            ADD CONSTRAINT "CHK_permisos_personal_id" CHECK ("id_permiso" > 0);
        END IF;
      END $migration$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $migration$
      DECLARE item record;
      DECLARE next_name text;
      BEGIN
        FOR item IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'permisos_personal'::regclass
            AND conname LIKE '%permisos_personal%'
        LOOP
          next_name := REPLACE(REPLACE(item.conname, 'permisos_personal', 'bloqueos_personal'), 'id_permiso', 'id_bloqueo');
          EXECUTE format('ALTER TABLE permisos_personal RENAME CONSTRAINT %I TO %I', item.conname, next_name);
        END LOOP;
      END $migration$;

      ALTER TABLE "permisos_personal" RENAME COLUMN "id_permiso" TO "id_bloqueo";
      ALTER TABLE "permisos_personal" RENAME TO "bloqueos_personal";
    `);
  }
}
