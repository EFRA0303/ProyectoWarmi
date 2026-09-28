import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
export class CreateEmpresaDto {
  @IsString() @Length(1, 150) nombre_comercial: string;
  @IsOptional() @IsString() @MaxLength(150) razon_social?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono1?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono2?: string;
  @IsOptional() @IsEmail() @MaxLength(150) correo?: string;
  @IsOptional() @IsString() @MaxLength(255) direccion?: string;
  @IsOptional() @IsString() @MaxLength(200) sitio_web?: string;
  @IsOptional() @IsString() @MaxLength(255) logo_url?: string;
  @IsOptional() @IsString() @MaxLength(10) moneda?: string;
  @IsOptional() @IsEnum(EstadoGeneral) estado?: EstadoGeneral;
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
