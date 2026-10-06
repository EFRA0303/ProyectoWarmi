import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export const PROFILE_PHOTO_PUBLIC_PREFIX = '/uploads/perfil/';
export const PROFILE_PHOTO_DIRECTORY = resolve(
  process.cwd(),
  'uploads',
  'perfil',
);

type ProfilePhotoOwner = {
  id_persona: number;
  nombre: string;
  ap_paterno: string;
};

function normalizeFilePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export function profilePhotoFileName(owner: ProfilePhotoOwner) {
  const name = normalizeFilePart(owner.nombre) || 'persona';
  const surname = normalizeFilePart(owner.ap_paterno) || 'sin_apellido';
  return `${name}_${surname}_${owner.id_persona}.webp`;
}

export function profilePhotoPublicPath(owner: ProfilePhotoOwner) {
  return `${PROFILE_PHOTO_PUBLIC_PREFIX}${profilePhotoFileName(owner)}`;
}

export function profilePhotoDiskPath(publicPath: string) {
  const normalized = publicPath.replaceAll('\\', '/');
  if (!normalized.startsWith(PROFILE_PHOTO_PUBLIC_PREFIX)) {
    throw new Error('Ruta de foto de perfil no válida');
  }

  const fileName = basename(normalized);
  if (!/^[a-z0-9_]+\.webp$/.test(fileName)) {
    throw new Error('Nombre de foto de perfil no válido');
  }
  return resolve(PROFILE_PHOTO_DIRECTORY, fileName);
}

export async function ensureProfilePhotoDirectory() {
  await mkdir(PROFILE_PHOTO_DIRECTORY, { recursive: true });
}

export async function writeProfilePhoto(
  data: Buffer,
  owner: ProfilePhotoOwner,
) {
  await ensureProfilePhotoDirectory();
  const publicPath = profilePhotoPublicPath(owner);
  const targetPath = profilePhotoDiskPath(publicPath);
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

export async function readProfilePhoto(publicPath: string) {
  return readFile(profilePhotoDiskPath(publicPath));
}

export async function removeProfilePhoto(publicPath?: string | null) {
  if (!publicPath) return;
  try {
    await rm(profilePhotoDiskPath(publicPath), { force: true });
  } catch {
    // Una ruta antigua o inválida nunca debe permitir borrar fuera de uploads/perfil.
  }
}
