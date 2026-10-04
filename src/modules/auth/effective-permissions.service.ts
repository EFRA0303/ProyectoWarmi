import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EstadoGeneral } from '../../common/enums/estado-general.enum.js';
import { UsuarioPermiso } from '../permisos/entities/usuario-permiso.entity.js';
import { RolPermiso } from '../roles/entities/rol-permiso.entity.js';

@Injectable()
export class EffectivePermissionsService {
  constructor(@Inject(DataSource) private readonly db: DataSource) {}

  async forUser(userId: number, roleId: number): Promise<Set<string>> {
    const [roles, individual] = await Promise.all([
      this.db.getRepository(RolPermiso).find({
        where: { id_rol: roleId },
        relations: { permiso: true },
      }),
      this.db.getRepository(UsuarioPermiso).find({
        where: { id_usuario: userId },
        relations: { permiso: true },
      }),
    ]);

    const allowed = new Set(
      roles
        .filter((rule) => rule.permiso.estado === EstadoGeneral.ACTIVO)
        .map((rule) => rule.permiso.permiso),
    );

    for (const rule of individual) {
      if (rule.permiso.estado !== EstadoGeneral.ACTIVO) continue;
      if (rule.permitido) allowed.add(rule.permiso.permiso);
      else allowed.delete(rule.permiso.permiso);
    }

    return allowed;
  }
}
