import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';

export class CreateAreaDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string | null;
}

export class UpdateAreaDto extends PartialType(CreateAreaDto) {
  @IsOptional()
  @IsEnum(EstadoGeneral)
  estado?: EstadoGeneral;
}
