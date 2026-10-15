import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsDateString,
  IsEnum,
  IsPhoneNumber,
} from 'class-validator';
import { Genero } from '../../../common/enums/genero.enum.js';
import { Transform } from 'class-transformer';
import { normalizePersonName } from '../../../common/utils/person-name.js';
import { normalizePhoneNumber } from '../../../common/utils/phone-number.js';
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
  @Transform(({ value }) => normalizePhoneNumber(value))
  @IsString()
  @IsPhoneNumber(undefined, {
    message: 'El teléfono principal no es válido para el país seleccionado',
  })
  @MaxLength(16)
  telefono1: string;

  @IsOptional()
  @Transform(({ value }) => normalizePhoneNumber(value))
  @IsString()
  @IsPhoneNumber(undefined, {
    message: 'El teléfono alternativo no es válido para el país seleccionado',
  })
  @MaxLength(16)
  telefono2?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string | null;
}
