import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { Servicio } from './servicio.entity.js';
import type { TipoMedida } from './tipo-medida.entity.js';
import { MomentoMedicion } from '../../../common/enums/momento-medicion.enum.js';

@Entity('servicios_medidas')
@Check(
  'CHK_servicios_medidas_momentos',
  `cardinality(momentos) BETWEEN 1 AND 3 AND momentos <@ ARRAY['INICIAL', 'CADA_SESION', 'FINAL']::text[] AND array_position(momentos, NULL) IS NULL`,
)
export class ServicioMedida {
  @PrimaryColumn({ type: 'integer' })
  id_servicio: number;

  @PrimaryColumn({ type: 'integer' })
  id_tipo_medida: number;

  @Column({ type: 'boolean', default: false })
  obligatorio: boolean;

  @Column({
    type: 'text',
    array: true,
    default: () => "ARRAY['INICIAL', 'FINAL']::text[]",
  })
  momentos: MomentoMedicion[];

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
