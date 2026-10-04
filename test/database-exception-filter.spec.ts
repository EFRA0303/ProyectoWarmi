import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { databaseExceptionFor } from '../dist/common/filters/database-exception.filter.js';

describe('Mensajes de errores de base de datos', () => {
  it.each([
    [
      'UQ_3a116924eb37c50413bd4cc2582',
      'Ya existe una persona registrada con ese CI.',
    ],
    [
      'UQ_cd043e5ea5a321206af22521222',
      'Ya existe una persona registrada con ese teléfono principal.',
    ],
    [
      'UQ_56baa7ad5353ee71ba7bb2dfee1',
      'Ya existe un usuario registrado con ese correo de acceso.',
    ],
    [
      'UQ_1a7a36f3dffef210b4c0ba5c6c0',
      'Ya existe un usuario registrado con ese nombre de usuario.',
    ],
  ])('identifica el dato duplicado de %s', (constraint, message) => {
    const exception = databaseExceptionFor({ code: '23505', constraint });

    expect(exception).toBeInstanceOf(ConflictException);
    expect(exception?.getResponse()).toMatchObject({ message });
  });

  it('mantiene un mensaje seguro para una restriccion desconocida', () => {
    const exception = databaseExceptionFor({
      code: '23505',
      constraint: 'UQ_desconocida',
    });

    expect(exception?.getResponse()).toMatchObject({
      message: 'Ya existe un registro con esos datos.',
    });
  });

  it('clasifica los datos incompatibles como solicitud incorrecta', () => {
    expect(databaseExceptionFor({ code: '23514' })).toBeInstanceOf(
      BadRequestException,
    );
  });
});
