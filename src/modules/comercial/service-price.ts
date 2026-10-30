import { BadRequestException } from '@nestjs/common';

// Redondear una sola vez el total proporcional, no multiplicar un unitario ya redondeado.
export function servicePriceForSessions(
  price: string,
  standardSessions: number,
  requestedSessions: number,
) {
  if (
    !/^\d{1,8}(?:\.\d{1,2})?$/.test(price) ||
    !Number.isSafeInteger(standardSessions) ||
    standardSessions < 1 ||
    !Number.isSafeInteger(requestedSessions) ||
    requestedSessions < 1
  )
    throw new BadRequestException(
      'El precio o la cantidad de sesiones del servicio no es válido',
    );
  const [whole, fraction = ''] = price.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  const denominator = BigInt(standardSessions);
  const round = (value: bigint) =>
    (value * 2n + denominator) / (2n * denominator);
  const amount = round(cents * BigInt(requestedSessions));
  if (amount > 9999999999n)
    throw new BadRequestException('El importe supera el máximo permitido');
  const money = (value: bigint) =>
    `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
  return { unitPrice: money(round(cents)), gross: money(amount) };
}
