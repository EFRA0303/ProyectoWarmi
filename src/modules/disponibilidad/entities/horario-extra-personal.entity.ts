import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { EstadoHorarioExtra } from '../../../common/enums/estado-horario-extra.enum.js';
import type { Personal } from '../../personal/entities/personal.entity.js';
import type { Usuario } from '../../usuarios/entities/usuario.entity.js';

@Entity('horarios_extra_personal')
@Check('CHK_horarios_extra_id', '"id_horario_extra" > 0')
@Check('CHK_horarios_extra_horas', '"hora_inicio" < "hora_fin"')
export class HorarioExtraPersonal {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_horario_extra: number;

  @Column({ type: 'integer' })
  id_personal: number;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'time' })
  hora_inicio: string;

  @Column({ type: 'time' })
  hora_fin: string;

  @Column({ type: 'integer' })
  autorizado_por: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo: string | null;

  @Column({
    type: 'enum',
    enum: EstadoHorarioExtra,
    enumName: 'estado_horario_extra',
    default: EstadoHorarioExtra.AUTORIZADO,
  })
  estado: EstadoHorarioExtra;

  @ManyToOne('Personal', 'horariosExtra', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_personal' })
  personal: Relation<Personal>;

  @ManyToOne('Usuario', 'horariosExtraAutorizados', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'autorizado_por' })
  autorizador: Relation<Usuario>;
}
