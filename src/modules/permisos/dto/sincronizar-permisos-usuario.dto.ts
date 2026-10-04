import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

class ExcepcionPermisoDto {
  @IsInt()
  @Min(1)
  id_permiso: number;

  @IsBoolean()
  permitido: boolean;
}

export class SincronizarPermisosUsuarioDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExcepcionPermisoDto)
  excepciones: ExcepcionPermisoDto[];
}
