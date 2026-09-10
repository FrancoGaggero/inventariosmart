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
  CONFLICTO: 'CONFLICTO',
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

// ---------------------------------------------------------------------------
// Comercio (tenant) y usuarios — HU-11
// ---------------------------------------------------------------------------

/** CUIT argentino: 11 dígitos sin guiones. */
export const CuitSchema = z
  .string()
  .regex(/^\d{11}$/, 'El CUIT debe tener 11 dígitos, sin guiones.');

export const ComercioSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  cuit: z.string().nullable(),
  plan: PlanSchema,
  /** Alícuota de IVA por defecto en porcentaje (RN-03), como string decimal. */
  ivaDefault: z.string(),
  moneda: z.string(),
  onboardingPendiente: z.boolean(),
});
export type Comercio = z.infer<typeof ComercioSchema>;

/** Estado derivado de un usuario del comercio. */
export const ESTADOS_USUARIO = ['INVITADO', 'ACTIVO', 'INACTIVO'] as const;
export const EstadoUsuarioSchema = z.enum(ESTADOS_USUARIO);
export type EstadoUsuario = z.infer<typeof EstadoUsuarioSchema>;

export const UsuarioSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  nombre: z.string().nullable(),
  rol: RolSchema,
  activo: z.boolean(),
  estado: EstadoUsuarioSchema,
  creadoEn: z.string(),
});
export type Usuario = z.infer<typeof UsuarioSchema>;

/** Respuesta de GET /api/v1/me. */
export const MeSchema = z.object({
  usuario: UsuarioSchema,
  comercio: ComercioSchema,
  rol: RolSchema,
  plan: PlanSchema,
  onboardingPendiente: z.boolean(),
});
export type Me = z.infer<typeof MeSchema>;

const NombreComercioSchema = z
  .string()
  .trim()
  .min(2, 'El nombre del comercio debe tener al menos 2 caracteres.')
  .max(120, 'El nombre del comercio no puede superar los 120 caracteres.');

/** Cuerpo de POST /api/v1/me/onboarding. */
export const OnboardingSchema = z.object({
  nombreComercio: NombreComercioSchema,
});
export type Onboarding = z.infer<typeof OnboardingSchema>;

/** Cuerpo de PATCH /api/v1/comercio. */
export const ComercioPatchSchema = z
  .object({
    nombre: NombreComercioSchema.optional(),
    cuit: CuitSchema.nullable().optional(),
    ivaDefault: z
      .number('La alícuota de IVA debe ser un número.')
      .min(0, 'La alícuota de IVA no puede ser negativa.')
      .max(100, 'La alícuota de IVA no puede superar 100.')
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No hay nada para actualizar.' });
export type ComercioPatch = z.infer<typeof ComercioPatchSchema>;

/** Cuerpo de POST /api/v1/users (invitación). */
export const InvitacionSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('El email no tiene un formato válido.')),
  rol: RolSchema,
});
export type Invitacion = z.infer<typeof InvitacionSchema>;

/** Cuerpo de PATCH /api/v1/users/:id. */
export const UsuarioPatchSchema = z
  .object({
    rol: RolSchema.optional(),
    activo: z.boolean().optional(),
  })
  .refine((v) => v.rol !== undefined || v.activo !== undefined, {
    message: 'Indicá el rol o el estado a cambiar.',
  });
export type UsuarioPatch = z.infer<typeof UsuarioPatchSchema>;

export * from './productos';
