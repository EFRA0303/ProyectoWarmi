import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import {
  ServicioMedidaConfigDto,
  ServicioProductoConfigDto,
} from './service-configuration.dto.js';

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

  @IsNumberString()
  precio: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  sesiones_incluidas?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ServicioMedidaConfigDto)
  medidas?: ServicioMedidaConfigDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ServicioProductoConfigDto)
  productos?: ServicioProductoConfigDto[];

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
