import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  CreatedEntity,
  TimestampedEntity,
} from '../../../common/entities/timestamps.entity.js';
import {
  EstadoNotaVenta,
  EstadoPago,
  MetodoPago,
} from '../../../common/enums/domain.enums.js';

@Entity('notas_venta')
@Check(
  'CHK_notas_venta_importes',
  '"subtotal" >= 0 AND "descuento" >= 0 AND "total" >= 0 AND "total" = "subtotal" - "descuento"',
)
export class NotaVenta extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_nota_venta: number;
  @Column({ type: 'integer', nullable: true, unique: true }) id_adquisicion:
    number | null;
  @Column({ type: 'integer', nullable: true }) id_paciente: number | null;
  @Column({ type: 'integer' }) emitido_por: number;
  @Column({ type: 'varchar', length: 30, unique: true }) numero_nota: string;
  @Column({ type: 'timestamptz' }) fecha_emision: Date;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) subtotal: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  descuento: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) total: string;
  @Column({
    type: 'enum',
    enum: EstadoNotaVenta,
    enumName: 'estado_nota_venta',
    default: EstadoNotaVenta.EMITIDA,
  })
  estado: EstadoNotaVenta;
  @Column({ type: 'varchar', length: 255, nullable: true }) observaciones:
    string | null;
  @OneToOne('Adquisicion', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_adquisicion' })
  adquisicion: object | null;
  @ManyToOne('Paciente', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_paciente' })
  paciente: object | null;
  @ManyToOne('Usuario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'emitido_por' })
  emisor: object;
}

@Entity('detalles_nota_venta')
@Check(
  'CHK_detalles_nota_item',
  'num_nonnulls("id_servicio", "id_producto", "id_paquete") = 1',
)
@Check('CHK_detalles_nota_cantidad', '"cantidad" > 0')
@Check(
  'CHK_detalles_nota_importes',
  '"precio_unitario" >= 0 AND "descuento" >= 0 AND "subtotal" >= 0',
)
@Check(
  'CHK_detalle_nota_calculado',
  '"subtotal" = ROUND("precio_unitario" * "cantidad" - "descuento", 2)',
)
export class DetalleNotaVenta extends CreatedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_detalle: number;
  @Column({ type: 'integer' }) id_nota_venta: number;
  @Column({ type: 'integer', nullable: true }) id_servicio: number | null;
  @Column({ type: 'integer', nullable: true }) id_producto: number | null;
  @Column({ type: 'integer', nullable: true }) id_paquete: number | null;
  @Column({ type: 'varchar', length: 180 }) descripcion_snapshot: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) unidad_snapshot:
    string | null;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) cantidad: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) precio_unitario: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  descuento: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) subtotal: string;
  @ManyToOne('NotaVenta', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_nota_venta' })
  nota_venta: object;
  @ManyToOne('Servicio', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_servicio' })
  servicio: object | null;
  @ManyToOne('Producto', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_producto' })
  producto: object | null;
  @ManyToOne('Paquete', { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_paquete' })
  paquete: object | null;
}

@Entity('pagos')
@Check('CHK_pagos_monto', '"monto" > 0')
export class Pago extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_pago: number;
  @Column({ type: 'integer' }) id_nota_venta: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) monto: string;
  @Column({ type: 'enum', enum: MetodoPago, enumName: 'metodo_pago' })
  metodo_pago: MetodoPago;
  @Column({ type: 'timestamptz' }) fecha_pago: Date;
  @Column({ type: 'integer' }) registrado_por: number;
  @Column({
    type: 'enum',
    enum: EstadoPago,
    enumName: 'estado_pago',
    default: EstadoPago.REGISTRADO,
  })
  estado: EstadoPago;
  @Column({ type: 'varchar', length: 255, nullable: true }) observaciones:
    string | null;
  @ManyToOne('NotaVenta', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_nota_venta' })
  nota_venta: object;
  @ManyToOne('Usuario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'registrado_por' })
  registrador: object;
}
