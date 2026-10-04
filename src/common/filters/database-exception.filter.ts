import { Catch, ConflictException, BadRequestException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { Response } from 'express';

type DatabaseDriverError = {
  code?: string;
  constraint?: string;
};

const uniqueConstraintMessages: Record<string, string> = {
  UQ_3a116924eb37c50413bd4cc2582:
    'Ya existe una persona registrada con ese CI.',
  UQ_cd043e5ea5a321206af22521222:
    'Ya existe una persona registrada con ese teléfono principal.',
  UQ_56baa7ad5353ee71ba7bb2dfee1:
    'Ya existe un usuario registrado con ese correo de acceso.',
  UQ_1a7a36f3dffef210b4c0ba5c6c0:
    'Ya existe un usuario registrado con ese nombre de usuario.',
  UQ_db56c500b31531b85b055ad3408:
    'La persona seleccionada ya está registrada como paciente.',
  REL_db56c500b31531b85b055ad340:
    'La persona seleccionada ya está registrada como paciente.',
  UQ_5b29c4b5cc11b9c67c8b70c9cb2:
    'La persona seleccionada ya tiene una cuenta de usuario.',
  REL_5b29c4b5cc11b9c67c8b70c9cb:
    'La persona seleccionada ya tiene una cuenta de usuario.',
  UQ_858ef107116ae13a2709cd45f49:
    'El usuario seleccionado ya esta registrado como personal.',
  REL_858ef107116ae13a2709cd45f4:
    'El usuario seleccionado ya esta registrado como personal.',
};

export function databaseExceptionFor(driverError: DatabaseDriverError) {
  if (driverError.code === '23505') {
    return new ConflictException(
      uniqueConstraintMessages[driverError.constraint ?? ''] ??
        'Ya existe un registro con esos datos.',
    );
  }

  if (driverError.code === '23503') {
    return new ConflictException(
    'El registro relacionado no existe o no permite completar esta operación.',
    );
  }

  if (
    ['23502', '23514', '22P02', '22001', '22007', '22008'].includes(
      driverError.code ?? '',
    )
  ) {
    return new BadRequestException('Datos incompatibles con el modelo');
  }

  return null;
}

@Catch(QueryFailedError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  catch(error: QueryFailedError, host: ArgumentsHost) {
    const exception = databaseExceptionFor(
      error.driverError as DatabaseDriverError,
    );
    const response = host.switchToHttp().getResponse<Response>();
    response.status(exception?.getStatus() ?? 500).json(
      exception?.getResponse() ?? {
        statusCode: 500,
        message: 'No se pudo completar la operacion de base de datos',
      },
    );
  }
}
