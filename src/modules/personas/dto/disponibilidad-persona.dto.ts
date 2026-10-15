import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';
import { normalizePhoneNumber } from '../../../common/utils/phone-number.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DisponibilidadPersonaDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ci?: string;

  @Transform(({ value }) => normalizePhoneNumber(value))
  @IsOptional()
  @IsString()
  @IsPhoneNumber(undefined, { message: 'El teléfono no es válido' })
  @MaxLength(16)
  telefono1?: string;
}
