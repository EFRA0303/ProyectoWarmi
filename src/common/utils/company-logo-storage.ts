import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const PUBLIC_PREFIX = '/uploads/empresa/';
const DIRECTORY = resolve(process.cwd(), 'uploads', 'empresa');

export function companyLogoPublicPath(companyId: number) {
  return `${PUBLIC_PREFIX}empresa_${companyId}.webp`;
}

export function companyLoginBackgroundPublicPath(companyId: number) {
  return `${PUBLIC_PREFIX}fondo_login_${companyId}.webp`;
}

export function companyLoginPanelBackgroundPublicPath(companyId: number) {
  return `${PUBLIC_PREFIX}fondo_panel_login_${companyId}.webp`;
}

function diskPath(publicPath: string) {
  const normalized = publicPath.replaceAll('\\', '/');
  if (!normalized.startsWith(PUBLIC_PREFIX))
    throw new Error('Ruta de logo no válida');
  const fileName = basename(normalized);
  if (!/^empresa_[1-9]\d*\.webp$/.test(fileName))
    throw new Error('Nombre de logo no válido');
  return resolve(DIRECTORY, fileName);
}

function loginBackgroundDiskPath(publicPath: string) {
  const normalized = publicPath.replaceAll('\\', '/');
  if (!normalized.startsWith(PUBLIC_PREFIX))
    throw new Error('Ruta de imagen de fondo no válida');
  const fileName = basename(normalized);
  if (!/^fondo_login_[1-9]\d*\.webp$/.test(fileName))
    throw new Error('Nombre de imagen de fondo no válido');
  return resolve(DIRECTORY, fileName);
}

function loginPanelBackgroundDiskPath(publicPath: string) {
  const normalized = publicPath.replaceAll('\\', '/');
  if (!normalized.startsWith(PUBLIC_PREFIX))
    throw new Error('Ruta de imagen del panel no válida');
  const fileName = basename(normalized);
  if (!/^fondo_panel_login_[1-9]\d*\.webp$/.test(fileName))
    throw new Error('Nombre de imagen del panel no válido');
  return resolve(DIRECTORY, fileName);
}

async function writeAtomically(target: string, data: Buffer) {
  await mkdir(DIRECTORY, { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, data, { flag: 'wx' });
    try {
      await rename(temporary, target);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST' && code !== 'EPERM') throw error;
      await rm(target, { force: true });
      await rename(temporary, target);
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function writeCompanyLogo(data: Buffer, companyId: number) {
  const publicPath = companyLogoPublicPath(companyId);
  const target = diskPath(publicPath);
  await writeAtomically(target, data);
  return publicPath;
}

export async function readCompanyLogo(publicPath: string) {
  return readFile(diskPath(publicPath));
}

export async function writeCompanyLoginBackground(
  data: Buffer,
  companyId: number,
) {
  const publicPath = companyLoginBackgroundPublicPath(companyId);
  await writeAtomically(loginBackgroundDiskPath(publicPath), data);
  return publicPath;
}

export async function readCompanyLoginBackground(publicPath: string) {
  return readFile(loginBackgroundDiskPath(publicPath));
}

export async function writeCompanyLoginPanelBackground(
  data: Buffer,
  companyId: number,
) {
  const publicPath = companyLoginPanelBackgroundPublicPath(companyId);
  await writeAtomically(loginPanelBackgroundDiskPath(publicPath), data);
  return publicPath;
}

export async function readCompanyLoginPanelBackground(publicPath: string) {
  return readFile(loginPanelBackgroundDiskPath(publicPath));
}
