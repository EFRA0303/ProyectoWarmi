import { BadRequestException } from '@nestjs/common';
import { hash, compare } from 'bcryptjs';

export async function hashPassword(password: string) {
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72)
    throw new BadRequestException(
      'Contrasena: minimo 12 caracteres y maximo 72 bytes UTF-8',
    );
  return hash(password, 12);
}
export async function verifyPassword(password: string, hashed: string) {
  if (Buffer.byteLength(password, 'utf8') > 72) return false;
  return compare(password, hashed);
}
