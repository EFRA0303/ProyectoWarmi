import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateConfiguracionAuditoriaDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  codigo_evento: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string | null;

  @IsNotEmpty()
  @IsString()
  @MaxLength(60)
  categoria: string;

  @IsOptional()
  @IsBoolean()
  habilitado?: boolean;
}
