import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';

export class CreateServicioDto {
  @IsInt()
  @Min(1)
  id_categoria: number;

  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsInt()
  @Min(1)
  duracion_minutos: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string | null;

  @IsOptional()
  @IsBoolean()
  requiere_valoracion?: boolean;
}

export class UpdateServicioDto extends PartialType(CreateServicioDto) {
  @IsOptional()
  @IsEnum(EstadoGeneral)
  estado?: EstadoGeneral;
}
