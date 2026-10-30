import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Adquisicion, DetalleAdquisicion } from '../comercial/entities/comercial.entities.js';
import { DetalleNotaVenta, NotaVenta } from './entities/ventas.entities.js';
import { EstadoAdquisicion, EstadoNotaVenta } from '../../common/enums/domain.enums.js';
import { decimal, units } from '../../common/utils/decimal.js';

export async function noteIdentity(manager: EntityManager, requested?: string) {
  if (requested?.startsWith('NV-A-')) throw new BadRequestException('El prefijo NV-A- está reservado para la numeración automática');
  for (let attempt = 0; attempt < 20; attempt++) {
    const [row] = await manager.query(`SELECT nextval(pg_get_serial_sequence('notas_venta', 'id_nota_venta'))::integer AS id`) as Array<{ id: number }>;
    const number = requested || `NV-A-${String(row.id).padStart(8, '0')}`;
    if (!(await manager.getRepository(NotaVenta).existsBy({ numero_nota: number }))) return { id_nota_venta: row.id, numero_nota: number };
    if (requested) throw new BadRequestException('El número de nota ya está registrado');
  }
  throw new BadRequestException('No se pudo asignar un número de nota automático');
}

export async function issueAcquisitionNote(manager: EntityManager, acquisitionId: number, actor: number) {
  const acquisition = await manager.getRepository(Adquisicion).findOne({ where: { id_adquisicion: acquisitionId }, lock: { mode: 'pessimistic_write' } });
  if (!acquisition || acquisition.estado === EstadoAdquisicion.CANCELADA) throw new BadRequestException('La adquisición no admite una nota de venta');
  const existing = await manager.getRepository(NotaVenta).findOneBy({ id_adquisicion: acquisitionId });
  if (existing) return existing;
  const details = await manager.getRepository(DetalleAdquisicion).findBy({ id_adquisicion: acquisitionId });
  if (!details.length) throw new BadRequestException('La adquisición no tiene servicios');
  const noteRepo = manager.getRepository(NotaVenta);
  const identity = await noteIdentity(manager);
  // Un paquete conserva su precio propio; los demás conceptos usan los importes congelados al contratar.
  const lines = acquisition.id_paquete ? [{ id_paquete: acquisition.id_paquete, descripcion_snapshot: `Paquete adquirido #${acquisitionId}`, cantidad: '1.00', precio_unitario: acquisition.precio_original, descuento: '0.00', subtotal: acquisition.precio_original }]
    : details.map(detail => ({ id_servicio: detail.id_servicio, descripcion_snapshot: `${detail.nombre_servicio_snapshot} · ${detail.sesiones_incluidas} sesiones`, cantidad: '1.00', precio_unitario: detail.subtotal, descuento: '0.00', subtotal: detail.subtotal }));
  const subtotal = lines.reduce((sum, line) => sum + units(line.subtotal), 0n);
  const total = units(acquisition.total);
  if (total > subtotal) throw new BadRequestException('Los importes históricos de la adquisición requieren revisión antes de emitir la nota');
  const note = await noteRepo.save(noteRepo.create({ ...identity, id_adquisicion: acquisitionId, id_paciente: acquisition.id_paciente, emitido_por: actor, fecha_emision: new Date(), subtotal: decimal(subtotal), descuento: decimal(subtotal - total), total: decimal(total), estado: EstadoNotaVenta.EMITIDA, observaciones: 'Generada automáticamente desde la adquisición. No representa un pago.' }));
  const repo = manager.getRepository(DetalleNotaVenta);
  await repo.save(lines.map(line => repo.create({ ...line, id_nota_venta: note.id_nota_venta })));
  return note;
}
