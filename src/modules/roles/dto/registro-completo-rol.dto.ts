import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDefined,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateRolDto } from './create-rol.dto.js';

class DatosRolDto extends CreateRolDto {}

export class RegistroCompletoRolDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => DatosRolDto)
  rol: DatosRolDto;

  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  id_permisos: number[];
}
