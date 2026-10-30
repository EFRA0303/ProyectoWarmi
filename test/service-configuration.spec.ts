import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateServicioDto } from '../dist/modules/catalogo/dto/servicio.dto.js';
import { servicePriceForSessions } from '../dist/modules/comercial/service-price.js';

describe('Precio total y sesiones incluidas', () => {
  it('no multiplica el precio total por las sesiones incluidas', () => {
    expect(servicePriceForSessions('1000.00', 10, 10)).toEqual({
      unitPrice: '100.00',
      gross: '1000.00',
    });
  });
  it('conserva los importes para los servicios anteriores de una sesión', () => {
    expect(servicePriceForSessions('150.00', 1, 10).gross).toBe('1500.00');
  });
  it('no pierde centavos por multiplicar un unitario redondeado', () => {
    expect(servicePriceForSessions('100.00', 3, 3)).toEqual({
      unitPrice: '33.33',
      gross: '100.00',
    });
    expect(servicePriceForSessions('100.00', 3, 2).gross).toBe('66.67');
    expect(servicePriceForSessions('0.01', 2, 1).gross).toBe('0.01');
  });
  it('admite precio cero y rechaza precios, sesiones e importes inválidos', () => {
    expect(servicePriceForSessions('0', 10, 10).gross).toBe('0.00');
    for (const args of [
      ['-1', 1, 1],
      ['1.001', 1, 1],
      ['100', 0, 1],
      ['100', 1, 0],
      ['100', 2.5, 1],
      ['99999999.99', 1, 2],
    ] as const)
      expect(() => servicePriceForSessions(...args)).toThrow();
  });
});

describe('Validación de configuración del servicio', () => {
  const data = {
    id_categoria: 1,
    nombre: 'Servicio',
    precio: '1000',
    duracion_minutos: 60,
    sesiones_incluidas: 10,
    medidas: [
      { id_tipo_medida: 1, obligatorio: true, momentos: ['INICIAL', 'FINAL'] },
    ],
    productos: [{ id_producto: 1, cantidad_referencial: '2.50' }],
  };
  it('valida y transforma las configuraciones anidadas', async () => {
    expect(await validate(plainToInstance(CreateServicioDto, data))).toEqual(
      [],
    );
  });
  it('rechaza cantidades de sesiones inválidas y mediciones sin momento válido', async () => {
    for (const sesiones_incluidas of [0, -1, 1.5, 1001])
      expect(
        (
          await validate(
            plainToInstance(CreateServicioDto, { ...data, sesiones_incluidas }),
          )
        ).length,
      ).toBeGreaterThan(0);
    for (const momentos of [[], ['OTRO'], ['INICIAL', 'INICIAL']])
      expect(
        (
          await validate(
            plainToInstance(CreateServicioDto, {
              ...data,
              medidas: [{ ...data.medidas[0], momentos }],
            }),
          )
        ).length,
      ).toBeGreaterThan(0);
  });
});
