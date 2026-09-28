import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import {
  CreatedEntity,
  TimestampedEntity,
} from '../../../common/entities/timestamps.entity.js';
import {
  CanalNotificacion,
  EstadoCita,
  EstadoNotificacion,
  SolicitanteReprogramacion,
  TipoNotificacion,
} from '../../../common/enums/domain.enums.js';

@Entity('citas')
@Unique('UQ_citas_tratamiento_sesion', ['id_tratamiento', 'numero_sesion'])
@Check(
  'CHK_citas_numero_sesion',
  '"numero_sesion" IS NULL OR "numero_sesion" > 0',
)
@Check('CHK_citas_fechas', '"fecha_hora_inicio" < "fecha_hora_fin"')
@Index('IDX_citas_personal_inicio', ['id_personal', 'fecha_hora_inicio'])
export class Cita extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_cita: number;
  @Column({ type: 'integer' }) id_paciente: number;
  @Column({ type: 'integer', nullable: true }) id_tratamiento: number | null;
  @Column({ type: 'integer' }) id_personal: number;
  @Column({ type: 'integer', nullable: true }) numero_sesion: number | null;
  @Column({ type: 'timestamptz' }) fecha_hora_inicio: Date;
  @Column({ type: 'timestamptz' }) fecha_hora_fin: Date;
  @Column({ type: 'timestamptz', nullable: true }) fecha_llegada: Date | null;
  @Column({
    type: 'enum',
    enum: EstadoCita,
    enumName: 'estado_cita',
    default: EstadoCita.PROGRAMADA,
  })
  estado: EstadoCita;
  @Column({ type: 'varchar', length: 255, nullable: true }) observaciones:
    string | null;
  @ManyToOne('Paciente', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_paciente' })
  paciente: object;
  @ManyToOne('TratamientoPaciente', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_tratamiento' })
  tratamiento: object | null;
  @ManyToOne('Personal', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_personal' })
  personal: object;
}

@Entity('reprogramaciones_cita')
@Check('CHK_reprogramaciones_anterior', '"inicio_anterior" < "fin_anterior"')
@Check('CHK_reprogramaciones_nuevo', '"inicio_nuevo" < "fin_nuevo"')
export class ReprogramacionCita extends CreatedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_reprogramacion: number;
  @Column({ type: 'integer' }) id_cita: number;
  @Column({ type: 'timestamptz' }) inicio_anterior: Date;
  @Column({ type: 'timestamptz' }) fin_anterior: Date;
  @Column({ type: 'timestamptz' }) inicio_nuevo: Date;
  @Column({ type: 'timestamptz' }) fin_nuevo: Date;
  @Column({ type: 'integer' }) realizado_por: number;
  @Column({ type: 'varchar', length: 255, nullable: true }) motivo:
    string | null;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  registrado_en: Date;
  @Column({
    type: 'enum',
    enum: SolicitanteReprogramacion,
    enumName: 'solicitante_reprogramacion',
  })
  solicitado_por_tipo: SolicitanteReprogramacion;
  @ManyToOne('Cita', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_cita' })
  cita: object;
  @ManyToOne('Usuario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'realizado_por' })
  realizador: object;
}

@Entity('notificaciones_cita')
@Index('IDX_notificaciones_pendientes', ['estado', 'programada_para'])
export class NotificacionCita extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_notificacion: number;
  @Column({ type: 'integer' }) id_cita: number;
  @Column({
    type: 'enum',
    enum: TipoNotificacion,
    enumName: 'tipo_notificacion',
  })
  tipo: TipoNotificacion;
  @Column({
    type: 'enum',
    enum: CanalNotificacion,
    enumName: 'canal_notificacion',
  })
  canal: CanalNotificacion;
  @Column({ type: 'timestamptz' }) programada_para: Date;
  @Column({ type: 'timestamptz', nullable: true }) enviada_en: Date | null;
  @Column({
    type: 'enum',
    enum: EstadoNotificacion,
    enumName: 'estado_notificacion',
    default: EstadoNotificacion.PENDIENTE,
  })
  estado: EstadoNotificacion;
  @ManyToOne('Cita', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_cita' })
  cita: object;
}
