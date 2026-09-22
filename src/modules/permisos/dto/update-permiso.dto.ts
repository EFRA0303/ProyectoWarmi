import { IsEnum, ValidateIf } from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import { PartialType } from '@nestjs/mapped-types';
import { CreatePermisoDto } from './create-permiso.dto.js';

export class UpdatePermisoDto extends PartialType(CreatePermisoDto) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(EstadoGeneral)
  estado?: EstadoGeneral;
}
