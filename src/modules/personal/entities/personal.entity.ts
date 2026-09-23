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
import type { Usuario } from '../../usuarios/entities/usuario.entity.js';

@Entity('personal')
@Check('CHK_personal_id_personal', '"id_personal" > 0')
@Check('CHK_personal_id_usuario', '"id_usuario" > 0')
@Check('CHK_personal_created_by', '"created_by" > 0')
@Check('CHK_personal_updated_by', '"updated_by" > 0')
export class Personal {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_personal: number;

  // Relación base
  @Column({ type: 'integer', unique: true })
  id_usuario: number;

  // Datos laborales
  @Column({ type: 'varchar', length: 80 })
  profesion: string;

  @Column({ type: 'varchar', length: 80 })
  cargo: string;

  @Column({ type: 'date' })
  fecha_ingreso: string;

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
  @OneToOne('Usuario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  // Relaciones de auditoría
  @ManyToOne('Usuario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creador: Relation<Usuario>;

  @ManyToOne('Usuario', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updated_by' })
  actualizador: Relation<Usuario> | null;
}
