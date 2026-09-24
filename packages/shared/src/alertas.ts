import { z } from 'zod';
import { EstadoStockSchema, listaPaginadaSchema } from './productos';
// Lead time cuando el producto no tiene proveedor principal (design D1): el mismo default de HU-02.
import { LEAD_TIME_DEFAULT } from './proveedores';

// ---------------------------------------------------------------------------
// Alertas predictivas de reposición — HU-06 (RF-06, RN-04)
// ---------------------------------------------------------------------------

/** Días de anticipación de la alerta por defecto (HU-06 criterio 4). */
export const DIAS_ANTICIPACION_DEFAULT = 3;
export const DIAS_ANTICIPACION_MAX = 90;
/** Días que se pospone una alerta. */
export const DIAS_POSPOSICION = 7;
/** Ventana de ventas para la velocidad (RN-04). */
export const VENTANA_VELOCIDAD_DIAS = 30;
/** Días de venta que cubre la cantidad sugerida, además del lead time. */
export const DIAS_COBERTURA_SUGERIDA = 30;
/** Edad máxima del último cálculo antes de recalcular bajo demanda. */
export const MAX_EDAD_CALCULO_MS = 60 * 60 * 1000;

export const ESTADOS_ALERTA = ['ACTIVA', 'POSPUESTA', 'ATENDIDA', 'RESUELTA'] as const;
export const EstadoAlertaSchema = z.enum(ESTADOS_ALERTA);
export type EstadoAlerta = z.infer<typeof EstadoAlertaSchema>;

export const ETIQUETA_ESTADO_ALERTA: Record<EstadoAlerta, string> = {
  ACTIVA: 'Activa',
  POSPUESTA: 'Pospuesta',
  ATENDIDA: 'Atendida',
  RESUELTA: 'Resuelta',
};

export const SEVERIDADES_ALERTA = ['PROXIMA', 'CRITICA'] as const;
export const SeveridadAlertaSchema = z.enum(SEVERIDADES_ALERTA);
export type SeveridadAlerta = z.infer<typeof SeveridadAlertaSchema>;

export const ETIQUETA_SEVERIDAD: Record<SeveridadAlerta, string> = {
  PROXIMA: 'Próxima al quiebre',
  CRITICA: 'Crítica',
};

/** Unidades vendidas en los últimos 30 días ÷ 30, con 3 decimales (RN-04). */
export function velocidadDiaria(unidades30d: number): number {
  if (!Number.isFinite(unidades30d) || unidades30d <= 0) return 0;
  return Math.round((unidades30d / VENTANA_VELOCIDAD_DIAS) * 1000) / 1000;
}

/** Punto de reposición = ⌈velocidad × lead time⌉ + stock de seguridad (RN-04). */
export function puntoReposicion(
  velocidad: number,
  leadTimeDias: number,
  stockSeguridad: number,
): number {
  return Math.ceil(velocidad * leadTimeDias - 1e-9) + stockSeguridad;
}

/** Umbral de alerta = ⌈velocidad × (lead time + anticipación)⌉ + stock de seguridad. */
export function umbralAlerta(
  velocidad: number,
  leadTimeDias: number,
  diasAnticipacion: number,
  stockSeguridad: number,
): number {
  return Math.ceil(velocidad * (leadTimeDias + diasAnticipacion) - 1e-9) + stockSeguridad;
}

/** Días que dura el stock al ritmo actual; null sin ventas. */
export function diasCobertura(stock: number, velocidad: number): number | null {
  if (velocidad <= 0) return null;
  return Math.max(0, Math.floor(stock / velocidad));
}

/** Unidades para cubrir el lead time más 30 días de venta, descontando el stock. */
export function cantidadSugerida(
  velocidad: number,
  leadTimeDias: number,
  stock: number,
  stockSeguridad: number,
): number {
  const necesario =
    Math.ceil(velocidad * (leadTimeDias + DIAS_COBERTURA_SUGERIDA) - 1e-9) + stockSeguridad;
  return Math.max(0, necesario - stock);
}

export interface EntradaReposicion {
  stock: number;
  unidades30d: number;
  /** null → LEAD_TIME_DEFAULT. */
  leadTimeDias: number | null;
  stockSeguridad: number;
  diasAnticipacion: number;
}

export interface EvaluacionReposicion {
  enAlerta: boolean;
  severidad: SeveridadAlerta | null;
  velocidadDiaria: number;
  diasCobertura: number | null;
  puntoReposicion: number;
  umbral: number;
  leadTimeDias: number;
  diasAnticipacion: number;
  cantidadSugerida: number;
}

/**
 * Evalúa RN-04 para un producto. Hay alerta sólo con velocidad mayor a cero y stock
 * menor o igual al umbral; es CRITICA si el stock no supera el punto de reposición
 * (HU-06 criterios 1 y 2).
 */
