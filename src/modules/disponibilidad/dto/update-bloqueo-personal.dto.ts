import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const OFFSET_DATE_TIME = /(Z|[+-]\d{2}:\d{2})$/;

export class UpdateBloqueoPersonalDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  fecha_hora_inicio?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  fecha_hora_fin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string | null;
}
