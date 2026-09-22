import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { EstadoGeneral } from '../enums/estado-general.enum.js';

export class PaginationDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsEnum(EstadoGeneral) estado?: EstadoGeneral;
}
