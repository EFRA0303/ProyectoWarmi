import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { Servicio } from './servicio.entity.js';
import type { TipoMedida } from './tipo-medida.entity.js';

@Entity('servicios_medidas')
export class ServicioMedida {
  @PrimaryColumn({ type: 'integer' })
  id_servicio: number;

  @PrimaryColumn({ type: 'integer' })
  id_tipo_medida: number;

  @Column({ type: 'boolean', default: false })
  obligatorio: boolean;

  @ManyToOne('Servicio', 'medidas', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_servicio' })
  servicio: Relation<Servicio>;

  @ManyToOne('TipoMedida', 'servicios', {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_tipo_medida' })
  tipoMedida: Relation<TipoMedida>;
}
