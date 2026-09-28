import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import type { ServicioMedida } from './servicio-medida.entity.js';

@Entity('tipos_medida')
export class TipoMedida {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_tipo_medida: number;

  @Column({ type: 'varchar', length: 80, unique: true })
  nombre: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unidad: string | null;

  @Column({
    type: 'enum',
    enum: EstadoGeneral,
    enumName: 'estado_general',
    default: EstadoGeneral.ACTIVO,
  })
  estado: EstadoGeneral;

  @OneToMany('ServicioMedida', 'tipoMedida')
  servicios: Relation<ServicioMedida[]>;
}
