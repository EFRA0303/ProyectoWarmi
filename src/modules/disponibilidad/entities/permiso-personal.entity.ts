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

@Entity('permisos_personal')
@Check('CHK_permisos_personal_id', '"id_permiso" > 0')
@Check('CHK_permisos_personal_fechas', '"fecha_hora_inicio" < "fecha_hora_fin"')
export class PermisoPersonal {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_permiso: number;

  @Column({ type: 'integer' })
  id_personal: number;

  @Column({ type: 'timestamptz' })
  fecha_hora_inicio: Date;

  @Column({ type: 'timestamptz' })
  fecha_hora_fin: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo: string | null;

  @Column({ type: 'boolean', default: true })
  estado: boolean;

  @ManyToOne('Personal', 'permisos', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_personal' })
  personal: Relation<Personal>;
}
