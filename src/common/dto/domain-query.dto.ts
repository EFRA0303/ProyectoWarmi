import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DomainQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 20;

  @ApiPropertyOptional({
    description: 'Filtra por el estado exacto del recurso',
  })
  @IsString()
  @IsOptional()
  estado?: string;

  @ApiPropertyOptional({ description: 'Busqueda textual por nombre o numero' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Inicio del rango de fechas' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ description: 'Fin del rango de fechas' })
  @IsOptional()
  @IsDateString()
  hasta?: string;

  @Type(() => Number) @IsOptional() @IsInt() @Min(1) id_paciente?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) id_personal?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) id_historial?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) id_servicio?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) id_tratamiento?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) id_nota_venta?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) id_producto?: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) id_lote?: number;
}
