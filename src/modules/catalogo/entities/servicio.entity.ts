import {
  Check,
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
import type { CategoriaServicio } from './categoria-servicio.entity.js';
import type { ServicioMedida } from './servicio-medida.entity.js';
import type { ServicioProducto } from '../../inventario/entities/inventario.entities.js';

@Entity('servicios')
@Unique('UQ_servicio_categoria_nombre', ['id_categoria', 'nombre'])
@Check('CHK_servicios_duracion', '"duracion_minutos" > 0')
@Check('CHK_servicios_precio', '"precio" >= 0')
@Check('CHK_servicios_sesiones', '"sesiones_incluidas" > 0')
export class Servicio {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_servicio: number;

  @Column({ type: 'integer' })
  id_categoria: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'integer' })
  duracion_minutos: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  precio: string;

  @Column({ type: 'integer', default: 1 })
  sesiones_incluidas: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ type: 'boolean', default: false })
  requiere_valoracion: boolean;

  @Column({
    type: 'enum',
    enum: EstadoGeneral,
    enumName: 'estado_general',
    default: EstadoGeneral.ACTIVO,
  })
  estado: EstadoGeneral;

  @ManyToOne('CategoriaServicio', 'servicios', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_categoria' })
  categoria: Relation<CategoriaServicio>;

  @OneToMany('ServicioMedida', 'servicio')
  medidas: Relation<ServicioMedida[]>;

  @OneToMany('ServicioProducto', 'servicio')
  productos: Relation<ServicioProducto[]>;
}
