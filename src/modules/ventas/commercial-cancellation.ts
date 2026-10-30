import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Adquisicion } from '../comercial/entities/comercial.entities.js';
import { NotaVenta, Pago } from './entities/ventas.entities.js';
import { EstadoAdquisicion, EstadoNotaVenta, EstadoPago } from '../../common/enums/domain.enums.js';

export async function cancelAcquisition(manager: EntityManager, id: number, actor: number, reason?: string) {
  const repo = manager.getRepository(Adquisicion);
  const acquisition = await repo.findOne({ where: { id_adquisicion: id }, lock: { mode: 'pessimistic_write' } });
  if (!acquisition) throw new BadRequestException('Adquisición no encontrada');
  if (acquisition.estado === EstadoAdquisicion.CANCELADA) return acquisition;
  if (!reason || reason.trim().length < 5) throw new BadRequestException('Indica un motivo de anulación de al menos cinco caracteres');
  const note = await manager.getRepository(NotaVenta).findOne({ where: { id_adquisicion: id }, lock: { mode: 'pessimistic_write' } });
  if (note && await manager.getRepository(Pago).existsBy({ id_nota_venta: note.id_nota_venta, estado: EstadoPago.REGISTRADO }))
    throw new BadRequestException('Hay pagos registrados. Debe resolverse la devolución financiera; anular no devuelve dinero automáticamente.');
  const active = await manager.query(`SELECT 1 FROM tratamientos_paciente t JOIN detalles_adquisicion d ON d.id_detalle_adquisicion=t.id_detalle_adquisicion WHERE d.id_adquisicion=$1 AND (t.estado <> 'CANCELADO' OR EXISTS (SELECT 1 FROM sesiones s WHERE s.id_tratamiento=t.id_tratamiento AND s.estado IN ('EN_CURSO','FINALIZADA'))) LIMIT 1`, [id]) as unknown[];
  if (active.length) throw new BadRequestException('La adquisición tiene servicios asignados o sesiones utilizadas. Resuelve su cierre clínico antes de cancelar.');
  if (note) {
    const outputs = await manager.query(`SELECT 1 FROM salidas_producto_venta sp JOIN detalles_nota_venta d ON d.id_detalle=sp.id_detalle WHERE d.id_nota_venta=$1 LIMIT 1`, [note.id_nota_venta]) as unknown[];
    if (outputs.length) throw new BadRequestException('La nota tiene productos entregados; requiere una devolución controlada');
    note.estado = EstadoNotaVenta.ANULADA;
    note.anulado_por = actor;
    note.motivo_anulacion = reason.trim();
    await manager.getRepository(NotaVenta).save(note);
  }
  acquisition.estado = EstadoAdquisicion.CANCELADA;
  acquisition.anulado_por = actor;
  acquisition.motivo_anulacion = reason.trim();
  return repo.save(acquisition);
}

export async function completeAcquisition(manager: EntityManager, id: number) {
  await manager.query(`UPDATE adquisiciones a SET estado='COMPLETADA'
    WHERE a.id_adquisicion=$1 AND a.estado='ACTIVA'
      AND EXISTS (SELECT 1 FROM notas_venta n WHERE n.id_adquisicion=a.id_adquisicion AND n.estado='EMITIDA' AND n.total <= COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.id_nota_venta=n.id_nota_venta AND p.estado='REGISTRADO'),0))
      AND EXISTS (SELECT 1 FROM detalles_adquisicion d WHERE d.id_adquisicion=a.id_adquisicion)
      AND NOT EXISTS (SELECT 1 FROM detalles_adquisicion d WHERE d.id_adquisicion=a.id_adquisicion AND d.sesiones_incluidas > (SELECT COUNT(*) FROM tratamientos_paciente t JOIN sesiones s ON s.id_tratamiento=t.id_tratamiento WHERE t.id_detalle_adquisicion=d.id_detalle_adquisicion AND s.estado='FINALIZADA'))`, [id]);
}

export async function requireAcquisitionPayment(manager: EntityManager, detailId: number) {
  const acquisition = await manager.query(`SELECT a.id_adquisicion FROM adquisiciones a JOIN detalles_adquisicion d ON d.id_adquisicion=a.id_adquisicion WHERE d.id_detalle_adquisicion=$1 AND a.estado <> 'CANCELADA' FOR UPDATE OF a`, [detailId]) as Array<{ id_adquisicion: number }>;
  if (!acquisition.length) throw new BadRequestException('La adquisición no está activa');
  const enabled = await manager.query(`SELECT 1 FROM notas_venta n WHERE n.id_adquisicion=$1 AND n.estado='EMITIDA' AND (n.total=0 OR EXISTS (SELECT 1 FROM pagos p WHERE p.id_nota_venta=n.id_nota_venta AND p.estado='REGISTRADO' AND p.monto>0))`, [acquisition[0].id_adquisicion]) as unknown[];
  if (!enabled.length) throw new BadRequestException('Registra la nota de venta y el primer abono antes de habilitar la atención. Las cuotas restantes pueden pagarse después.');
}
