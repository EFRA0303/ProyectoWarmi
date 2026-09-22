import { hashPassword, verifyPassword } from '../dist/common/utils/password.js';

describe('Contrasenas para cuentas manuales y API', () => {
  it('genera bcrypt y comprueba la clave sin guardar texto plano', async () => {
    const password = 'Una-clave-segura-2026!';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('Otra-clave-2026!', hash)).toBe(false);
  });
  it('rechaza claves cortas y entradas que bcrypt truncaria', async () => {
    await expect(hashPassword('corta')).rejects.toThrow();
    await expect(hashPassword('a'.repeat(73))).rejects.toThrow();
    await expect(hashPassword('\u00e1'.repeat(40))).rejects.toThrow();
    expect(await verifyPassword('a'.repeat(73), 'unused')).toBe(false);
  });
});
