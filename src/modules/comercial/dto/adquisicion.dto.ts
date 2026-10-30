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
  IsUUID,
  ArrayMaxSize,
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
  @IsOptional() @IsUUID() clave_operacion?: string;
  @Type(() => Number) @IsInt() @Min(1) id_paciente: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_paquete?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_promocion?: number;
  @IsDateString() fecha_adquisicion: string;
  @IsOptional() @IsNumberString() precio_original?: string;
  @IsOptional() @IsNumberString() descuento?: string;
  @IsOptional() @IsNumberString() total?: string;
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateDetalleAdquisicionDto)
  detalles: CreateDetalleAdquisicionDto[];
}
export class UpdateAdquisicionDto {
  @IsOptional() @IsString() @MaxLength(255) motivo_anulacion?: string;
  @IsEnum(EstadoAdquisicion) estado: EstadoAdquisicion;
}
