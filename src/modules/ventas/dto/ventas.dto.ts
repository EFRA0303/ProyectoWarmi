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
import {
  EstadoNotaVenta,
  EstadoPago,
  MetodoPago,
} from '../../../common/enums/domain.enums.js';
export class CreateDetalleNotaDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_servicio?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_producto?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_paquete?: number;
  @IsOptional() @IsString() @MaxLength(180) descripcion_snapshot?: string;
  @IsOptional() @IsString() @MaxLength(30) unidad_snapshot?: string;
  @IsNumberString() cantidad: string;
  @IsNumberString() precio_unitario: string;
  @IsOptional() @IsNumberString() descuento?: string;
  @IsOptional() @IsNumberString() subtotal?: string;
}
export class CreateNotaVentaDto {
  @IsOptional() @IsUUID() clave_operacion?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_adquisicion?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_paciente?: number;
  @IsOptional() @IsString() @MaxLength(30) numero_nota?: string;
  @IsDateString() fecha_emision: string;
  @IsOptional() @IsNumberString() subtotal?: string;
  @IsOptional() @IsNumberString() descuento?: string;
  @IsOptional() @IsNumberString() total?: string;
  @IsOptional() @IsString() @MaxLength(255) observaciones?: string;
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateDetalleNotaDto)
  detalles: CreateDetalleNotaDto[];
}
export class UpdateNotaVentaDto {
  @IsOptional() @IsString() @MaxLength(255) motivo_anulacion?: string;
  @IsOptional() @IsEnum(EstadoNotaVenta) estado?: EstadoNotaVenta;
  @IsOptional() @IsString() @MaxLength(255) observaciones?: string;
}
export class CreatePagoDto {
  @IsOptional() @IsUUID() clave_operacion?: string;
  @Type(() => Number) @IsInt() @Min(1) id_nota_venta: number;
  @IsNumberString() monto: string;
  @IsEnum(MetodoPago) metodo_pago: MetodoPago;
  @IsDateString() fecha_pago: string;
  @IsOptional() @IsEnum(EstadoPago) estado?: EstadoPago;
  @IsOptional() @IsString() @MaxLength(255) observaciones?: string;
}
export class UpdatePagoDto {
  @IsOptional() @IsString() @MaxLength(255) motivo_anulacion?: string;
  @IsOptional() @IsEnum(EstadoPago) estado?: EstadoPago;
  @IsOptional() @IsString() @MaxLength(255) observaciones?: string;
}
