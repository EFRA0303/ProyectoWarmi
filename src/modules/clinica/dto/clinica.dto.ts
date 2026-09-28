import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EstadoSolicitud,
  EstadoTratamiento,
  TipoValoracion,
} from '../../../common/enums/domain.enums.js';
export class CreateSolicitudDto {
  @Type(() => Number) @IsInt() @Min(1) id_historial: number;
  @Type(() => Number) @IsInt() @Min(1) id_servicio: number;
  @IsDateString() fecha_solicitud: string;
  @IsOptional() @IsString() @MaxLength(255) motivo?: string;
  @IsOptional() @IsEnum(EstadoSolicitud) estado?: EstadoSolicitud;
}
export class UpdateSolicitudDto {
  @IsOptional() @IsString() @MaxLength(255) motivo?: string;
  @IsOptional() @IsEnum(EstadoSolicitud) estado?: EstadoSolicitud;
}
export class CreateTratamientoDto {
  @Type(() => Number) @IsInt() @Min(1) id_historial: number;
  @Type(() => Number) @IsInt() @Min(1) id_servicio: number;
  @Type(() => Number) @IsInt() @Min(1) indicado_por: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_detalle_adquisicion?: number;
  @Type(() => Number) @IsInt() @Min(1) sesiones_iniciales: number;
  @IsOptional() @IsDateString() fecha_inicio?: string;
  @IsOptional() @IsEnum(EstadoTratamiento) estado?: EstadoTratamiento;
  @IsOptional() @IsString() observaciones?: string;
}
export class UpdateTratamientoDto {
  @IsOptional() @IsDateString() fecha_inicio?: string;
  @IsOptional() @IsEnum(EstadoTratamiento) estado?: EstadoTratamiento;
  @IsOptional() @IsString() observaciones?: string;
}
export class CreateAmpliacionDto {
  @Type(() => Number) @IsInt() @Min(1) sesiones_agregadas: number;
  @Type(() => Number) @IsInt() @Min(1) autorizado_por: number;
  @IsDateString() fecha_ampliacion: string;
  @IsOptional() @IsString() @MaxLength(255) motivo?: string;
}
export class CreateSesionDto {
  @Type(() => Number) @IsInt() @Min(1) id_tratamiento: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_cita?: number;
  @Type(() => Number) @IsInt() @Min(1) atendido_por: number;
  @IsDateString() fecha_sesion: string;
  @IsOptional() @IsString() observaciones?: string;
}
export class UpdateSesionDto {
  @IsOptional() @IsString() observaciones?: string;
}
export class CreateValoracionDto {
  @Type(() => Number) @IsInt() @Min(1) id_historial: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_solicitud?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_tratamiento?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_sesion?: number;
  @Type(() => Number) @IsInt() @Min(1) id_personal: number;
  @IsEnum(TipoValoracion) tipo: TipoValoracion;
  @IsDateString() fecha_valoracion: string;
  @IsOptional() @IsString() observaciones?: string;
}
export class UpdateValoracionDto {
  @IsOptional() @IsString() observaciones?: string;
}
export class RegistrarMedidaDto {
  @Type(() => Number) @IsInt() @Min(1) id_tipo_medida: number;
  @IsNumberString() valor: string;
}
