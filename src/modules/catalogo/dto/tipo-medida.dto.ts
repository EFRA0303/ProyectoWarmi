import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';

export class CreateTipoMedidaDto {
  @IsString()
  @MaxLength(80)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unidad?: string | null;
}

export class UpdateTipoMedidaDto extends PartialType(CreateTipoMedidaDto) {
  @IsOptional()
  @IsEnum(EstadoGeneral)
  estado?: EstadoGeneral;
}
