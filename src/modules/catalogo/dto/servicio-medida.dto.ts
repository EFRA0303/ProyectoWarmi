import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { MomentoMedicion } from '../../../common/enums/momento-medicion.enum.js';

export class AssignServicioMedidaDto {
  @IsInt()
  @Min(1)
  id_tipo_medida: number;

  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(MomentoMedicion, { each: true })
  momentos?: MomentoMedicion[];
}
