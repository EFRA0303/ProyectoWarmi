import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { decimal, units } from '../../common/utils/decimal.js';
import { EstadoLote, TipoMovimientoInventario } from '../../common/enums/domain.enums.js';
import { LoteProducto, MovimientoInventario, SalidaProductoVenta } from './entities/inventario.entities.js';
import { DetalleNotaVenta } from '../ventas/entities/ventas.entities.js';

export const outgoingTypes = ['CONSUMO_SESION', 'VENTA', 'AJUSTE_SALIDA', 'MERMA', 'VENCIMIENTO'];
export const localInventoryDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export async function stockUnits(manager: EntityManager, lotId: number) {
  const [row] = await manager.query(`SELECT COALESCE(SUM(CASE WHEN tipo::text = ANY($2::text[]) THEN -cantidad ELSE cantidad END),0)::text AS stock FROM movimientos_inventario WHERE id_lote=$1`, [lotId, outgoingTypes]) as Array<{ stock: string }>;
  return units(row.stock, 'Stock del lote', false, 12);
}

export async function usableLot(manager: EntityManager, lotId: number) {
  const lot = await manager.getRepository(LoteProducto).findOne({ where: { id_lote: lotId }, lock: { mode: 'pessimistic_write' } });
  const today = localInventoryDate();
  if (!lot || ![EstadoLote.DISPONIBLE, EstadoLote.AGOTADO].includes(lot.estado) || lot.fecha_ingreso > today || lot.fecha_vencimiento && lot.fecha_vencimiento < today)
    throw new BadRequestException('El lote no está disponible, está vencido o todavía no ingresó');
  return lot;
}

export async function syncStockState(manager: EntityManager, lotId: number) {
  const lot = await manager.getRepository(LoteProducto).findOneByOrFail({ id_lote: lotId });
  if ([EstadoLote.BAJA, EstadoLote.VENCIDO].includes(lot.estado)) return;
  lot.estado = (await stockUnits(manager, lotId)) === 0n ? EstadoLote.AGOTADO : EstadoLote.DISPONIBLE;
  await manager.getRepository(LoteProducto).save(lot);
}

export async function deliverSaleProducts(manager: EntityManager, noteId: number, actor: number) {
  const details = await manager.getRepository(DetalleNotaVenta).find({ where: { id_nota_venta: noteId }, order: { id_producto: 'ASC', id_detalle: 'ASC' } });
  const outputRepo = manager.getRepository(SalidaProductoVenta);
  for (const detail of details.filter(item => item.id_producto !== null)) {
    const requested = units(detail.cantidad, 'Cantidad vendida', true) * units(detail.factor_stock, 'Contenido por presentación', true);
    if (requested % 100n) throw new BadRequestException('La conversión de stock requiere más de dos decimales');
    const required = requested / 100n;
    const existing = await outputRepo.findBy({ id_detalle: detail.id_detalle });
    let remaining = required - existing.reduce((sum, row) => sum + units(row.cantidad), 0n);
    if (remaining < 0n) throw new BadRequestException('El detalle registra una salida superior a la cantidad vendida; requiere revisión');
    if (!remaining) continue;
    const lots = await manager.query(`SELECT l.id_lote FROM lotes_producto l JOIN productos p ON p.id_producto=l.id_producto WHERE l.id_producto=$1 AND p.estado='ACTIVO' AND p.es_vendible AND l.estado IN ('DISPONIBLE','AGOTADO') AND l.fecha_ingreso <= $2 AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= $2) ORDER BY l.fecha_vencimiento ASC NULLS LAST, l.id_lote ASC FOR UPDATE OF l`, [detail.id_producto, localInventoryDate()]) as Array<{ id_lote: number }>;
    for (const lot of lots) {
      const available = await stockUnits(manager, lot.id_lote);
      const amount = available < remaining ? available : remaining;
      if (!amount) continue;
      const movementRepo = manager.getRepository(MovimientoInventario);
      const movement = await movementRepo.save(movementRepo.create({ id_lote: lot.id_lote, tipo: TipoMovimientoInventario.VENTA, cantidad: decimal(amount), registrado_por: actor, fecha_movimiento: new Date(), observaciones: `Entrega confirmada de nota #${noteId}, detalle #${detail.id_detalle}` }));
      await outputRepo.save(outputRepo.create({ id_detalle: detail.id_detalle, id_lote: lot.id_lote, id_movimiento: movement.id_movimiento, cantidad: decimal(amount) }));
      await syncStockState(manager, lot.id_lote);
      remaining -= amount;
      if (!remaining) break;
    }
    if (remaining) throw new BadRequestException(`Stock disponible insuficiente para entregar ${detail.descripcion_snapshot}. No se descontó ningún producto de esta entrega.`);
  }
  return outputRepo.createQueryBuilder('salida').innerJoin('salida.detalle', 'detalle').where('detalle.id_nota_venta = :noteId', { noteId }).getMany();
}
