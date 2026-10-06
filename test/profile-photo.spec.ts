import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { optimizeProfilePhoto } from '../dist/common/utils/profile-photo.js';
import {
  profilePhotoFileName,
  readProfilePhoto,
  removeProfilePhoto,
  writeProfilePhoto,
} from '../dist/common/utils/profile-photo-storage.js';

describe('Fotos de perfil', () => {
  it.each(['jpeg', 'png', 'webp'] as const)(
    'convierte %s a WEBP y limita su tamaño conservando la proporción',
    async (format) => {
      const image = sharp({
        create: {
          width: 1200,
          height: 600,
          channels: 3,
          background: '#2dd4bf',
        },
      });
      const original = await image[format]().toBuffer();

      const result = await optimizeProfilePhoto({
        buffer: original,
        size: original.length,
      });
      const metadata = await sharp(result.data).metadata();

      expect(result.mime).toBe('image/webp');
      expect(metadata.format).toBe('webp');
      expect(metadata.width).toBe(512);
      expect(metadata.height).toBe(256);
      expect(result.size).toBe(result.data.length);
    },
  );

  it('rechaza archivos dañados y formatos no permitidos', async () => {
    const invalid = Buffer.from('esto no es una imagen');
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" />',
    );

    await expect(
      optimizeProfilePhoto({ buffer: invalid, size: invalid.length }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      optimizeProfilePhoto({ buffer: svg, size: svg.length }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('genera un nombre controlado y almacena la foto fuera de la base de datos', async () => {
    const owner = {
      id_persona: 999_999_999,
      nombre: 'Efraín José',
      ap_paterno: 'Gómez Flores',
    };
    const data = Buffer.from('foto-webp-de-prueba');

    expect(profilePhotoFileName(owner)).toBe(
      'efrain_jose_gomez_flores_999999999.webp',
    );

    const publicPath = await writeProfilePhoto(data, owner);
    try {
      expect(publicPath).toBe(
        '/uploads/perfil/efrain_jose_gomez_flores_999999999.webp',
      );
      expect(await readProfilePhoto(publicPath)).toEqual(data);
    } finally {
      await removeProfilePhoto(publicPath);
    }
  });
});
