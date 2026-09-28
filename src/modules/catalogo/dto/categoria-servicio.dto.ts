import { PartialType } from '@nestjs/mapped-types';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';

export class CreateCategoriaServicioDto {
  @IsInt()
  @Min(1)
  id_area: number;

  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string | null;
}

export class UpdateCategoriaServicioDto extends PartialType(
  CreateCategoriaServicioDto,
) {
  @IsOptional()
  @IsEnum(EstadoGeneral)
  estado?: EstadoGeneral;
}
