import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateConfiguracionAuditoriaDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
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
