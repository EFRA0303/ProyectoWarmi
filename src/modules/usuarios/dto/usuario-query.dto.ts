import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoUsuario } from '../../../common/enums/estado-usuario.enum.js';

export enum TipoUsuario {
  PACIENTE = 'PACIENTE',
  PERSONAL = 'PERSONAL',
}

export class UsuarioQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    description:
      'Busca por nombre, apellidos, correo de acceso o nombre de usuario',
    example: 'ana',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EstadoUsuario })
  @IsOptional()
  @IsEnum(EstadoUsuario)
  estado?: EstadoUsuario;

  @ApiPropertyOptional({
    enum: TipoUsuario,
    description:
      'Filtra cuentas asociadas a un paciente o a un miembro del personal',
  })
  @IsOptional()
  @IsEnum(TipoUsuario)
  tipo?: TipoUsuario;
}
