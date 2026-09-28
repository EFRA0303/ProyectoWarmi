export enum EstadoHistorial {
  ACTIVO = 'ACTIVO',
  CERRADO = 'CERRADO',
}
export enum DiaSemana {
  LUNES = 'LUNES',
  MARTES = 'MARTES',
  MIERCOLES = 'MIERCOLES',
  JUEVES = 'JUEVES',
  VIERNES = 'VIERNES',
  SABADO = 'SABADO',
  DOMINGO = 'DOMINGO',
}
export enum EstadoHorarioExtra {
  AUTORIZADO = 'AUTORIZADO',
  CANCELADO = 'CANCELADO',
}
export enum TipoDescuento {
  PORCENTAJE = 'PORCENTAJE',
  MONTO_FIJO = 'MONTO_FIJO',
}
export enum EstadoPromocion {
  PROGRAMADA = 'PROGRAMADA',
  ACTIVA = 'ACTIVA',
  FINALIZADA = 'FINALIZADA',
  CANCELADA = 'CANCELADA',
}
export enum EstadoAdquisicion {
  ACTIVA = 'ACTIVA',
  COMPLETADA = 'COMPLETADA',
  CANCELADA = 'CANCELADA',
}
export enum EstadoSolicitud {
  PENDIENTE = 'PENDIENTE',
  VALORADO = 'VALORADO',
  ACEPTADO = 'ACEPTADO',
  DESCARTADO = 'DESCARTADO',
}
export enum EstadoTratamiento {
  PENDIENTE = 'PENDIENTE',
  EN_CURSO = 'EN_CURSO',
  FINALIZADO = 'FINALIZADO',
  CANCELADO = 'CANCELADO',
}
export enum TipoValoracion {
  INICIAL = 'INICIAL',
  EVOLUCION = 'EVOLUCION',
  FINAL = 'FINAL',
}
export enum EstadoCita {
  PROGRAMADA = 'PROGRAMADA',
  EN_ESPERA = 'EN_ESPERA',
  ATENDIDA = 'ATENDIDA',
  CANCELADA = 'CANCELADA',
  NO_ASISTIO = 'NO_ASISTIO',
}
export enum SolicitanteReprogramacion {
  PACIENTE = 'PACIENTE',
  PERSONAL = 'PERSONAL',
  SISTEMA = 'SISTEMA',
}
export enum TipoNotificacion {
  CONFIRMACION = 'CONFIRMACION',
  RECORDATORIO = 'RECORDATORIO',
  REPROGRAMACION = 'REPROGRAMACION',
  CANCELACION = 'CANCELACION',
}
export enum CanalNotificacion {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  SISTEMA = 'SISTEMA',
}
export enum EstadoNotificacion {
  PENDIENTE = 'PENDIENTE',
  ENVIADA = 'ENVIADA',
  ERROR = 'ERROR',
  CANCELADA = 'CANCELADA',
}
export enum EstadoNotaVenta {
  EMITIDA = 'EMITIDA',
  ANULADA = 'ANULADA',
}
export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  QR = 'QR',
  TRANSFERENCIA = 'TRANSFERENCIA',
  TARJETA = 'TARJETA',
  OTRO = 'OTRO',
}
export enum EstadoPago {
  REGISTRADO = 'REGISTRADO',
  ANULADO = 'ANULADO',
}
export enum EstadoLote {
  DISPONIBLE = 'DISPONIBLE',
  AGOTADO = 'AGOTADO',
  VENCIDO = 'VENCIDO',
  BAJA = 'BAJA',
}
export enum TipoMovimientoInventario {
  ENTRADA_COMPRA = 'ENTRADA_COMPRA',
  CONSUMO_SESION = 'CONSUMO_SESION',
  VENTA = 'VENTA',
  AJUSTE_ENTRADA = 'AJUSTE_ENTRADA',
  AJUSTE_SALIDA = 'AJUSTE_SALIDA',
  MERMA = 'MERMA',
  VENCIMIENTO = 'VENCIMIENTO',
}
