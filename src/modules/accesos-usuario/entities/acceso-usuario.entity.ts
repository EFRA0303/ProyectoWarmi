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

@Entity('accesos_usuario')
@Check('CHK_accesos_usuario_id_acceso', '"id_acceso" > 0')
@Check('CHK_accesos_usuario_id_usuario', '"id_usuario" > 0')
export class AccesoUsuario {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id_acceso: string;

  // Usuario o intento de acceso
  @Column({ type: 'integer', nullable: true })
  id_usuario: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  identificador_intento: string | null;

  // Fechas de acceso
  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_login' })
  fecha_login: Date;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_logout: Date | null;

  // Resultado del acceso
  @Column({ type: 'boolean', default: true })
  login_exitoso: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  motivo_fallo: string | null;

  // Contexto técnico
  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  // Relación
  @ManyToOne('Usuario', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario> | null;
}
