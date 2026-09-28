import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import {
  EstadoLote,
  TipoMovimientoInventario,
} from '../../../common/enums/domain.enums.js';
export class CreateProductoDto {
  @IsString() @MaxLength(120) nombre: string;
  @IsOptional() @IsString() @MaxLength(255) descripcion?: string;
  @IsString() @MaxLength(30) unidad_medida: string;
  @IsOptional() @IsString() @MaxLength(500) imagen_url?: string;
  @IsOptional() @IsBoolean() es_insumo?: boolean;
  @IsOptional() @IsBoolean() es_vendible?: boolean;
  @IsOptional() @IsNumberString() stock_minimo?: string;
  @IsOptional() @IsEnum(EstadoGeneral) estado?: EstadoGeneral;
}
export class UpdateProductoDto extends PartialType(CreateProductoDto) {}
export class CreateLoteDto {
  @Type(() => Number) @IsInt() @Min(1) id_producto: number;
  @IsOptional() @IsString() @MaxLength(80) numero_lote?: string;
  @IsNumberString() cantidad_inicial: string;
  @IsDateString() fecha_ingreso: string;
  @IsOptional() @IsDateString() fecha_vencimiento?: string;
  @IsOptional() @IsNumberString() costo_unitario?: string;
  @IsOptional() @IsEnum(EstadoLote) estado?: EstadoLote;
}
export class UpdateLoteDto {
  @IsOptional() @IsString() @MaxLength(80) numero_lote?: string;
  @IsOptional() @IsDateString() fecha_vencimiento?: string;
  @IsOptional() @IsNumberString() costo_unitario?: string;
  @IsOptional() @IsEnum(EstadoLote) estado?: EstadoLote;
}
export class VincularServicioProductoDto {
  @Type(() => Number) @IsInt() @Min(1) id_producto: number;
  @IsOptional() @IsNumberString() cantidad_referencial?: string;
}
export class CreateMovimientoDto {
  @Type(() => Number) @IsInt() @Min(1) id_lote: number;
  @IsEnum(TipoMovimientoInventario) tipo: TipoMovimientoInventario;
  @IsNumberString() cantidad: string;
  @IsDateString() fecha_movimiento: string;
  @IsOptional() @IsString() @MaxLength(255) observaciones?: string;
}
export class CreateConsumoDto {
  @Type(() => Number) @IsInt() @Min(1) id_sesion: number;
  @Type(() => Number) @IsInt() @Min(1) id_lote: number;
  @IsNumberString() cantidad: string;
  @IsOptional() @IsString() @MaxLength(255) observaciones?: string;
}
export class CreateSalidaVentaDto {
  @Type(() => Number) @IsInt() @Min(1) id_detalle: number;
  @Type(() => Number) @IsInt() @Min(1) id_lote: number;
  @IsNumberString() cantidad: string;
  @IsOptional() @IsString() @MaxLength(255) observaciones?: string;
}
