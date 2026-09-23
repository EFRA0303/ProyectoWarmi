import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { Usuario } from '../../usuarios/entities/usuario.entity.js';

@Entity('configuracion_auditoria')
@Check('CHK_configuracion_auditoria_id_configuracion', '"id_configuracion" > 0')
@Check('CHK_configuracion_auditoria_updated_by', '"updated_by" > 0')
export class ConfiguracionAuditoria {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_configuracion: number;

  // Datos principales
  @Column({ type: 'varchar', length: 80, unique: true })
  codigo_evento: string;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 60 })
  categoria: string;

  // Configuración
  @Column({ type: 'boolean', default: true })
  habilitado: boolean;

  @Column({ type: 'boolean', default: false })
  es_obligatorio: boolean;

  // Auditoría
  @Column({ type: 'integer', nullable: true })
  created_by: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @Column({ type: 'integer', nullable: true })
  updated_by: number | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  // Relaciones de auditoría
  @ManyToOne('Usuario', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creador: Relation<Usuario> | null;

  @ManyToOne('Usuario', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updated_by' })
  actualizador: Relation<Usuario> | null;
}
