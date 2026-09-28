import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateHistorialDto {
  @IsInt()
  @Min(1)
  id_paciente: number;

  @IsOptional()
  @IsString()
  observaciones_generales?: string | null;
}
