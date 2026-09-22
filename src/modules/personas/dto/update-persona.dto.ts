import { PartialType } from '@nestjs/mapped-types';
import { CreatePersonaDto } from './create-persona.dto.js';

export class UpdatePersonaDto extends PartialType(CreatePersonaDto) {}
