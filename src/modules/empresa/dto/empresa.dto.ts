import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  MaxLength,
  Matches,
  Max,
  Min,
  ValidateNested,
  IsDateString,
  ArrayMaxSize,
} from 'class-validator';
import { DiaSemana } from '../../../common/enums/dia-semana.enum.js';
import { CURRENCY_CODES } from '../data/currencies.js';
import { normalizePhoneNumber } from '../../../common/utils/phone-number.js';

export class CreateEmpresaDto {
  @IsString() @Length(1, 150) nombre_comercial: string;
  @IsOptional() @IsString() @MaxLength(150) razon_social?: string;
  @IsOptional() @IsString() @MaxLength(30) nit?: string;
  @IsOptional() @IsString() @MaxLength(180) actividad_economica?: string;
  @IsOptional()
  @Transform(({ value }) => normalizePhoneNumber(value))
  @IsString()
  @IsPhoneNumber(undefined, {
    message: 'El teléfono principal no es válido para el país seleccionado',
  })
  @MaxLength(16)
  telefono1?: string;
  @IsOptional()
  @Transform(({ value }) => normalizePhoneNumber(value))
  @IsString()
  @IsPhoneNumber(undefined, {
    message: 'El teléfono alternativo no es válido para el país seleccionado',
  })
  @MaxLength(16)
  telefono2?: string;
  @IsOptional() @IsEmail() @MaxLength(150) correo?: string;
  @IsOptional() @IsString() @MaxLength(255) direccion?: string;
  @IsOptional() @IsString() @MaxLength(200) sitio_web?: string;
  @IsOptional() @IsString() @MaxLength(255) logo_url?: string;
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(10)
  @IsIn(CURRENCY_CODES, {
    message: 'La moneda no pertenece al catálogo ISO 4217 permitido',
  })
  moneda?: string;
  @IsOptional() @IsString() @MaxLength(180) eslogan_principal?: string;
  @IsOptional() @IsString() @MaxLength(180) titulo_login?: string;
  @IsOptional() @IsString() @MaxLength(320) descripcion_corta?: string;
}
export class UpdateEmpresaDto extends PartialType(CreateEmpresaDto) {}
export class CreateConfiguracionDocumentoDto {
  @Type(() => Number) @IsInt() @Min(1) id_empresa: number;
  @IsOptional() @IsString() @MaxLength(255) encabezado?: string;
  @IsOptional() @IsString() @MaxLength(255) pie_pagina?: string;
  @IsOptional() @IsBoolean() mostrar_logo?: boolean;
  @IsOptional() @IsBoolean() mostrar_direccion?: boolean;
  @IsOptional() @IsBoolean() mostrar_telefono?: boolean;
  @IsOptional() @IsBoolean() mostrar_correo?: boolean;
}
export class UpdateConfiguracionDocumentoDto extends PartialType(
  CreateConfiguracionDocumentoDto,
) {}

export class TramoHorarioAtencionDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de inicio debe tener formato HH:mm',
  })
  hora_inicio: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de fin debe tener formato HH:mm',
  })
  hora_fin: string;
}

export class HorarioSemanalDto extends TramoHorarioAtencionDto {
  @IsEnum(DiaSemana)
  dia_semana: DiaSemana;
}

export class ExcepcionHorarioDto {
  @IsDateString({}, { message: 'La fecha de la excepción no es válida' })
  fecha: string;
  @IsIn(['CERRADO', 'HORARIO_ESPECIAL'])
  tipo: 'CERRADO' | 'HORARIO_ESPECIAL';
  @IsOptional() @IsString() @MaxLength(180) motivo?: string;
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => TramoHorarioAtencionDto)
  tramos: TramoHorarioAtencionDto[];
}

export class FeriadoDto {
  @IsIn(['FIJO', 'DINAMICO'])
  tipo: 'FIJO' | 'DINAMICO';
  @IsString() @Length(1, 150) nombre: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) mes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) dia?: number;
  @IsOptional() @IsDateString({}, { message: 'La fecha del feriado no es válida' }) fecha?: string;
}

export class UpdateHorarioAtencionDto {

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(240)
  intervalo_minutos: number;
  @IsArray()
  @ArrayMinSize(1, { message: 'Configura al menos un tramo semanal' })
  @ArrayMaxSize(28)
  @ValidateNested({ each: true })
  @Type(() => HorarioSemanalDto)
  horarios_semanales: HorarioSemanalDto[];
  @IsArray()
  @ArrayMaxSize(366)
  @ValidateNested({ each: true })
  @Type(() => ExcepcionHorarioDto)
  excepciones: ExcepcionHorarioDto[];
  @IsArray()
  @ArrayMaxSize(366)
  @ValidateNested({ each: true })
  @Type(() => FeriadoDto)
  feriados: FeriadoDto[];
}
