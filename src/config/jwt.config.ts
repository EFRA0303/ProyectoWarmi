import { requiredEnv } from './env.validation.js';

export function jwtConfig() {
  const secret = requiredEnv('JWT_SECRET');
  if (secret.length < 32)
    throw new Error('JWT_SECRET requiere al menos 32 caracteres');
  const rawExpiration = process.env.JWT_EXPIRES_IN_SECONDS;
  const expiresIn = rawExpiration === undefined ? 3600 : Number(rawExpiration);
  if (!Number.isInteger(expiresIn) || expiresIn < 60)
    throw new Error(
      'JWT_EXPIRES_IN_SECONDS debe ser un entero mayor o igual a 60',
    );
  return { secret, signOptions: { expiresIn } };
}
