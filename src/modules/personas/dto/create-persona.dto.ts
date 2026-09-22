import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Genero } from '../../../common/enums/genero.enum.js';
export class CreatePersonaDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  ap_paterno: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ap_materno?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ci?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  fecha_nac?: string | null;

  @IsEnum(Genero)
  genero: Genero;

  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  telefono1: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono2?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string | null;
}
