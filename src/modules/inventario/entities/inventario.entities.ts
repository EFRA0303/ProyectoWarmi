import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
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
  EstadoLote,
  TipoMovimientoInventario,
} from '../../../common/enums/domain.enums.js';

@Entity('productos')
@Check('CHK_productos_stock_minimo', '"stock_minimo" >= 0')
export class Producto extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_producto: number;
  @Column({ type: 'varchar', length: 120 }) nombre: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) descripcion:
    string | null;
  @Column({ type: 'varchar', length: 30 }) unidad_medida: string;
  @Column({ type: 'varchar', length: 500, nullable: true }) imagen_url:
    string | null;
  @Column({ type: 'boolean', default: true }) es_insumo: boolean;
  @Column({ type: 'boolean', default: false }) es_vendible: boolean;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  stock_minimo: string;
  @Column({
    type: 'enum',
    enum: EstadoGeneral,
    enumName: 'estado_general',
    default: EstadoGeneral.ACTIVO,
  })
  estado: EstadoGeneral;
}

@Entity('lotes_producto')
@Index('UQ_lotes_producto_numero', ['id_producto', 'numero_lote'], {
  unique: true,
  where: '"numero_lote" IS NOT NULL',
})
@Check('CHK_lotes_cantidad', '"cantidad_inicial" >= 0')
@Check('CHK_lotes_costo', '"costo_unitario" IS NULL OR "costo_unitario" >= 0')
@Check(
  'CHK_lotes_vencimiento',
  '"fecha_vencimiento" IS NULL OR "fecha_ingreso" <= "fecha_vencimiento"',
)
export class LoteProducto extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_lote: number;
  @Column({ type: 'integer' }) id_producto: number;
  @Column({ type: 'varchar', length: 80, nullable: true }) numero_lote:
    string | null;
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  cantidad_inicial: string;
  @Column({ type: 'date' }) fecha_ingreso: string;
  @Column({ type: 'date', nullable: true }) fecha_vencimiento: string | null;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  costo_unitario: string | null;
  @Column({
    type: 'enum',
    enum: EstadoLote,
    enumName: 'estado_lote',
    default: EstadoLote.DISPONIBLE,
  })
  estado: EstadoLote;
  @ManyToOne('Producto', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_producto' })
  producto: object;
}

@Entity('servicios_productos')
@Check(
  'CHK_servicios_productos_cantidad',
  '"cantidad_referencial" IS NULL OR "cantidad_referencial" > 0',
)
export class ServicioProducto extends TimestampedEntity {
  @PrimaryColumn({ type: 'integer' }) id_servicio: number;
  @PrimaryColumn({ type: 'integer' }) id_producto: number;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  cantidad_referencial: string | null;
  @ManyToOne('Servicio', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_servicio' })
  servicio: object;
  @ManyToOne('Producto', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_producto' })
  producto: object;
}

@Entity('movimientos_inventario')
@Index('IDX_movimientos_lote_fecha', ['id_lote', 'fecha_movimiento'])
@Check('CHK_movimientos_cantidad', '"cantidad" > 0')
export class MovimientoInventario extends CreatedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_movimiento: number;
  @Column({ type: 'integer' }) id_lote: number;
  @Column({
    type: 'enum',
    enum: TipoMovimientoInventario,
    enumName: 'tipo_movimiento_inventario',
  })
  tipo: TipoMovimientoInventario;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) cantidad: string;
  @Column({ type: 'integer' }) registrado_por: number;
  @Column({ type: 'timestamptz' }) fecha_movimiento: Date;
  @Column({ type: 'varchar', length: 255, nullable: true }) observaciones:
    string | null;
  @ManyToOne('LoteProducto', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_lote' })
  lote: object;
  @ManyToOne('Usuario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'registrado_por' })
  registrador: object;
}

@Entity('consumos_sesion')
@Unique('UQ_consumo_sesion_lote', ['id_sesion', 'id_lote'])
@Check('CHK_consumos_sesion_cantidad', '"cantidad" > 0')
export class ConsumoSesion extends CreatedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_consumo: number;
  @Column({ type: 'integer' }) id_sesion: number;
  @Column({ type: 'integer' }) id_lote: number;
  @Column({ type: 'integer', unique: true }) id_movimiento: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) cantidad: string;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  registrado_en: Date;
  @ManyToOne('Sesion', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_sesion' })
  sesion: object;
  @ManyToOne('LoteProducto', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_lote' })
  lote: object;
  @OneToOne('MovimientoInventario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_movimiento' })
  movimiento: object;
}

@Entity('salidas_producto_venta')
@Unique('UQ_salida_detalle_lote', ['id_detalle', 'id_lote'])
@Check('CHK_salidas_producto_cantidad', '"cantidad" > 0')
export class SalidaProductoVenta extends CreatedEntity {
  @PrimaryGeneratedColumn({ type: 'integer' }) id_salida: number;
  @Column({ type: 'integer' }) id_detalle: number;
  @Column({ type: 'integer' }) id_lote: number;
  @Column({ type: 'integer', unique: true }) id_movimiento: number;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) cantidad: string;
  @ManyToOne('DetalleNotaVenta', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_detalle' })
  detalle: object;
  @ManyToOne('LoteProducto', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_lote' })
  lote: object;
  @OneToOne('MovimientoInventario', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_movimiento' })
  movimiento: object;
}
