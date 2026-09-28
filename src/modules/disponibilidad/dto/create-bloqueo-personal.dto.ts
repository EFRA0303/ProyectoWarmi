import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const OFFSET_DATE_TIME = /(Z|[+-]\d{2}:\d{2})$/;

export class CreateBloqueoPersonalDto {
  @IsInt()
  @Min(1)
  id_personal: number;

  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  fecha_hora_inicio: string;

  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  fecha_hora_fin: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string | null;
}
