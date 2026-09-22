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
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import type { Persona } from '../../personas/entities/persona.entity.js';
import type { Usuario } from '../../usuarios/entities/usuario.entity.js';

@Entity('pacientes')
@Check('CHK_pacientes_id_paciente', '"id_paciente" > 0')
@Check('CHK_pacientes_id_persona', '"id_persona" > 0')
@Check('CHK_pacientes_created_by', '"created_by" > 0')
@Check('CHK_pacientes_updated_by', '"updated_by" > 0')
export class Paciente {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_paciente: number;

  // Relación base
  @Column({ type: 'integer', unique: true })
  id_persona: number;

  // Datos del paciente
  @Column({ type: 'varchar', length: 60, nullable: true })
  ocupacion: string | null;

  @Column({
    type: 'enum',
    enum: EstadoGeneral,
    enumName: 'estado_general',
    default: EstadoGeneral.ACTIVO,
  })
  estado: EstadoGeneral;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo_baja: string | null;

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
  @OneToOne('Persona', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona' })
  persona: Relation<Persona>;

  // Relaciones de auditoría
  @ManyToOne('Usuario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creador: Relation<Usuario>;

  @ManyToOne('Usuario', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updated_by' })
  actualizador: Relation<Usuario> | null;
}