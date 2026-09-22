import { requiredEnv } from './env.validation.js';

export function jwtConfig() {
  const secret = requiredEnv('JWT_SECRET');
  if (secret.length < 32)
    throw new Error('JWT_SECRET requiere al menos 32 caracteres');
  return { secret, signOptions: { expiresIn: 3600 } };
}
