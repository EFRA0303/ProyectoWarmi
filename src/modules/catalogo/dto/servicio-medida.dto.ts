import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class AssignServicioMedidaDto {
  @IsInt()
  @Min(1)
  id_tipo_medida: number;

  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;
}
