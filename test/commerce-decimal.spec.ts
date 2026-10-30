import { decimal, multiply, units } from '../dist/common/utils/decimal.js';

describe('Importes y cantidades exactos', () => {
  it('suma centésimos sin errores de coma flotante', () => {
    expect(decimal(units('0.10') + units('0.20'))).toBe('0.30');
    expect(decimal(multiply(units('3'), units('33.33')))).toBe('99.99');
    expect(decimal(units('100.000'))).toBe('100.00');
  });
  it.each(['-1', 'NaN', 'Infinity', '1.001', '100000000', '1e3'])('rechaza %s', value => {
    expect(() => units(value)).toThrow();
  });
  it('exige positivos donde corresponde y limita el importe persistido', () => {
    expect(() => units('0', 'Cantidad', true)).toThrow();
    expect(() => decimal(-1n)).toThrow();
    expect(() => decimal(10000000000n)).toThrow();
  });
});
