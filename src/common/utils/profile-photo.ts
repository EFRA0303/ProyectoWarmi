import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PROFILE_PHOTO_SIDE = 512;
const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);

type ProfilePhotoUpload = {
  buffer: Buffer;
  size: number;
};

export async function optimizeProfilePhoto(file?: ProfilePhotoUpload) {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Selecciona una imagen');
  }
  if (
    file.size > MAX_PROFILE_PHOTO_BYTES ||
    file.buffer.length > MAX_PROFILE_PHOTO_BYTES
  ) {
    throw new BadRequestException('La imagen no puede superar los 5 MB');
  }

  try {
    const image = sharp(file.buffer, {
      failOn: 'error',
      limitInputPixels: 40_000_000,
    });
    const metadata = await image.metadata();

    if (!metadata.format || !ALLOWED_IMAGE_FORMATS.has(metadata.format)) {
      throw new BadRequestException(
        'La foto debe estar en formato JPG, JPEG, PNG o WEBP',
      );
    }

    const { data, info } = await image
      .rotate()
      .resize({
        width: MAX_PROFILE_PHOTO_SIDE,
        height: MAX_PROFILE_PHOTO_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: 82,
        alphaQuality: 85,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer({ resolveWithObject: true });

    return {
      data,
      mime: 'image/webp' as const,
      width: info.width,
      height: info.height,
      size: info.size,
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('La imagen no es válida o está dañada');
  }
}
