import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { Usuario } from '../../usuarios/entities/usuario.entity.js';

@Entity('auditoria')
@Check('CHK_auditoria_id_auditoria', '"id_auditoria" > 0')
@Check('CHK_auditoria_id_usuario_accion', '"id_usuario_accion" > 0')
@Check('CHK_auditoria_id_usuario_afectado', '"id_usuario_afectado" > 0')
@Check('CHK_auditoria_id_registro', '"id_registro" > 0')
export class Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id_auditoria: string;

  // Usuarios involucrados
  @Column({ type: 'integer' })
  id_usuario_accion: number;

  @Column({ type: 'integer', nullable: true })
  id_usuario_afectado: number | null;

  // Acción registrada
  @Column({ type: 'varchar', length: 80 })
  accion: string;

  @Column({ type: 'varchar', length: 60 })
  entidad: string;

  @Column({ type: 'bigint', nullable: true })
  id_registro: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  // Contexto técnico
  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  // Fecha del evento
  @CreateDateColumn({ type: 'timestamptz', name: 'fecha' })
  fecha: Date;

  // Relaciones
  @ManyToOne('Usuario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_usuario_accion' })
  usuarioAccion: Relation<Usuario>;

  @ManyToOne('Usuario', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_usuario_afectado' })
  usuarioAfectado: Relation<Usuario> | null;
}
