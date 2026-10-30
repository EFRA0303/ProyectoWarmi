import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key, item]) => key !== 'clave_operacion' && item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

export async function operationKey(manager: EntityManager, table: 'notas_venta' | 'pagos' | 'adquisiciones' | 'lotes_producto' | 'movimientos_inventario', key: string | undefined, actor: number, payload: unknown) {
  if (!key) return { hash: null, existingId: null as number | null };
  const hash = createHash('sha256').update(JSON.stringify({ actor, payload: canonical(payload) })).digest('hex');
  await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`${table}:${key.toLowerCase()}`]);
  const id = { notas_venta: 'id_nota_venta', pagos: 'id_pago', adquisiciones: 'id_adquisicion', lotes_producto: 'id_lote', movimientos_inventario: 'id_movimiento' }[table];
  const rows = await manager.query(`SELECT ${id} AS id, huella_operacion FROM ${table} WHERE clave_operacion = $1`, [key]) as Array<{ id: number; huella_operacion: string }>;
  if (rows[0] && rows[0].huella_operacion !== hash) throw new ConflictException('Esta operación ya fue utilizada con otros datos. Recarga el formulario antes de registrar una operación diferente.');
  return { hash, existingId: rows[0]?.id ?? null };
}