export function evaluarReposicion(e: EntradaReposicion): EvaluacionReposicion {
  const leadTimeDias = e.leadTimeDias ?? LEAD_TIME_DEFAULT;
  const velocidad = velocidadDiaria(e.unidades30d);
  const punto = puntoReposicion(velocidad, leadTimeDias, e.stockSeguridad);
  const umbral = umbralAlerta(velocidad, leadTimeDias, e.diasAnticipacion, e.stockSeguridad);
  const enAlerta = velocidad > 0 && e.stock <= umbral;
  return {
    enAlerta,
    severidad: !enAlerta ? null : e.stock <= punto ? 'CRITICA' : 'PROXIMA',
    velocidadDiaria: velocidad,
    diasCobertura: diasCobertura(e.stock, velocidad),
    puntoReposicion: punto,
    umbral,
    leadTimeDias,
    diasAnticipacion: e.diasAnticipacion,
    cantidadSugerida:
      velocidad > 0 ? cantidadSugerida(velocidad, leadTimeDias, e.stock, e.stockSeguridad) : 0,
  };
}

/** Alerta tal como la devuelve la API. */
export const AlertaSchema = z.object({
  id: z.uuid(),
  producto: z.object({
    id: z.uuid(),
    codigo: z.string(),
    nombre: z.string(),
    stockActual: z.number().int(),
    stockSeguridad: z.number().int(),
    estadoStock: EstadoStockSchema,
  }),
  proveedor: z
    .object({ id: z.uuid(), nombre: z.string(), leadTimeDias: z.number().int() })
    .nullable(),
  estado: EstadoAlertaSchema,
  severidad: SeveridadAlertaSchema,
  /** Stock al momento del último cálculo. */
  stock: z.number().int(),
  velocidadDiaria: z.string(),
  diasCobertura: z.number().int().nullable(),
  puntoReposicion: z.number().int(),
  umbral: z.number().int(),
  leadTimeDias: z.number().int(),
  diasAnticipacion: z.number().int(),
  cantidadSugerida: z.number().int(),
  generadaEn: z.string(),
  actualizadaEn: z.string(),
  pospuestaHasta: z.string().nullable(),
  atendidaEn: z.string().nullable(),
  resueltaEn: z.string().nullable(),
  notificadaEn: z.string().nullable(),
  /** Orden de compra que la atendió (HU-07); null si se atendió a mano o sigue abierta. */
  ordenCompraId: z.uuid().nullable(),
});
export type Alerta = z.infer<typeof AlertaSchema>;

export const ListaAlertasSchema = listaPaginadaSchema(AlertaSchema);
export type ListaAlertas = z.infer<typeof ListaAlertasSchema>;

/** Parámetros de GET /api/v1/alerts. `TODAS` incluye cerradas. */
export const AlertasQuerySchema = z.object({
  estado: z.enum([...ESTADOS_ALERTA, 'TODAS']).default('ACTIVA'),
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AlertasQuery = z.infer<typeof AlertasQuerySchema>;

/** Cuerpo de PATCH /api/v1/alerts/:id. */
export const ACCIONES_ALERTA = ['ATENDER', 'POSPONER'] as const;
export const AlertaAccionSchema = z.object({
  accion: z.enum(ACCIONES_ALERTA, 'La acción debe ser ATENDER o POSPONER.'),
});
export type AlertaAccion = z.infer<typeof AlertaAccionSchema>;

/** Respuesta de GET /api/v1/alerts/summary. */
export const ResumenAlertasSchema = z.object({
  activas: z.number().int(),
  criticas: z.number().int(),
  pospuestas: z.number().int(),
  /** null si nunca se calculó. */
  calculadasEn: z.string().nullable(),
});
export type ResumenAlertas = z.infer<typeof ResumenAlertasSchema>;

/** Respuesta de POST /api/v1/alerts/recalculate. */
export const ResultadoRecalculoSchema = z.object({
  creadas: z.number().int(),
  actualizadas: z.number().int(),
  resueltas: z.number().int(),
  calculadasEn: z.string(),
});
export type ResultadoRecalculo = z.infer<typeof ResultadoRecalculoSchema>;

/** Bloque `alertas.reposicion` del panel (HU-04 + HU-06); null en plan FREE. */
export const ReposicionDashboardSchema = z
  .object({
    total: z.number().int(),
    criticas: z.number().int(),
    items: z.array(
      z.object({
        id: z.uuid(),
        producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
        severidad: SeveridadAlertaSchema,
        stock: z.number().int(),
        diasCobertura: z.number().int().nullable(),
        cantidadSugerida: z.number().int(),
      }),
    ),
  })
  .nullable();
export type ReposicionDashboard = z.infer<typeof ReposicionDashboardSchema>;

/** true si el último cálculo falta o es más viejo que MAX_EDAD_CALCULO_MS. */
export function calculoVencido(
  calculadasEn: Date | string | null,
  ahora: Date = new Date(),
): boolean {
  if (!calculadasEn) return true;
  const t = typeof calculadasEn === 'string' ? Date.parse(calculadasEn) : calculadasEn.getTime();
  return !Number.isFinite(t) || ahora.getTime() - t > MAX_EDAD_CALCULO_MS;
}
