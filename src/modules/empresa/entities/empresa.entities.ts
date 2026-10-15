import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { DiaSemana } from '../../../common/enums/dia-semana.enum.js';
import { TimestampedEntity } from '../../../common/entities/timestamps.entity.js';

@Entity('empresas')
export class Empresa extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_empresa: number;
  @Column({ type: 'varchar', length: 150 }) nombre_comercial: string;
  @Column({ type: 'varchar', length: 150, nullable: true }) razon_social:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true, unique: true }) nit:
    string | null;
  @Column({ type: 'varchar', length: 180, nullable: true })
  actividad_economica: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) telefono1:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) telefono2:
    string | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) correo:
    string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) direccion:
    string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) sitio_web:
    string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) logo_url:
    string | null;
  @Column({ type: 'varchar', length: 10, default: 'BOB' }) moneda: string;
  @Column({ type: 'varchar', length: 180, nullable: true }) eslogan_principal:
    string | null;
  @Column({ type: 'varchar', length: 180, nullable: true }) titulo_login:
    string | null;
  @Column({ type: 'varchar', length: 320, nullable: true }) descripcion_corta:
    string | null;
  @Column({ type: 'varchar', length: 255, nullable: true })
  imagen_fondo_login_url: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true })
  imagen_fondo_panel_login_url: string | null;
}

@Entity('configuraciones_documentos')
export class ConfiguracionDocumento extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_configuracion: number;
  @Column({ type: 'integer', unique: true }) id_empresa: number;
  @Column({ type: 'varchar', length: 255, nullable: true }) encabezado:
    string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) pie_pagina:
    string | null;
  @Column({ type: 'boolean', default: true }) mostrar_logo: boolean;
  @Column({ type: 'boolean', default: true }) mostrar_direccion: boolean;
  @Column({ type: 'boolean', default: true }) mostrar_telefono: boolean;
  @Column({ type: 'boolean', default: true }) mostrar_correo: boolean;
  @OneToOne('Empresa', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_empresa' })
  empresa: object;
}

@Entity('configuraciones_horario_atencion')
@Check(
  'CHK_configuraciones_horario_atencion_intervalo',
  '"intervalo_minutos" >= 5 AND "intervalo_minutos" <= 240',
)
export class ConfiguracionHorarioAtencion {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_configuracion_horario: number;

  @Column({ type: 'integer', unique: true })
  id_empresa: number;

  @Column({ type: 'integer', default: 30 })
  intervalo_minutos: number;

  @ManyToOne('Empresa', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa>;
}

@Entity('horarios_atencion_semanal')
@Check('CHK_horarios_atencion_semanal_horas', '"hora_inicio" < "hora_fin"')
export class HorarioAtencionSemanal {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_horario_atencion: number;
  @Column({ type: 'integer' })
  id_configuracion_horario: number;
  @Column({ type: 'enum', enum: DiaSemana, enumName: 'dia_semana' })
  dia_semana: DiaSemana;
  @Column({ type: 'time' })
  hora_inicio: string;
  @Column({ type: 'time' })
  hora_fin: string;
  @ManyToOne('ConfiguracionHorarioAtencion', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_configuracion_horario' })
  configuracion: Relation<ConfiguracionHorarioAtencion>;
}

@Entity('excepciones_horario_atencion')
@Check(
  'CHK_excepciones_horario_atencion_tipo',
  '"tipo" IN (\'CERRADO\', \'HORARIO_ESPECIAL\')',
)
export class ExcepcionHorarioAtencion {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_excepcion_horario: number;
  @Column({ type: 'integer' })
  id_configuracion_horario: number;
  @Column({ type: 'date', unique: true })
  fecha: string;
  @Column({ type: 'varchar', length: 20 })
  tipo: 'CERRADO' | 'HORARIO_ESPECIAL';
  @Column({ type: 'varchar', length: 180, nullable: true })
  motivo: string | null;
  @ManyToOne('ConfiguracionHorarioAtencion', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_configuracion_horario' })
  configuracion: Relation<ConfiguracionHorarioAtencion>;
}

@Entity('tramos_excepcion_horario_atencion')
@Check(
  'CHK_tramos_excepcion_horario_atencion_horas',
  '"hora_inicio" < "hora_fin"',
)
export class TramoExcepcionHorarioAtencion {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_tramo_excepcion: number;
  @Column({ type: 'integer' })
  id_excepcion_horario: number;
  @Column({ type: 'time' })
  hora_inicio: string;
  @Column({ type: 'time' })
  hora_fin: string;
  @ManyToOne('ExcepcionHorarioAtencion', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_excepcion_horario' })
  excepcion: Relation<ExcepcionHorarioAtencion>;
}

@Entity('feriados')
@Check('CHK_feriados_tipo', '"tipo" IN (\'FIJO\', \'DINAMICO\')')
@Check(
  'CHK_feriados_fecha_tipo',
  '("tipo" = \'FIJO\' AND "mes" IS NOT NULL AND "dia" IS NOT NULL AND "fecha" IS NULL) OR ("tipo" = \'DINAMICO\' AND "fecha" IS NOT NULL AND "mes" IS NULL AND "dia" IS NULL)',
)
@Check('CHK_feriados_mes', '"mes" IS NULL OR ("mes" BETWEEN 1 AND 12)')
@Check('CHK_feriados_dia', '"dia" IS NULL OR ("dia" BETWEEN 1 AND 31)')
export class Feriado {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_feriado: number;
  @Column({ type: 'integer' })
  id_configuracion_horario: number;
  @Column({ type: 'varchar', length: 10 })
  tipo: 'FIJO' | 'DINAMICO';
  @Column({ type: 'varchar', length: 150 })
  nombre: string;
  @Column({ type: 'smallint', nullable: true })
  mes: number | null;
  @Column({ type: 'smallint', nullable: true })
  dia: number | null;
  @Column({ type: 'date', nullable: true })
  fecha: string | null;
  @ManyToOne('ConfiguracionHorarioAtencion', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_configuracion_horario' })
  configuracion: Relation<ConfiguracionHorarioAtencion>;
}
