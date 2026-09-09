import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import type { RequestWithUser } from '../common/decorators/current-user.decorator';
import { noAutenticado } from '../common/errors';
import { TokenVerifier } from './firebase.service';

/**
 * Guard global: toda ruta exige `Authorization: Bearer <ID token de Firebase>`
 * salvo las marcadas con @Public(). Deja la identidad en req.user.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifier,
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

    try {
      req.user = await this.verifier.verificar(token);
      return true;
    } catch (err) {
      this.logger.debug({ err }, 'Token rechazado');
      throw noAutenticado('La sesión no es válida o venció. Volvé a iniciar sesión.');
    }
  }
}
