import { IsEnum, ValidateIf } from 'class-validator';
import { EstadoUsuario } from '../../../common/enums/estado-usuario.enum.js';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUsuarioDto } from './create-usuario.dto.js';

export class UpdateUsuarioDto extends PartialType(
  OmitType(CreateUsuarioDto, ['contrasena', 'id_rol'] as const),
) {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(EstadoUsuario)
  estado?: EstadoUsuario;
}
