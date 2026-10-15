import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizePhoneNumber(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  if (!raw) return raw;
  const phone = parsePhoneNumberFromString(raw, 'BO');
  return phone?.isValid() ? phone.number : raw;
}
