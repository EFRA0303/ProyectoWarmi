import {
  UpdateDateColumn,
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { Usuario } from '../../usuarios/entities/usuario.entity.js';
import type { Permiso } from '../../permisos/entities/permiso.entity.js';

@Entity('usuarios_permisos')
@Check('CHK_usuarios_permisos_id_usuario', '"id_usuario" > 0')
@Check('CHK_usuarios_permisos_id_permiso', '"id_permiso" > 0')
@Check('CHK_usuarios_permisos_created_by', '"created_by" > 0')
export class UsuarioPermiso {
  // Clave primaria compuesta
  @PrimaryColumn({ type: 'integer' })
  id_usuario: number;

  @PrimaryColumn({ type: 'integer' })
  id_permiso: number;

  // Datos principales
  @Column({ type: 'boolean', default: true })
  permitido: boolean;

  // Auditoría
  @Column({ type: 'integer' })
  created_by: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @Column({ type: 'integer', nullable: true })
  updated_by: number | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  // Relaciones principales
  @ManyToOne('Usuario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  @ManyToOne('Permiso', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_permiso' })
  permiso: Relation<Permiso>;

  // Relaciones de auditoría
  @ManyToOne('Usuario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  asignador: Relation<Usuario>;

  @ManyToOne('Usuario', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updated_by' })
  actualizador: Relation<Usuario> | null;
}
