import { PickType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { UpdatePersonaDto } from '../../personas/dto/update-persona.dto.js';
import { UpdateUsuarioDto } from '../../usuarios/dto/update-usuario.dto.js';
import { UpdatePersonalDto } from './update-personal.dto.js';

class DatosUsuarioEditablesDto extends PickType(UpdateUsuarioDto, [
  'correo_acceso',
  'nombre_usuario',
] as const) {}

class DatosPersonalEditablesDto extends PickType(UpdatePersonalDto, [
  'profesion',
  'cargo',
  'fecha_ingreso',
  'color_agenda',
] as const) {}

export class ActualizacionCompletaPersonalDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdatePersonaDto)
  persona: UpdatePersonaDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => DatosUsuarioEditablesDto)
  usuario: DatosUsuarioEditablesDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => DatosPersonalEditablesDto)
  personal: DatosPersonalEditablesDto;
}
