import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import {
  EstadoPromocion,
  TipoDescuento,
} from '../../../common/enums/domain.enums.js';

export class CreatePaqueteDto {
  @IsString() @Length(1, 120) nombre: string;
  @IsOptional() @IsString() @MaxLength(255) descripcion?: string;
  @IsNumberString() precio: string;
  @IsOptional() @IsEnum(EstadoGeneral) estado?: EstadoGeneral;
}
export class UpdatePaqueteDto extends PartialType(CreatePaqueteDto) {}

export class AsignarServicioPaqueteDto {
  @Type(() => Number) @IsInt() @Min(1) id_servicio: number;
  @Type(() => Number) @IsInt() @Min(1) sesiones_incluidas: number;
}

export class CreatePromocionDto {
  @IsString() @Length(1, 120) nombre: string;
  @IsOptional() @IsString() @MaxLength(255) descripcion?: string;
  @IsEnum(TipoDescuento) tipo_descuento: TipoDescuento;
  @IsNumberString() valor_descuento: string;
  @IsDateString() fecha_inicio: string;
  @IsDateString() fecha_fin: string;
  @IsOptional() @IsEnum(EstadoPromocion) estado?: EstadoPromocion;
}
export class UpdatePromocionDto extends PartialType(CreatePromocionDto) {}

export class AsignarServicioPromocionDto extends AsignarServicioPaqueteDto {}
