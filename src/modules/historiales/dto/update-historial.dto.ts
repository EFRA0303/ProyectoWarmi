import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoHistorial } from '../../../common/enums/estado-historial.enum.js';

export class UpdateHistorialDto {
  @IsOptional()
  @IsEnum(EstadoHistorial)
  estado?: EstadoHistorial;

  @IsOptional()
  @IsString()
  observaciones_generales?: string | null;
}
