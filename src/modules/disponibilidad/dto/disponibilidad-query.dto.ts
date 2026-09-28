import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiaSemana } from '../../../common/enums/dia-semana.enum.js';
import { EstadoHorarioExtra } from '../../../common/enums/estado-horario-extra.enum.js';

class PersonalQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  id_personal?: number;
}

export class HorarioPersonalQueryDto extends PersonalQueryDto {
  @ApiPropertyOptional({ enum: DiaSemana })
  @IsOptional()
  @IsEnum(DiaSemana)
  dia_semana?: DiaSemana;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsOptional()
  @IsBoolean()
  estado?: boolean;
}

export class HorarioExtraQueryDto extends PersonalQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fecha?: string;

  @ApiPropertyOptional({ enum: EstadoHorarioExtra })
  @IsOptional()
  @IsEnum(EstadoHorarioExtra)
  estado?: EstadoHorarioExtra;
}

export class BloqueoPersonalQueryDto extends PersonalQueryDto {}
