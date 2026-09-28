import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { Personal } from '../../personal/entities/personal.entity.js';

@Entity('bloqueos_personal')
@Check('CHK_bloqueos_personal_id', '"id_bloqueo" > 0')
@Check('CHK_bloqueos_personal_fechas', '"fecha_hora_inicio" < "fecha_hora_fin"')
export class BloqueoPersonal {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_bloqueo: number;

  @Column({ type: 'integer' })
  id_personal: number;

  @Column({ type: 'timestamptz' })
  fecha_hora_inicio: Date;

  @Column({ type: 'timestamptz' })
  fecha_hora_fin: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo: string | null;

  @ManyToOne('Personal', 'bloqueos', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_personal' })
  personal: Relation<Personal>;
}
