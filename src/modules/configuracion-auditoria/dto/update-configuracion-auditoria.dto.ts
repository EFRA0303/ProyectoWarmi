import { PartialType } from '@nestjs/mapped-types';
import { CreateConfiguracionAuditoriaDto } from './create-configuracion-auditoria.dto.js';

export class UpdateConfiguracionAuditoriaDto extends PartialType(
  CreateConfiguracionAuditoriaDto,
) {}
