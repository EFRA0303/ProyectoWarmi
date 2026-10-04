import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { CreatePersonaDto } from '../../personas/dto/create-persona.dto.js';
import { CreateUsuarioDto } from '../../usuarios/dto/create-usuario.dto.js';
import { CreatePersonalDto } from './create-personal.dto.js';

export class CuentaRegistroPersonalDto extends OmitType(CreateUsuarioDto, [
  'id_persona',
] as const) {}

export class DatosLaboralesRegistroDto extends OmitType(CreatePersonalDto, [
  'id_usuario',
] as const) {}

export class RegistroCompletoPersonalDto {
  @ApiProperty({ type: CreatePersonaDto })
  @ValidateNested()
  @Type(() => CreatePersonaDto)
  persona: CreatePersonaDto;

  @ApiProperty({ type: CuentaRegistroPersonalDto })
  @ValidateNested()
  @Type(() => CuentaRegistroPersonalDto)
  usuario: CuentaRegistroPersonalDto;

  @ApiProperty({ type: DatosLaboralesRegistroDto })
  @ValidateNested()
  @Type(() => DatosLaboralesRegistroDto)
  personal: DatosLaboralesRegistroDto;
}
