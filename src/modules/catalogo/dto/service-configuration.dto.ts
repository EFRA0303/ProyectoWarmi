import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  Min,
} from 'class-validator';

import { MomentoMedicion } from '../../../common/enums/momento-medicion.enum.js';

export class ServicioMedidaConfigDto {
  @IsInt()
  @Min(1)
  id_tipo_medida: number;

  @IsBoolean()
  obligatorio: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(MomentoMedicion, { each: true })
  momentos: MomentoMedicion[];
}

export class ServicioProductoConfigDto {
  @IsInt()
  @Min(1)
  id_producto: number;

  @IsNumberString({ no_symbols: false })
  cantidad_referencial: string;
}
