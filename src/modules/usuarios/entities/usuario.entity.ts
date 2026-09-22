import {
  UpdateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
  Check,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { EstadoUsuario } from '../../../common/enums/estado-usuario.enum.js';
import type { Persona } from '../../personas/entities/persona.entity.js';
import type { Rol } from '../../roles/entities/rol.entity.js';
import type { Personal } from '../../personal/entities/personal.entity.js';

@Entity('usuarios')
@Check('CHK_usuarios_id_usuario', '"id_usuario" > 0')
@Check('CHK_usuarios_id_persona', '"id_persona" > 0')
@Check('CHK_usuarios_id_rol', '"id_rol" BETWEEN 1 AND 255')
@Check(
  'CHK_usuarios_intentos_fallidos',
  '"intentos_fallidos" BETWEEN 0 AND 255',
)
@Check('CHK_usuarios_created_by', '"created_by" > 0')
@Check('CHK_usuarios_updated_by', '"updated_by" > 0')
export class Usuario {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_usuario: number;

  // Relaciones base
  @Column({ type: 'integer', unique: true })
  id_persona: number;

  @Column({ type: 'smallint' })
  id_rol: number;

  // Credenciales
  @Column({ type: 'varchar', length: 150, unique: true })
  correo_acceso: string;

  @Column({ type: 'varchar', length: 50, nullable: true, unique: true })
  nombre_usuario: string | null;

  @Column({ type: 'varchar', length: 255, select: false })
  contrasena_hash: string;

  // Estado de la cuenta
  @Column({
    type: 'enum',
    enum: EstadoUsuario,
    enumName: 'estado_usuario',
    default: EstadoUsuario.ACTIVO,
  })
  estado: EstadoUsuario;

  @Column({ type: 'smallint', default: 0 })
  intentos_fallidos: number;

  @Column({ type: 'timestamptz', nullable: true })
  bloqueado_hasta: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  ultimo_acceso_en: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cambio_contrasena_en: Date | null;

  // Recuperación de contraseña
  @Column({ type: 'char', length: 64, nullable: true, select: false })
  token_recuperacion_hash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  token_recuperacion_expira: Date | null;

  // Auditoría
  @Column({ type: 'integer', nullable: true })
  created_by: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @Column({ type: 'integer', nullable: true })
  updated_by: number | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  // Relaciones principales
  @OneToOne('Persona', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona' })
  persona: Relation<Persona>;

  @ManyToOne('Rol', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_rol' })
  rol: Relation<Rol>;

  @OneToOne('Personal', 'usuario')
  personal: Relation<Personal> | null;

  // Relaciones de auditoría
  @ManyToOne('Usuario', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creador: Relation<Usuario> | null;

  @ManyToOne('Usuario', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updated_by' })
  actualizador: Relation<Usuario> | null;
}