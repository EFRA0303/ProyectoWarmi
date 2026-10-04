import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Genero } from '../../../common/enums/genero.enum.js';
import { Transform } from 'class-transformer';
import { normalizePersonName } from '../../../common/utils/person-name.js';
export class CreatePersonaDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizePersonName(value) : value,
  )
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizePersonName(value) : value,
  )
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  ap_paterno: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizePersonName(value) : value,
  )
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
