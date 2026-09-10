import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Plan, Rol } from '@inventariosmart/shared';

/** Datos del comercio que viajan con el usuario autenticado. */
export interface ComercioAuth {
  id: string;
  nombre: string;
  cuit: string | null;
  plan: Plan;
  ivaDefault: string;
  moneda: string;
  onboardingPendiente: boolean;
}

/** Usuario autenticado y resuelto contra la base (identidad + comercio + rol + plan). */
export interface AuthUser {
  uid: string;
  email: string;
  usuarioId: string;
  nombre: string | null;
  rol: Rol;
  activo: boolean;
  creadoEn: Date;
  comercio: ComercioAuth;
}

export type RequestWithUser = Request & { user?: AuthUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!req.user) {
      throw new Error('CurrentUser usado en una ruta sin guard de autenticación');
    }
    return req.user;
  },
);
