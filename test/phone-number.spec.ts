import { describe, expect, it } from 'vitest';
import { normalizePhoneNumber } from '../src/common/utils/phone-number.js';

describe('normalizePhoneNumber', () => {
  it('normaliza un celular boliviano local a E.164', () => {
    expect(normalizePhoneNumber('76522656')).toBe('+59176522656');
  });

  it('normaliza un número internacional con separadores', () => {
    expect(normalizePhoneNumber('+1 (202) 555-0123')).toBe('+12025550123');
  });

  it('conserva el valor para que el DTO rechace un número inválido', () => {
    expect(normalizePhoneNumber('123')).toBe('123');
  });
});
