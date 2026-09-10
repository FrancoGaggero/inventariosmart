import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import type { RequestWithUser } from '../decorators/current-user.decorator';

/** Claves que el rol EMPLEADO no puede ver (Propuesta §2.4): costos y márgenes. */
const SENSIBLE = /^(costo|margen)/i;

export function omitirSensibles<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map(omitirSensibles) as T;
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (!SENSIBLE.test(k)) salida[k] = omitirSensibles(v);
    }
    return salida as T;
  }
  return valor;
}

/**
 * Elimina campos sensibles de cualquier respuesta cuando el usuario es EMPLEADO (CP-11.4b).
 * Se aplica a toda la API para que los módulos futuros no tengan que recordarlo.
 */
@Injectable()
export class SensitiveFieldsInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = ctx.switchToHttp().getRequest<RequestWithUser>().user;
    if (user?.rol !== 'EMPLEADO') return next.handle();
    return next.handle().pipe(map((body) => omitirSensibles(body)));
  }
}
