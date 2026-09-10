import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import type { Plan, Rol } from '@inventariosmart/shared';

/** Datos del tenant resueltos una vez por request por el guard de autenticación. */
export interface TenantInfo {
  comercioId: string;
  usuarioId: string;
  rol: Rol;
  plan: Plan;
}

/**
 * El middleware abre un almacén vacío por request (antes de los guards) y el guard
 * lo completa con `entrar`. Así el contexto llega intacto a controladores y servicios:
 * `enterWith` desde un guard no alcanza al handler porque Nest los ejecuta en
 * continuaciones asíncronas distintas.
 */
const almacen = new AsyncLocalStorage<Partial<TenantInfo>>();

export const TenantContext = {
  /** Middleware Express: abre el contexto para todo el ciclo del request. */
  middleware(_req: Request, _res: Response, next: NextFunction): void {
    almacen.run({}, () => next());
  },

  /** Completa el contexto del request actual (lo llama el guard de autenticación). */
  entrar(info: TenantInfo): void {
    const actual = almacen.getStore();
    if (actual) {
      Object.assign(actual, info);
    } else {
      almacen.enterWith({ ...info });
    }
  },

  /** Ejecuta `fn` con un tenant dado (tests, jobs). */
  correr<T>(info: TenantInfo, fn: () => T): T {
    return almacen.run({ ...info }, fn);
  },

  actual(): TenantInfo | undefined {
    const s = almacen.getStore();
    return s?.comercioId ? (s as TenantInfo) : undefined;
  },

  requerido(): TenantInfo {
    const info = TenantContext.actual();
    if (!info) {
      throw new Error(
        'Sin contexto de tenant: esta consulta debe ejecutarse dentro de un request autenticado.',
      );
    }
    return info;
  },
};
