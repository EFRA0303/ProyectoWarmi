import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateHorarioExtraDto {
  @IsInt()
  @Min(1)
  id_personal: number;

  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true })
  fecha: string;

  @Matches(TIME_PATTERN)
  hora_inicio: string;

  @Matches(TIME_PATTERN)
  hora_fin: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string | null;
}
