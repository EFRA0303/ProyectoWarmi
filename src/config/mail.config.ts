function integerInRange(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(`${name} debe ser un entero entre ${minimum} y ${maximum}`);
  return value;
}

export function mailConfig() {
  const resetUrl =
    process.env.FRONTEND_RESET_PASSWORD_URL ??
    'http://localhost:5173/restablecer-contrasena';
  new URL(resetUrl);

  return {
    host: process.env.MAIL_HOST ?? 'localhost',
    port: integerInRange('MAIL_PORT', 1025, 1, 65535),
    from: process.env.MAIL_FROM ?? 'no-reply@warmi.local',
    resetUrl,
    resetExpiresMinutes: integerInRange(
      'PASSWORD_RESET_EXPIRES_MINUTES',
      15,
      1,
      1440,
    ),
  };
}
