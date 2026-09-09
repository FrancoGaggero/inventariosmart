import { z } from 'zod';

/**
 * Roles de usuario dentro de un comercio (Propuesta v2.0 §2.4).
 * - DUENIO: acceso total; único que confirma órdenes de compra (RN-06).
 * - EMPLEADO: catálogo y movimientos; sin costos, márgenes ni dashboard.
 * - CONTADOR: sólo lectura de dashboard y reportes.
 */
export const ROLES = ['DUENIO', 'EMPLEADO', 'CONTADOR'] as const;
export const RolSchema = z.enum(ROLES);
export type Rol = z.infer<typeof RolSchema>;

/** Planes de suscripción por comercio (Propuesta v2.0 §4, RF-15). */
export const PLANES = ['FREE', 'PRO', 'PREMIUM'] as const;
export const PlanSchema = z.enum(PLANES);
export type Plan = z.infer<typeof PlanSchema>;

/** Límites del plan; `null` significa ilimitado. */
export const LIMITES_PLAN: Record<Plan, { productos: number | null; usuarios: number | null }> = {
  FREE: { productos: 50, usuarios: 1 },
  PRO: { productos: null, usuarios: null },
  PREMIUM: { productos: null, usuarios: null },
};

/** Orden de los planes, para comparar "plan mínimo requerido". */
const ORDEN_PLAN: Record<Plan, number> = { FREE: 0, PRO: 1, PREMIUM: 2 };

export function planCumple(planActual: Plan, planMinimo: Plan): boolean {
  return ORDEN_PLAN[planActual] >= ORDEN_PLAN[planMinimo];
}

/** Formato único de error de la API (convención del contrato). */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Códigos de error que devuelve la API. */
export const CODIGOS_ERROR = {
  NO_AUTENTICADO: 'NO_AUTENTICADO',
  SIN_PERMISO: 'SIN_PERMISO',
  PLAN_REQUERIDO: 'PLAN_REQUERIDO',
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  VALIDACION: 'VALIDACION',
  ERROR_INTERNO: 'ERROR_INTERNO',
} as const;
export type CodigoError = (typeof CODIGOS_ERROR)[keyof typeof CODIGOS_ERROR];

/** Respuesta de GET /api/v1/health. */
export const HealthSchema = z.object({
  status: z.literal('ok'),
  db: z.enum(['ok', 'error']),
  version: z.string(),
  timestamp: z.string(),
});
export type Health = z.infer<typeof HealthSchema>;

/** Respuesta de GET /api/v1/me (sprint 0: identidad del token, sin persistencia). */
export const MeSchema = z.object({
  uid: z.string(),
  email: z.string().nullable(),
});
export type Me = z.infer<typeof MeSchema>;
