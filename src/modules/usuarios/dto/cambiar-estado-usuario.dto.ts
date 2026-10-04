import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { EstadoUsuario } from '../../../common/enums/estado-usuario.enum.js';

export class CambiarEstadoUsuarioDto {
  @ApiProperty({ enum: EstadoUsuario })
  @IsEnum(EstadoUsuario)
  estado: EstadoUsuario;

  @ApiPropertyOptional({
    description: 'Fecha futura requerida para un bloqueo temporal',
    example: '2026-10-03T19:30:00.000Z',
  })
  @ValidateIf(
    (dto: CambiarEstadoUsuarioDto) => dto.estado === EstadoUsuario.BLOQUEADO,
  )
  @IsISO8601({ strict: true })
  bloqueado_hasta?: string;

  @ApiPropertyOptional({
    description: 'Motivo obligatorio para bloquear o dar de baja',
    minLength: 3,
    maxLength: 255,
  })
  @ValidateIf(
    (dto: CambiarEstadoUsuarioDto) =>
      dto.estado === EstadoUsuario.BLOQUEADO ||
      dto.estado === EstadoUsuario.BAJA,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  motivo?: string;
}
