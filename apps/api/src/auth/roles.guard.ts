import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '@inventariosmart/shared';
import type { RequestWithUser } from '../common/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { sinPermiso } from '../common/errors';

/** Aplica `@Roles(...)`: el rol del usuario se resuelve en cada request (CP-11.4d). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, targets);
    if (!roles || roles.length === 0) return true;

    const user = ctx.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user || !roles.includes(user.rol)) {
      throw sinPermiso();
    }
    return true;
  }
}
