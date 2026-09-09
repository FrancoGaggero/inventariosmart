import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Identidad verificada por Firebase que el guard adjunta al request. */
export interface AuthUser {
  uid: string;
  email: string | null;
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
