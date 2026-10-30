import { BadRequestException } from '@nestjs/common';

export function units(value: string | number, label = 'Importe', positive = false, integerDigits = 8): bigint {
  const normalized = String(value).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  if (!new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,2})?$`).test(normalized))
    throw new BadRequestException(`${label}: usa un valor no negativo con hasta dos decimales`);
  const [whole, fraction = ''] = normalized.split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (positive && result <= 0n) throw new BadRequestException(`${label} debe ser mayor a cero`);
  return result;
}

export function decimal(value: bigint): string {
  if (value < 0n || value > 9999999999n) throw new BadRequestException('El importe o cantidad supera el rango permitido');
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}

export function multiply(left: bigint, right: bigint): bigint {
  return (left * right + 50n) / 100n;
}
