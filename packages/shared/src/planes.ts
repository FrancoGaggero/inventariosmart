import { z } from 'zod';

// Planes de suscripción por comercio (HU-14, RF-15). En su propio módulo: el índice lo
// reexporta y los demás módulos lo pueden importar sin crear un ciclo.

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

export const NOMBRE_PLAN: Record<Plan, string> = { FREE: 'Free', PRO: 'Pro', PREMIUM: 'Premium' };

// --- Catálogo de funcionalidades ---------------------------------------------------------

export interface Funcionalidad {
  clave: string;
  nombre: string;
  descripcion: string;
  /** Plan más bajo que la incluye. */
  planMinimo: Plan;
}

/**
 * Única lista de funcionalidades por plan (design D1): la usan la API, la página "Plan" y la
 * portada. El plan mínimo tiene que coincidir con el `@RequierePlan` de la API; lo verifica
 * un test e2e (CP-14.3).
 */
export const FUNCIONALIDADES = [
  {
    clave: 'inventario',
    nombre: 'Inventario y movimientos',
    descripcion: 'Productos, stock, ventas, ingresos y ajustes.',
    planMinimo: 'FREE',
  },
  {
    clave: 'panel',
    nombre: 'Panel y rentabilidad',
    descripcion: 'Margen bruto y neto por producto, con tus gastos prorrateados.',
    planMinimo: 'FREE',
  },
  {
    clave: 'gastos',
    nombre: 'Gastos operativos',
    descripcion: 'Gastos fijos y variables del mes.',
    planMinimo: 'FREE',
  },
  {
    clave: 'proveedores',
    nombre: 'Proveedores y listas de precios',
    descripcion: 'Costos por proveedor, cargados a mano o importados.',
    planMinimo: 'FREE',
  },
  {
    clave: 'importacion',
    nombre: 'Importación desde Excel',
    descripcion: 'Cargá tus productos desde la planilla que ya usás.',
    planMinimo: 'FREE',
  },
  {
    clave: 'alertas',
    nombre: 'Alertas de reposición',
    descripcion: 'Aviso antes de que un producto se agote, según tu velocidad de venta.',
    planMinimo: 'PRO',
  },
  {
    clave: 'ordenes',
    nombre: 'Órdenes de compra',
    descripcion: 'Pedidos redactados para enviar por correo o WhatsApp.',
    planMinimo: 'PRO',
  },
  {
    clave: 'reportes',
    nombre: 'Reportes semanales',
    descripcion: 'Resumen de rentabilidad de la semana, por correo.',
    planMinimo: 'PRO',
  },
  {
    clave: 'inflacion',
    nombre: 'Precios frente a la inflación',
    descripcion: 'Tus precios y costos comparados con el índice del INDEC.',
    planMinimo: 'PRO',
  },
  {
    clave: 'remarcacion',
    nombre: 'Remarcación asistida',
    descripcion: 'Actualizá muchos precios en un paso, con vista previa y deshacer.',
    planMinimo: 'PRO',
  },
  {
    clave: 'comparador',
    nombre: 'Comparador de proveedores',
    descripcion: 'A quién conviene comprarle cada insumo, por precio, plazo y confiabilidad.',
    planMinimo: 'PREMIUM',
  },
  {
    clave: 'asistente',
    nombre: 'Asistente con IA',
    descripcion: 'Preguntale por tu negocio en lenguaje natural.',
    planMinimo: 'PREMIUM',
  },
] as const satisfies readonly Funcionalidad[];

export type ClaveFuncionalidad = (typeof FUNCIONALIDADES)[number]['clave'];

export const FuncionalidadPlanSchema = z.object({
  clave: z.string(),
  nombre: z.string(),
  descripcion: z.string(),
  planMinimo: PlanSchema,
  /** true si el plan vigente la incluye. */
  incluida: z.boolean(),
});
export type FuncionalidadPlan = z.infer<typeof FuncionalidadPlanSchema>;

/** El catálogo visto desde un plan. */
export function funcionalidadesDe(plan: Plan): FuncionalidadPlan[] {
  return FUNCIONALIDADES.map((f) => ({ ...f, incluida: planCumple(plan, f.planMinimo) }));
}

/** Lo que un plan suma sobre el anterior: sirve para mostrar los planes en columnas. */
export function funcionalidadesPropias(plan: Plan): Funcionalidad[] {
  return FUNCIONALIDADES.filter((f) => f.planMinimo === plan);
}

/** Qué se habilita y qué deja de estar disponible al pasar de un plan a otro. */
export function diferenciaDePlanes(
  actual: Plan,
  nuevo: Plan,
): { seHabilitan: Funcionalidad[]; dejanDeEstar: Funcionalidad[] } {
  return {
    seHabilitan: FUNCIONALIDADES.filter(
      (f) => !planCumple(actual, f.planMinimo) && planCumple(nuevo, f.planMinimo),
    ),
    dejanDeEstar: FUNCIONALIDADES.filter(
      (f) => planCumple(actual, f.planMinimo) && !planCumple(nuevo, f.planMinimo),
    ),
  };
}

