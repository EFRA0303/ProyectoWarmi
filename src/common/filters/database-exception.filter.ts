import { Catch, ConflictException, BadRequestException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { Response } from 'express';

@Catch(QueryFailedError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  catch(error: QueryFailedError, host: ArgumentsHost) {
    const code = (error.driverError as { code?: string }).code;
    const exception = ['23505', '23503'].includes(code ?? '')
      ? new ConflictException('Registro duplicado o relacion inexistente')
      : ['23502', '23514', '22P02', '22001', '22007', '22008'].includes(
            code ?? '',
          )
        ? new BadRequestException('Datos incompatibles con el modelo')
        : null;
    const response = host.switchToHttp().getResponse<Response>();
    response.status(exception?.getStatus() ?? 500).json(
      exception?.getResponse() ?? {
        statusCode: 500,
        message: 'No se pudo completar la operacion de base de datos',
      },
    );
  }
}
