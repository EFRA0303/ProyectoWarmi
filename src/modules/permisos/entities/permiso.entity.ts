import type { Usuario } from '../../usuarios/entities/usuario.entity.js';
import type { Relation } from 'typeorm';
import {
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Check,
} from 'typeorm';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';

@Entity('permisos')
@Check('CHK_permisos_id_permiso', '"id_permiso" > 0')
export class Permiso {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_permiso: number;

  // Datos principales
  @Column({ type: 'varchar', length: 80, unique: true })
  permiso: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({
    type: 'enum',
    enum: EstadoGeneral,
    enumName: 'estado_general',
    default: EstadoGeneral.ACTIVO,
  })
  estado: EstadoGeneral;

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
}
