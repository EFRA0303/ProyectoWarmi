import {
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { EstadoGeneral } from '../enums/estado-general.enum.js';

export class CambiarEstadoRegistroDto {
  @IsEnum(EstadoGeneral)
  estado: EstadoGeneral;

  @ValidateIf(
    (dto: CambiarEstadoRegistroDto) => dto.estado === EstadoGeneral.BAJA,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  motivo_baja?: string;
}
