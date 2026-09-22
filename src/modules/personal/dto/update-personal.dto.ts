import { IsEnum, ValidateIf } from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import { PartialType } from '@nestjs/mapped-types';
import { CreatePersonalDto } from './create-personal.dto.js';

export class UpdatePersonalDto extends PartialType(CreatePersonalDto) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(EstadoGeneral)
  estado?: EstadoGeneral;
}
