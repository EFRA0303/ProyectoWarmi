import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';

@Entity('categorias_producto')
export class CategoriaProducto {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id_categoria_producto: number;

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
}
