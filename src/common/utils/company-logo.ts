import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

const MAX_COMPANY_LOGO_BYTES = 5 * 1024 * 1024;
const MAX_LOGIN_BACKGROUND_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);

export async function optimizeCompanyLogo(file?: {
  buffer: Buffer;
  size: number;
}) {
  if (!file?.buffer?.length) throw new BadRequestException('Selecciona un logo');
  if (
    file.size > MAX_COMPANY_LOGO_BYTES ||
    file.buffer.length > MAX_COMPANY_LOGO_BYTES
  )
    throw new BadRequestException('El logo no puede superar los 5 MB');

  try {
    const image = sharp(file.buffer, {
      failOn: 'error',
      limitInputPixels: 40_000_000,
    });
    const metadata = await image.metadata();
    if (!metadata.format || !ALLOWED_IMAGE_FORMATS.has(metadata.format))
      throw new BadRequestException(
        'El logo debe estar en formato JPG, JPEG, PNG o WEBP',
      );

    const { data, info } = await image
      .rotate()
      .resize({
        width: 1200,
        height: 1200,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 86, alphaQuality: 90, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, size: info.size };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('El logo no es válido o está dañado');
  }
}

export async function optimizeCompanyLoginBackground(file?: {
  buffer: Buffer;
  size: number;
}) {
  if (!file?.buffer?.length)
    throw new BadRequestException('Selecciona una imagen de fondo');
  if (
    file.size > MAX_LOGIN_BACKGROUND_BYTES ||
    file.buffer.length > MAX_LOGIN_BACKGROUND_BYTES
  )
    throw new BadRequestException(
      'La imagen de fondo no puede superar los 8 MB',
    );

  try {
    const image = sharp(file.buffer, {
      failOn: 'error',
      limitInputPixels: 50_000_000,
    });
    const metadata = await image.metadata();
    if (!metadata.format || !ALLOWED_IMAGE_FORMATS.has(metadata.format))
      throw new BadRequestException(
        'La imagen de fondo debe estar en formato JPG, JPEG, PNG o WEBP',
      );

    const { data, info } = await image
      .rotate()
      .resize({
        width: 2400,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 84, alphaQuality: 88, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, size: info.size };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException(
      'La imagen de fondo no es válida o está dañada',
    );
  }
}
