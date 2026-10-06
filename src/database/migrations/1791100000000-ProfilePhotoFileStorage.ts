import type { MigrationInterface, QueryRunner } from 'typeorm';
import { optimizeProfilePhoto } from '../../common/utils/profile-photo.js';
import {
  readProfilePhoto,
  writeProfilePhoto,
} from '../../common/utils/profile-photo-storage.js';

type StoredProfilePhoto = {
  id_usuario: number;
  id_persona: number;
  nombre: string;
  ap_paterno: string;
  foto_perfil: Buffer | null;
};

type RoutedProfilePhoto = {
  id_usuario: number;
  foto_perfil_ruta: string | null;
};

export class ProfilePhotoFileStorage1791100000000
  implements MigrationInterface
{
  name = 'ProfilePhotoFileStorage1791100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "foto_perfil_ruta" character varying(500)`,
    );

    const users = (await queryRunner.query(`
      SELECT
        u."id_usuario",
        u."id_persona",
        p."nombre",
        p."ap_paterno",
        u."foto_perfil"
      FROM "usuarios" u
      INNER JOIN "personas" p ON p."id_persona" = u."id_persona"
      WHERE u."foto_perfil" IS NOT NULL
    `)) as StoredProfilePhoto[];

    for (const user of users) {
      if (!user.foto_perfil) continue;
      const photo = await optimizeProfilePhoto({
        buffer: user.foto_perfil,
        size: user.foto_perfil.length,
      });
      const publicPath = await writeProfilePhoto(photo.data, user);
      await queryRunner.query(
        `UPDATE "usuarios" SET "foto_perfil_ruta" = $1 WHERE "id_usuario" = $2`,
        [publicPath, user.id_usuario],
      );
    }

    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "foto_perfil_mime"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "foto_perfil"`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "usuarios" ADD "foto_perfil" bytea`);
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD "foto_perfil_mime" character varying(50)`,
    );

    const users = (await queryRunner.query(`
      SELECT "id_usuario", "foto_perfil_ruta"
      FROM "usuarios"
      WHERE "foto_perfil_ruta" IS NOT NULL
    `)) as RoutedProfilePhoto[];

    for (const user of users) {
      if (!user.foto_perfil_ruta) continue;
      try {
        const data = await readProfilePhoto(user.foto_perfil_ruta);
        await queryRunner.query(
          `UPDATE "usuarios"
           SET "foto_perfil" = $1, "foto_perfil_mime" = 'image/webp'
           WHERE "id_usuario" = $2`,
          [data, user.id_usuario],
        );
      } catch {
        // Si el archivo ya no existe, la reversión conserva la foto como nula.
      }
    }

    await queryRunner.query(
      `ALTER TABLE "usuarios" DROP COLUMN "foto_perfil_ruta"`,
    );
  }
}
