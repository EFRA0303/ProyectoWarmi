import { Persona } from '../modules/personas/entities/persona.entity.js';
import { Paciente } from '../modules/pacientes/entities/paciente.entity.js';
import { Usuario } from '../modules/usuarios/entities/usuario.entity.js';
import { Personal } from '../modules/personal/entities/personal.entity.js';
import { Rol } from '../modules/roles/entities/rol.entity.js';
import { Permiso } from '../modules/permisos/entities/permiso.entity.js';
import { RolPermiso } from '../modules/roles/entities/rol-permiso.entity.js';
import { UsuarioPermiso } from '../modules/permisos/entities/usuario-permiso.entity.js';
import { AccesoUsuario } from '../modules/accesos-usuario/entities/acceso-usuario.entity.js';
import { ConfiguracionAuditoria } from '../modules/configuracion-auditoria/entities/configuracion-auditoria.entity.js';
import { Auditoria } from '../modules/auditoria/entities/auditoria.entity.js';
import { Historial } from '../modules/historiales/entities/historial.entity.js';
import { HorarioPersonal } from '../modules/disponibilidad/entities/horario-personal.entity.js';
import { HorarioExtraPersonal } from '../modules/disponibilidad/entities/horario-extra-personal.entity.js';
import { BloqueoPersonal } from '../modules/disponibilidad/entities/bloqueo-personal.entity.js';
import { Area } from '../modules/catalogo/entities/area.entity.js';
import { CategoriaServicio } from '../modules/catalogo/entities/categoria-servicio.entity.js';
import { Servicio } from '../modules/catalogo/entities/servicio.entity.js';
import { TipoMedida } from '../modules/catalogo/entities/tipo-medida.entity.js';
import { ServicioMedida } from '../modules/catalogo/entities/servicio-medida.entity.js';
import {
  Adquisicion,
  DetalleAdquisicion,
  Paquete,
  PaqueteServicio,
  Promocion,
  PromocionServicio,
} from '../modules/comercial/entities/comercial.entities.js';
import {
  AmpliacionTratamiento,
  Sesion,
  SolicitudServicio,
  TratamientoPaciente,
  Valoracion,
  ValoracionMedida,
} from '../modules/clinica/entities/clinica.entities.js';
import {
  Cita,
  NotificacionCita,
  ReprogramacionCita,
} from '../modules/agenda/entities/agenda.entities.js';
import {
  DetalleNotaVenta,
  NotaVenta,
  Pago,
} from '../modules/ventas/entities/ventas.entities.js';
import {
  ConsumoSesion,
  LoteProducto,
  MovimientoInventario,
  Producto,
  SalidaProductoVenta,
  ServicioProducto,
} from '../modules/inventario/entities/inventario.entities.js';
import {
  ConfiguracionDocumento,
  Empresa,
} from '../modules/empresa/entities/empresa.entities.js';

export const entities = [
  Persona,
  Paciente,
  Usuario,
  Personal,
  Rol,
  Permiso,
  RolPermiso,
  UsuarioPermiso,
  AccesoUsuario,
  ConfiguracionAuditoria,
  Auditoria,
  Historial,
  HorarioPersonal,
  HorarioExtraPersonal,
  BloqueoPersonal,
  Area,
  CategoriaServicio,
  Servicio,
  TipoMedida,
  ServicioMedida,
  Paquete,
  PaqueteServicio,
  Promocion,
  PromocionServicio,
  Adquisicion,
  DetalleAdquisicion,
  SolicitudServicio,
  TratamientoPaciente,
  AmpliacionTratamiento,
  Sesion,
  Valoracion,
  ValoracionMedida,
  Cita,
  ReprogramacionCita,
  NotificacionCita,
  NotaVenta,
  DetalleNotaVenta,
  Pago,
  Producto,
  LoteProducto,
  ServicioProducto,
  MovimientoInventario,
  ConsumoSesion,
  SalidaProductoVenta,
  Empresa,
  ConfiguracionDocumento,
];
