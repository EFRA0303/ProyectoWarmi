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
];
