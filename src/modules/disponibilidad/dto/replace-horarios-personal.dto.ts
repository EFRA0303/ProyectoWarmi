import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DiaSemana } from '../../../common/enums/dia-semana.enum.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class TramoHorarioPersonalDto {
  @IsEnum(DiaSemana)
  dia_semana: DiaSemana;

  @Matches(TIME_PATTERN)
  hora_inicio: string;

  @Matches(TIME_PATTERN)
  hora_fin: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  motivo_pausa_anterior?: string;
}

export class ReplaceHorariosPersonalDto {
  @IsArray()
  @ArrayMaxSize(35)
  @ValidateNested({ each: true })
  @Type(() => TramoHorarioPersonalDto)
  horarios: TramoHorarioPersonalDto[];
}
