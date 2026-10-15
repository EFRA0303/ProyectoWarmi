import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_SIDE = 1400;
const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);

type ProductImageUpload = {
  buffer: Buffer;
  size: number;
};

export async function optimizeProductImage(file?: ProductImageUpload) {
  if (!file?.buffer?.length)
    throw new BadRequestException('Selecciona una imagen del producto');
  if (
    file.size > MAX_PRODUCT_IMAGE_BYTES ||
    file.buffer.length > MAX_PRODUCT_IMAGE_BYTES
  )
    throw new BadRequestException('La imagen no puede superar los 5 MB');

  try {
    const image = sharp(file.buffer, {
      failOn: 'error',
      limitInputPixels: 40_000_000,
    });
    const metadata = await image.metadata();
    if (!metadata.format || !ALLOWED_IMAGE_FORMATS.has(metadata.format))
      throw new BadRequestException(
        'La imagen debe estar en formato JPG, JPEG, PNG o WEBP',
      );

    const { data, info } = await image
      .rotate()
      .resize({
        width: MAX_PRODUCT_IMAGE_SIDE,
        height: MAX_PRODUCT_IMAGE_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82, alphaQuality: 86, effort: 4, smartSubsample: true })
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
