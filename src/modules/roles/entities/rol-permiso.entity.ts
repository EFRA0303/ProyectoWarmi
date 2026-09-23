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
import type { Rol } from '../../roles/entities/rol.entity.js';
import type { Permiso } from '../../permisos/entities/permiso.entity.js';
import type { Usuario } from '../../usuarios/entities/usuario.entity.js';

@Entity('roles_permisos')
@Check('CHK_roles_permisos_id_rol', '"id_rol" BETWEEN 1 AND 255')
@Check('CHK_roles_permisos_id_permiso', '"id_permiso" > 0')
@Check('CHK_roles_permisos_created_by', '"created_by" > 0')
export class RolPermiso {
  // Clave primaria compuesta
  @PrimaryColumn({ type: 'smallint' })
  id_rol: number;

  @PrimaryColumn({ type: 'integer' })
  id_permiso: number;

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
  @ManyToOne('Rol', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_rol' })
  rol: Relation<Rol>;

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
