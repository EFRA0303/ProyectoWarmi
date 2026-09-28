import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CanalNotificacion,
  EstadoCita,
  EstadoNotificacion,
  SolicitanteReprogramacion,
  TipoNotificacion,
} from '../../../common/enums/domain.enums.js';
export class CreateCitaDto {
  @Type(() => Number) @IsInt() @Min(1) id_paciente: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_tratamiento?: number;
  @Type(() => Number) @IsInt() @Min(1) id_personal: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) numero_sesion?: number;
  @IsDateString() fecha_hora_inicio: string;
  @IsDateString() fecha_hora_fin: string;
  @IsOptional() @IsDateString() fecha_llegada?: string;
  @IsOptional() @IsEnum(EstadoCita) estado?: EstadoCita;
  @IsOptional() @IsString() @MaxLength(255) observaciones?: string;
}
export class UpdateCitaDto extends PartialType(CreateCitaDto) {}
export class ReprogramarCitaDto {
  @IsDateString() inicio_nuevo: string;
  @IsDateString() fin_nuevo: string;
  @IsOptional() @IsString() @MaxLength(255) motivo?: string;
  @IsEnum(SolicitanteReprogramacion)
  solicitado_por_tipo: SolicitanteReprogramacion;
}
export class CreateNotificacionCitaDto {
  @Type(() => Number) @IsInt() @Min(1) id_cita: number;
  @IsEnum(TipoNotificacion) tipo: TipoNotificacion;
  @IsEnum(CanalNotificacion) canal: CanalNotificacion;
  @IsDateString() programada_para: string;
  @IsOptional() @IsDateString() enviada_en?: string;
  @IsOptional() @IsEnum(EstadoNotificacion) estado?: EstadoNotificacion;
}
export class UpdateNotificacionCitaDto extends PartialType(
  CreateNotificacionCitaDto,
) {}
