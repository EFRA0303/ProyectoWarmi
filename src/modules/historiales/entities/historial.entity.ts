import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { EstadoHistorial } from '../../../common/enums/estado-historial.enum.js';
import type { Paciente } from '../../pacientes/entities/paciente.entity.js';

@Entity('historiales')
@Check('CHK_historiales_id_historial', '"id_historial" > 0')
@Check('CHK_historiales_id_paciente', '"id_paciente" > 0')
export class Historial {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_historial: number;

  @Column({ type: 'integer', unique: true })
  id_paciente: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_apertura' })
  fecha_apertura: Date;

  @Column({
    type: 'enum',
    enum: EstadoHistorial,
    enumName: 'estado_historial',
    default: EstadoHistorial.ACTIVO,
  })
  estado: EstadoHistorial;

  @Column({ type: 'text', nullable: true })
  observaciones_generales: string | null;

  @OneToOne('Paciente', 'historial', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_paciente' })
  paciente: Relation<Paciente>;
}
