import {
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  Check,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Genero } from '../../../common/enums/genero.enum.js';
import type { Paciente } from '../../pacientes/entities/paciente.entity.js';
import type { Usuario } from '../../usuarios/entities/usuario.entity.js';

@Entity('personas')
@Check('CHK_personas_id_persona', '"id_persona" > 0')
export class Persona {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_persona: number;

  // Datos personales
  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 100 })
  ap_paterno: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ap_materno: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  ci: string | null;

  @Column({ type: 'date', nullable: true })
  fecha_nac: string | null;

  @Column({ type: 'enum', enum: Genero, enumName: 'genero' })
  genero: Genero;

  // Contacto
  @Column({ type: 'varchar', length: 30, unique: true })
  telefono1: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono2: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  direccion: string | null;

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

  // Relaciones principales
  @OneToOne('Paciente', 'persona')
  paciente: Relation<Paciente> | null;

  @OneToOne('Usuario', 'persona')
  usuario: Relation<Usuario> | null;
}
