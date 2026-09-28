import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { EstadoHorarioExtra } from '../../../common/enums/estado-horario-extra.enum.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateHorarioExtraDto {
  @IsOptional()
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true })
  fecha?: string;

  @IsOptional()
  @Matches(TIME_PATTERN)
  hora_inicio?: string;

  @IsOptional()
  @Matches(TIME_PATTERN)
  hora_fin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string | null;

  @IsOptional()
  @IsEnum(EstadoHorarioExtra)
  estado?: EstadoHorarioExtra;
}