// --- Uso y regla de cambio ------------------------------------------------------------------

export const UsoPlanSchema = z.object({
  /** Productos activos. */
  productos: z.number().int(),
  /** Usuarios activos, incluidos los invitados que todavía no ingresaron. */
  usuarios: z.number().int(),
});
export type UsoPlan = z.infer<typeof UsoPlanSchema>;

export const RECURSOS_PLAN = ['productos', 'usuarios'] as const;
export const RecursoPlanSchema = z.enum(RECURSOS_PLAN);
export type RecursoPlan = z.infer<typeof RecursoPlanSchema>;

export const ExcesoPlanSchema = z.object({
  recurso: RecursoPlanSchema,
  cantidad: z.number().int(),
  limite: z.number().int(),
});
export type ExcesoPlan = z.infer<typeof ExcesoPlanSchema>;

export const MOTIVOS_CAMBIO_RECHAZADO = ['MISMO_PLAN', 'SUPERA_LIMITES'] as const;
export type MotivoCambioRechazado = (typeof MOTIVOS_CAMBIO_RECHAZADO)[number];

export type EvaluacionCambio =
  { permitido: true } | { permitido: false; motivo: MotivoCambioRechazado; excesos: ExcesoPlan[] };

/** Cuánto supera el uso a los límites de un plan; vacío si entra. */
export function excesosDe(plan: Plan, uso: UsoPlan): ExcesoPlan[] {
  const limites = LIMITES_PLAN[plan];
  return RECURSOS_PLAN.flatMap((recurso) => {
    const limite = limites[recurso];
    return limite !== null && uso[recurso] > limite
      ? [{ recurso, cantidad: uso[recurso], limite }]
      : [];
  });
}

/**
 * Regla de cambio de plan (HU-14, design D2): no se cambia al plan vigente ni a uno cuyos
 * límites el comercio ya supera.
 */
export function evaluarCambioDePlan(actual: Plan, nuevo: Plan, uso: UsoPlan): EvaluacionCambio {
  if (actual === nuevo) return { permitido: false, motivo: 'MISMO_PLAN', excesos: [] };
  const excesos = excesosDe(nuevo, uso);
  if (excesos.length > 0) return { permitido: false, motivo: 'SUPERA_LIMITES', excesos };
  return { permitido: true };
}

// --- Contrato de la API ---------------------------------------------------------------------

/** Respuesta de GET /api/v1/plan y de POST /api/v1/plan/change. */
export const PlanDetalleSchema = z.object({
  plan: PlanSchema,
  /** `null` significa sin tope. */
  limites: z.object({
    productos: z.number().int().nullable(),
    usuarios: z.number().int().nullable(),
  }),
  uso: UsoPlanSchema,
  funcionalidades: z.array(FuncionalidadPlanSchema),
});
export type PlanDetalle = z.infer<typeof PlanDetalleSchema>;

/** Cuerpo de POST /api/v1/plan/change. */
export const CambioPlanSchema = z.object({
  plan: z.enum(PLANES, 'Elegí un plan: FREE, PRO o PREMIUM.'),
});
export type CambioPlan = z.infer<typeof CambioPlanSchema>;

export const RegistroCambioPlanSchema = z.object({
  id: z.uuid(),
  planAnterior: PlanSchema,
  planNuevo: PlanSchema,
  usuario: z.object({ id: z.uuid(), nombre: z.string().nullable() }),
  creadoEn: z.string(),
});
export type RegistroCambioPlan = z.infer<typeof RegistroCambioPlanSchema>;

export const HistorialPlanSchema = z.object({
  items: z.array(RegistroCambioPlanSchema),
  siguienteCursor: z.string().nullable(),
});
export type HistorialPlan = z.infer<typeof HistorialPlanSchema>;

export const HistorialPlanQuerySchema = z.object({
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type HistorialPlanQuery = z.infer<typeof HistorialPlanQuerySchema>;

const NOMBRE_RECURSO: Record<RecursoPlan, [string, string]> = {
  productos: ['producto activo', 'productos activos'],
  usuarios: ['usuario activo', 'usuarios activos'],
};

/** "tenés 60 productos activos y el plan admite 50" */
export function describirExceso(e: ExcesoPlan): string {
  const [uno, varios] = NOMBRE_RECURSO[e.recurso];
  return `tenés ${e.cantidad} ${e.cantidad === 1 ? uno : varios} y el plan admite ${e.limite}`;
}

/** Por qué no se puede cambiar de plan, en una frase para el usuario. */
export function mensajeCambioRechazado(
  nuevo: Plan,
  evaluacion: Extract<EvaluacionCambio, { permitido: false }>,
): string {
  if (evaluacion.motivo === 'MISMO_PLAN') {
    return `Tu comercio ya está en el plan ${NOMBRE_PLAN[nuevo]}.`;
  }
  const detalle = evaluacion.excesos.map(describirExceso).join('; ');
  return `No se puede pasar al plan ${NOMBRE_PLAN[nuevo]}: ${detalle}. Dá de baja lo que sobra y volvé a intentar.`;
}
