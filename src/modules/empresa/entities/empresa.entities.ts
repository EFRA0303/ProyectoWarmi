import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TimestampedEntity } from '../../../common/entities/timestamps.entity.js';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';

@Entity('empresas')
export class Empresa extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_empresa: number;
  @Column({ type: 'varchar', length: 150 }) nombre_comercial: string;
  @Column({ type: 'varchar', length: 150, nullable: true }) razon_social:
    string | null;
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
  @Column({
    type: 'enum',
    enum: EstadoGeneral,
    enumName: 'estado_general',
    default: EstadoGeneral.ACTIVO,
  })
  estado: EstadoGeneral;
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
