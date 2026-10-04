import { PickType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { UpdatePersonaDto } from '../../personas/dto/update-persona.dto.js';
import { UpdatePacienteDto } from './update-paciente.dto.js';

class DatosPacienteEditablesDto extends PickType(UpdatePacienteDto, [
  'ocupacion',
] as const) {}

export class ActualizacionCompletaPacienteDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdatePersonaDto)
  persona: UpdatePersonaDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => DatosPacienteEditablesDto)
  paciente: DatosPacienteEditablesDto;
}
