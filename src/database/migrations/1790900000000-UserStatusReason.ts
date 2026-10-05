import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStatusReason1790900000000 implements MigrationInterface {
  name = 'UserStatusReason1790900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "motivo_estado" character varying(255)',
    );
    await queryRunner.query(`
      UPDATE "usuarios" AS usuario
      SET "motivo_estado" = personal."motivo_baja"
      FROM "personal" AS personal
      WHERE personal."id_usuario" = usuario."id_usuario"
        AND usuario."estado" = 'BAJA'
        AND personal."estado" = 'BAJA'
        AND personal."motivo_baja" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "usuarios" AS usuario
      SET "motivo_estado" = paciente."motivo_baja"
      FROM "pacientes" AS paciente
      WHERE paciente."id_persona" = usuario."id_persona"
        AND usuario."estado" = 'BAJA'
        AND paciente."estado" = 'BAJA'
        AND paciente."motivo_baja" IS NOT NULL
        AND usuario."motivo_estado" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "motivo_estado"',
    );
  }
}
