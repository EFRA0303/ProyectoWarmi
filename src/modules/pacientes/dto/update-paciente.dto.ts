import { IsEnum, ValidateIf } from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import { PartialType } from '@nestjs/mapped-types';
import { CreatePacienteDto } from './create-paciente.dto.js';

export class UpdatePacienteDto extends PartialType(CreatePacienteDto) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(EstadoGeneral)
  estado?: EstadoGeneral;
}
