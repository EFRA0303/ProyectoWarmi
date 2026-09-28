import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import type { Area } from './area.entity.js';
import type { Servicio } from './servicio.entity.js';

@Entity('categorias_servicio')
@Unique('UQ_categoria_area_nombre', ['id_area', 'nombre'])
export class CategoriaServicio {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_categoria: number;

  @Column({ type: 'integer' })
  id_area: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({
    type: 'enum',
    enum: EstadoGeneral,
    enumName: 'estado_general',
    default: EstadoGeneral.ACTIVO,
  })
  estado: EstadoGeneral;

  @ManyToOne('Area', 'categorias', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_area' })
  area: Relation<Area>;

  @OneToMany('Servicio', 'categoria')
  servicios: Relation<Servicio[]>;
}
