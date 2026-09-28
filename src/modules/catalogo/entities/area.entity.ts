import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import type { CategoriaServicio } from './categoria-servicio.entity.js';

@Entity('areas')
export class Area {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_area: number;

  @Column({ type: 'varchar', length: 100, unique: true })
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

  @OneToMany('CategoriaServicio', 'area')
  categorias: Relation<CategoriaServicio[]>;
}
