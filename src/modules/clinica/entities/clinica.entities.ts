import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  CreatedEntity,
  TimestampedEntity,
} from '../../../common/entities/timestamps.entity.js';
import {
  EstadoSolicitud,
  EstadoTratamiento,
  TipoValoracion,
} from '../../../common/enums/domain.enums.js';

@Entity('solicitudes_servicio')
export class SolicitudServicio extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_solicitud: number;
  @Column({ type: 'integer' }) id_historial: number;
  @Column({ type: 'integer' }) id_servicio: number;
  @Column({ type: 'timestamptz' }) fecha_solicitud: Date;
  @Column({ type: 'varchar', length: 255, nullable: true }) motivo:
    string | null;
  @Column({
    type: 'enum',
    enum: EstadoSolicitud,
    enumName: 'estado_solicitud',
    default: EstadoSolicitud.PENDIENTE,
  })
  estado: EstadoSolicitud;
  @ManyToOne('Historial', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_historial' })
  historial: object;
  @ManyToOne('Servicio', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_servicio' })
  servicio: object;
}

@Entity('tratamientos_paciente')
@Check('CHK_tratamientos_sesiones', '"sesiones_iniciales" > 0')
export class TratamientoPaciente extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_tratamiento: number;
  @Column({ type: 'integer' }) id_historial: number;
  @Column({ type: 'integer' }) id_servicio: number;
  @Column({ type: 'integer' }) indicado_por: number;
  @Column({ type: 'integer', nullable: true }) id_detalle_adquisicion:
    number | null;
  @Column({ type: 'integer' }) sesiones_iniciales: number;
  @Column({ type: 'date', nullable: true }) fecha_inicio: string | null;
  @Column({
    type: 'enum',
    enum: EstadoTratamiento,
    enumName: 'estado_tratamiento',
    default: EstadoTratamiento.PENDIENTE,
  })
  estado: EstadoTratamiento;
  @Column({ type: 'text', nullable: true }) observaciones: string | null;
  @ManyToOne('Historial', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_historial' })
  historial: object;
  @ManyToOne('Servicio', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_servicio' })
  servicio: object;
  @ManyToOne('Personal', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'indicado_por' })
  indicador: object;
  @ManyToOne('DetalleAdquisicion', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_detalle_adquisicion' })
  detalle_adquisicion: object | null;
}

@Entity('ampliaciones_tratamiento')
@Check('CHK_ampliaciones_sesiones', '"sesiones_agregadas" > 0')
export class AmpliacionTratamiento extends CreatedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_ampliacion: number;
  @Column({ type: 'integer' }) id_tratamiento: number;
  @Column({ type: 'integer' }) sesiones_agregadas: number;
  @Column({ type: 'integer' }) autorizado_por: number;
  @Column({ type: 'timestamptz' }) fecha_ampliacion: Date;
  @Column({ type: 'varchar', length: 255, nullable: true }) motivo:
    string | null;
  @ManyToOne('TratamientoPaciente', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_tratamiento' })
  tratamiento: object;
  @ManyToOne('Personal', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'autorizado_por' })
  autorizador: object;
}

@Entity('sesiones')
export class Sesion extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_sesion: number;
  @Column({ type: 'integer' }) id_tratamiento: number;
  @Column({ type: 'integer', nullable: true, unique: true }) id_cita:
    number | null;
  @Column({ type: 'integer' }) atendido_por: number;
  @Column({ type: 'timestamptz' }) fecha_sesion: Date;
  @Column({ type: 'text', nullable: true }) observaciones: string | null;
  @ManyToOne('TratamientoPaciente', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_tratamiento' })
  tratamiento: object;
  @OneToOne('Cita', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_cita' })
  cita: object | null;
  @ManyToOne('Personal', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'atendido_por' })
  personal: object;
}

@Entity('valoraciones')
@Check(
  'CHK_valoraciones_origen',
  'num_nonnulls("id_solicitud", "id_tratamiento", "id_sesion") <= 1',
)
export class Valoracion extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_valoracion: number;
  @Column({ type: 'integer' }) id_historial: number;
  @Column({ type: 'integer', nullable: true }) id_solicitud: number | null;
  @Column({ type: 'integer', nullable: true }) id_tratamiento: number | null;
  @Column({ type: 'integer', nullable: true }) id_sesion: number | null;
  @Column({ type: 'integer' }) id_personal: number;
  @Column({ type: 'enum', enum: TipoValoracion, enumName: 'tipo_valoracion' })
  tipo: TipoValoracion;
  @Column({ type: 'timestamptz' }) fecha_valoracion: Date;
  @Column({ type: 'text', nullable: true }) observaciones: string | null;
  @ManyToOne('Historial', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_historial' })
  historial: object;
  @ManyToOne('SolicitudServicio', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_solicitud' })
  solicitud: object | null;
  @ManyToOne('TratamientoPaciente', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_tratamiento' })
  tratamiento: object | null;
  @ManyToOne('Sesion', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_sesion' })
  sesion: object | null;
  @ManyToOne('Personal', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_personal' })
  personal: object;
}

@Entity('valoraciones_medidas')
export class ValoracionMedida extends CreatedEntity {
  @PrimaryColumn({ type: 'integer' }) id_valoracion: number;
  @PrimaryColumn({ type: 'integer' }) id_tipo_medida: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) valor: string;
  @ManyToOne('Valoracion', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_valoracion' })
  valoracion: object;
  @ManyToOne('TipoMedida', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_tipo_medida' })
  tipo_medida: object;
}
