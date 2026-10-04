import { Injectable, Inject } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator.js';
import { PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import type { JwtPayload } from '../../../common/interfaces/jwt-payload.interface.js';
import { EffectivePermissionsService } from '../effective-permissions.service.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(EffectivePermissionsService)
    private readonly permissions: EffectivePermissionsService,
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
    const allowed = await this.permissions.forUser(user.sub, user.id_rol);
    return required.every((p) => allowed.has(p));
  }
}
