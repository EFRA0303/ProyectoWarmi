import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DisponibilidadPersonaDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ci?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono1?: string;
}
