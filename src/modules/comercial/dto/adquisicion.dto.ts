import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EstadoAdquisicion } from '../../../common/enums/domain.enums.js';

export class CreateDetalleAdquisicionDto {
  @Type(() => Number) @IsInt() @Min(1) id_servicio: number;
  @IsOptional() @IsString() @MaxLength(120) nombre_servicio_snapshot?: string;
  @Type(() => Number) @IsInt() @Min(1) sesiones_incluidas: number;
  @IsNumberString() precio_unitario: string;
  @IsOptional() @IsNumberString() descuento?: string;
  @IsOptional() @IsNumberString() subtotal?: string;
}
export class CreateAdquisicionDto {
  @Type(() => Number) @IsInt() @Min(1) id_paciente: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_paquete?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_promocion?: number;
  @IsDateString() fecha_adquisicion: string;
  @IsOptional() @IsNumberString() precio_original?: string;
  @IsOptional() @IsNumberString() descuento?: string;
  @IsOptional() @IsNumberString() total?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDetalleAdquisicionDto)
  detalles: CreateDetalleAdquisicionDto[];
}
export class UpdateAdquisicionDto {
  @IsEnum(EstadoAdquisicion) estado: EstadoAdquisicion;
}
