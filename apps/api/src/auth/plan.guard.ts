import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Plan, planCumple } from '@inventariosmart/shared';
import type { RequestWithUser } from '../common/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { PLAN_KEY } from '../common/decorators/roles.decorator';
import { planRequerido } from '../common/errors';

/** Aplica `@RequierePlan(...)` según el plan del comercio (RF-15, RN-09). */
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const planMinimo = this.reflector.getAllAndOverride<Plan | undefined>(PLAN_KEY, targets);
    if (!planMinimo) return true;

    const user = ctx.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user || !planCumple(user.comercio.plan, planMinimo)) {
      throw planRequerido(planMinimo);
    }
    return true;
  }
}
