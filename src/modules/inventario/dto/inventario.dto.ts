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
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import {
  EstadoLote,
  TipoMovimientoInventario,
} from '../../../common/enums/domain.enums.js';
export class CreateProductoDto {
  @Type(() => Number) @IsInt() @Min(1) id_categoria_producto: number;
  @IsString() @MaxLength(120) nombre: string;
  @IsOptional() @IsString() @MaxLength(100) marca?: string | null;
  @IsOptional() @IsString() @MaxLength(80) sku?: string | null;
  @IsOptional() @IsString() @MaxLength(80) codigo_barras?: string | null;
  @IsOptional() @IsString() @MaxLength(255) descripcion?: string | null;
  @IsString() @MaxLength(30) unidad_medida: string;
  @IsString() @MaxLength(50) presentacion: string;
  @Matches(/^[1-9]\d*$/, { message: 'contenido_presentacion debe ser un entero mayor a cero' })
  contenido_presentacion: string;
  @IsOptional() @IsNumberString() precio_venta?: string | null;
  @IsOptional() @IsString() @MaxLength(500) imagen_url?: string;
  @IsOptional() @IsBoolean() es_insumo?: boolean;
  @IsOptional() @IsBoolean() es_vendible?: boolean;
  @IsOptional() @Matches(/^\d+$/, { message: 'stock_minimo debe ser un entero' })
  stock_minimo?: string;
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
