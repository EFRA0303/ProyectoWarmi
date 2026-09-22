import { IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePacienteDto {
  @IsInt()
  @Min(1)
  id_persona: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ocupacion?: string | null;
}
