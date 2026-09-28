import { IsBoolean, IsEnum, IsOptional, Matches } from 'class-validator';
import { DiaSemana } from '../../../common/enums/dia-semana.enum.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class UpdateHorarioPersonalDto {
  @IsOptional()
  @IsEnum(DiaSemana)
  dia_semana?: DiaSemana;

  @IsOptional()
  @Matches(TIME_PATTERN)
  hora_inicio?: string;

  @IsOptional()
  @Matches(TIME_PATTERN)
  hora_fin?: string;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;
}
