import { Injectable, Inject } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator.js';
import { PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import type { JwtPayload } from '../../../common/interfaces/jwt-payload.interface.js';
import { RolPermiso } from '../../roles/entities/rol-permiso.entity.js';
import { UsuarioPermiso } from '../../permisos/entities/usuario-permiso.entity.js';
import { EstadoGeneral } from '../../../common/enums/estado-general.enum.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DataSource) private readonly db: DataSource,
  ) {}
  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets))
      return true;
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      targets,
    );
    if (!required?.length) return true;
    const user = context
      .switchToHttp()
      .getRequest<{ user?: JwtPayload }>().user;
    if (!user) return false;
    const roles = await this.db
      .getRepository(RolPermiso)
      .find({ where: { id_rol: user.id_rol }, relations: { permiso: true } });
    const individual = await this.db
      .getRepository(UsuarioPermiso)
      .find({ where: { id_usuario: user.sub }, relations: { permiso: true } });
    const allowed = new Set(
      roles
        .filter((r) => r.permiso.estado === EstadoGeneral.ACTIVO)
        .map((r) => r.permiso.permiso),
    );
    for (const rule of individual) {
      if (rule.permiso.estado !== EstadoGeneral.ACTIVO) continue;
      if (rule.permitido) allowed.add(rule.permiso.permiso);
      else allowed.delete(rule.permiso.permiso);
    }
    return required.every((p) => allowed.has(p));
  }
}
