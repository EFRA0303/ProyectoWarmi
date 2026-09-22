import { IsEnum, ValidateIf } from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import { PartialType } from '@nestjs/mapped-types';
import { CreateRolDto } from './create-rol.dto.js';

export class UpdateRolDto extends PartialType(CreateRolDto) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(EstadoGeneral)
  estado?: EstadoGeneral;
}
