import { SetMetadata } from '@nestjs/common';
import type { Plan, Rol } from '@inventariosmart/shared';

export const ROLES_KEY = 'roles';
export const PLAN_KEY = 'planMinimo';

/** Restringe la ruta a los roles indicados (sin decorador: cualquier usuario autenticado). */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

/** Exige que el comercio tenga al menos ese plan (RF-15). */
export const RequierePlan = (plan: Plan) => SetMetadata(PLAN_KEY, plan);
