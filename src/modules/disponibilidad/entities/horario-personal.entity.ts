import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { DiaSemana } from '../../../common/enums/dia-semana.enum.js';
import type { Personal } from '../../personal/entities/personal.entity.js';

@Entity('horarios_personal')
@Unique('UQ_horario_personal_tramo', [
  'id_personal',
  'dia_semana',
  'hora_inicio',
  'hora_fin',
])
@Check('CHK_horarios_personal_id', '"id_horario" > 0')
@Check('CHK_horarios_personal_horas', '"hora_inicio" < "hora_fin"')
export class HorarioPersonal {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_horario: number;

  @Column({ type: 'integer' })
  id_personal: number;

  @Column({ type: 'enum', enum: DiaSemana, enumName: 'dia_semana' })
  dia_semana: DiaSemana;

  @Column({ type: 'time' })
  hora_inicio: string;

  @Column({ type: 'time' })
  hora_fin: string;

  @Column({ type: 'boolean', default: true })
  estado: boolean;

  @ManyToOne('Personal', 'horarios', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_personal' })
  personal: Relation<Personal>;
}
