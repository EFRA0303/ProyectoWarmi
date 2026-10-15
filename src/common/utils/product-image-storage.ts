import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

export const PRODUCT_IMAGE_PUBLIC_PREFIX = '/uploads/productos/';
export const PRODUCT_IMAGE_DIRECTORY = resolve(
  process.cwd(),
  'uploads',
  'productos',
);

type ProductImageOwner = {
  id_producto: number;
  nombre: string;
};

function normalizeFilePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90);
}

export function productImageFileName(product: ProductImageOwner) {
  const name = normalizeFilePart(product.nombre) || 'producto';
  return `producto_${product.id_producto}_${name}.webp`;
}

export function productImagePublicPath(product: ProductImageOwner) {
  return `${PRODUCT_IMAGE_PUBLIC_PREFIX}${productImageFileName(product)}`;
}

export function productImageDiskPath(publicPath: string) {
  const normalized = publicPath.replaceAll('\\', '/');
  if (!normalized.startsWith(PRODUCT_IMAGE_PUBLIC_PREFIX))
    throw new Error('Ruta de imagen de producto no válida');
  const fileName = basename(normalized);
  if (!/^producto_[1-9]\d*_[a-z0-9_]+\.webp$/.test(fileName))
    throw new Error('Nombre de imagen de producto no válido');
  return resolve(PRODUCT_IMAGE_DIRECTORY, fileName);
}

export async function writeProductImage(
  data: Buffer,
  product: ProductImageOwner,
) {
  await mkdir(PRODUCT_IMAGE_DIRECTORY, { recursive: true });
  const publicPath = productImagePublicPath(product);
  const targetPath = productImageDiskPath(publicPath);
  const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, data, { flag: 'wx' });
    try {
      await rename(temporaryPath, targetPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST' && code !== 'EPERM') throw error;
      await rm(targetPath, { force: true });
      await rename(temporaryPath, targetPath);
    }
  } finally {
    await rm(temporaryPath, { force: true });
  }
  return publicPath;
}

export async function readProductImage(publicPath: string) {
  return readFile(productImageDiskPath(publicPath));
}

export async function removeProductImage(publicPath?: string | null) {
  if (!publicPath) return;
  try {
    await rm(productImageDiskPath(publicPath), { force: true });
  } catch {
    // Una ruta antigua o externa nunca debe permitir borrar fuera de uploads/productos.
  }
}
