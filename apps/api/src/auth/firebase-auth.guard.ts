import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import type { RequestWithUser } from '../common/decorators/current-user.decorator';
import { noAutenticado, sinPermiso } from '../common/errors';
import { TokenVerifier } from './firebase.service';
import { AuthProvisioningService } from './provisioning.service';
import { TenantContext } from './tenant-context';

/**
 * Guard global: toda ruta exige `Authorization: Bearer <ID token de Firebase>`
 * salvo las marcadas con @Public(). Verifica el token, resuelve usuario + comercio
 * (creándolos en el primer ingreso), bloquea usuarios inactivos y fija el tenant.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifier,
    private readonly provisioning: AuthProvisioningService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw noAutenticado();
    }

    let identidad;
    try {
      identidad = await this.verifier.verificar(token);
    } catch (err) {
      this.logger.debug({ err }, 'Token rechazado');
      throw noAutenticado('La sesión no es válida o venció. Volvé a iniciar sesión.');
    }

    const user = await this.provisioning.resolver(identidad);
    if (!user.activo) {
      throw sinPermiso('Tu acceso a este comercio fue dado de baja. Hablá con el dueño.');
    }

    req.user = user;
    TenantContext.entrar({
      comercioId: user.comercio.id,
      usuarioId: user.usuarioId,
      rol: user.rol,
      plan: user.comercio.plan,
    });
    return true;
  }
}
