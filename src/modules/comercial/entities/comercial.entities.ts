import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import {
  CreatedEntity,
  TimestampedEntity,
} from '../../../common/entities/timestamps.entity.js';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';
import {
  EstadoAdquisicion,
  EstadoPromocion,
  TipoDescuento,
} from '../../../common/enums/domain.enums.js';

@Entity('paquetes')
@Check('CHK_paquetes_precio', '"precio" >= 0')
export class Paquete extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_paquete: number;
  @Column({ type: 'varchar', length: 120, unique: true }) nombre: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) descripcion:
    string | null;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) precio: string;
  @Column({
    type: 'enum',
    enum: EstadoGeneral,
    enumName: 'estado_general',
    default: EstadoGeneral.ACTIVO,
  })
  estado: EstadoGeneral;
}

@Entity('paquetes_servicios')
@Check('CHK_paquetes_servicios_sesiones', '"sesiones_incluidas" > 0')
export class PaqueteServicio extends TimestampedEntity {
  @PrimaryColumn({ type: 'integer' }) id_paquete: number;
  @PrimaryColumn({ type: 'integer' }) id_servicio: number;
  @Column({ type: 'integer' }) sesiones_incluidas: number;
  @ManyToOne('Paquete', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_paquete' })
  paquete: object;
  @ManyToOne('Servicio', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_servicio' })
  servicio: object;
}

@Entity('promociones')
@Check('CHK_promociones_descuento', '"valor_descuento" >= 0')
@Check('CHK_promociones_fechas', '"fecha_inicio" < "fecha_fin"')
@Check(
  'CHK_promociones_porcentaje',
  `"tipo_descuento" <> 'PORCENTAJE' OR "valor_descuento" <= 100`,
)
export class Promocion extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_promocion: number;
  @Column({ type: 'varchar', length: 120 }) nombre: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) descripcion:
    string | null;
  @Column({ type: 'enum', enum: TipoDescuento, enumName: 'tipo_descuento' })
  tipo_descuento: TipoDescuento;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) valor_descuento: string;
  @Column({ type: 'timestamptz' }) fecha_inicio: Date;
  @Column({ type: 'timestamptz' }) fecha_fin: Date;
  @Column({
    type: 'enum',
    enum: EstadoPromocion,
    enumName: 'estado_promocion',
    default: EstadoPromocion.PROGRAMADA,
  })
  estado: EstadoPromocion;
}

@Entity('promociones_servicios')
@Check('CHK_promociones_servicios_sesiones', '"sesiones_incluidas" > 0')
export class PromocionServicio extends TimestampedEntity {
  @PrimaryColumn({ type: 'integer' }) id_promocion: number;
  @PrimaryColumn({ type: 'integer' }) id_servicio: number;
  @Column({ type: 'integer', default: 1 }) sesiones_incluidas: number;
  @ManyToOne('Promocion', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_promocion' })
  promocion: object;
  @ManyToOne('Servicio', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_servicio' })
  servicio: object;
}

@Entity('adquisiciones')
@Check(
  'CHK_adquisiciones_origen',
  'NOT ("id_paquete" IS NOT NULL AND "id_promocion" IS NOT NULL)',
)
@Check(
  'CHK_adquisiciones_importes',
  '"precio_original" >= 0 AND "descuento" >= 0 AND "total" >= 0 AND "total" = "precio_original" - "descuento"',
)
export class Adquisicion extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_adquisicion: number;
  @Column({ type: 'integer' }) id_paciente: number;
  @Column({ type: 'integer', nullable: true }) id_paquete: number | null;
  @Column({ type: 'integer', nullable: true }) id_promocion: number | null;
  @Column({ type: 'timestamptz' }) fecha_adquisicion: Date;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) precio_original: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  descuento: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) total: string;
  @Column({ type: 'integer' }) registrado_por: number;
  @Column({
    type: 'enum',
    enum: EstadoAdquisicion,
    enumName: 'estado_adquisicion',
    default: EstadoAdquisicion.ACTIVA,
  })
  estado: EstadoAdquisicion;
  @ManyToOne('Paciente', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_paciente' })
  paciente: object;
  @ManyToOne('Paquete', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_paquete' })
  paquete: object | null;
  @ManyToOne('Promocion', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_promocion' })
  promocion: object | null;
  @ManyToOne('Usuario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'registrado_por' })
  registrador: object;
}

@Entity('detalles_adquisicion')
@Unique('UQ_detalle_adquisicion_servicio', ['id_adquisicion', 'id_servicio'])
@Check('CHK_detalles_adquisicion_sesiones', '"sesiones_incluidas" > 0')
@Check(
  'CHK_detalles_adquisicion_importes',
  '"precio_unitario" >= 0 AND "descuento" >= 0 AND "subtotal" >= 0',
)
@Check(
  'CHK_detalle_adquisicion_calculado',
  '"subtotal" = ROUND("precio_unitario" * "sesiones_incluidas" - "descuento", 2)',
)
export class DetalleAdquisicion extends CreatedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_detalle_adquisicion: number;
  @Column({ type: 'integer' }) id_adquisicion: number;
  @Column({ type: 'integer' }) id_servicio: number;
  @Column({ type: 'varchar', length: 120 }) nombre_servicio_snapshot: string;
  @Column({ type: 'integer' }) sesiones_incluidas: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) precio_unitario: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  descuento: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) subtotal: string;
  @ManyToOne('Adquisicion', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_adquisicion' })
  adquisicion: object;
  @ManyToOne('Servicio', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_servicio' })
  servicio: object;
}
