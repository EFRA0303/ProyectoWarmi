import { IsEnum, IsInt, Matches, Min } from 'class-validator';
import { DiaSemana } from '../../../common/enums/dia-semana.enum.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class CreateHorarioPersonalDto {
  @IsInt()
  @Min(1)
  id_personal: number;

  @IsEnum(DiaSemana)
  dia_semana: DiaSemana;

  @Matches(TIME_PATTERN)
  hora_inicio: string;

  @Matches(TIME_PATTERN)
  hora_fin: string;
}
