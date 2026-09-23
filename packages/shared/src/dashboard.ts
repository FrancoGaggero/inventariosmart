import { z } from 'zod';
import { ReposicionDashboardSchema } from './alertas';
import { MesSchema, MotivoResumenSchema } from './gastos';
import { porcentaje } from './rentabilidad';

// ---------------------------------------------------------------------------
// Dashboard financiero — HU-04 (RF-05, RNF-04)
// ---------------------------------------------------------------------------

/** Variación porcentual de `actual` respecto de `anterior`; null si no hay base. */
export function variacionPct(actual: string | number, anterior: string | number): string | null {
  const base = Number(anterior);
  if (!(base > 0)) return null;
  return porcentaje(Number(actual) - base, base);
}

export const StockDashboardSchema = z.object({
  productosActivos: z.number().int(),
  /** Suma de stock_actual de los productos activos. */
  unidades: z.number().int(),
  /** Σ stock × costo de reposición vigente, neto. */
  valorizacion: z.string(),
  sinStock: z.number().int(),
  stockBajo: z.number().int(),
});

export const VentasDashboardSchema = z.object({
  unidadesVendidas: z.number().int(),
  ventasNetas: z.string(),
  costoVendido: z.string(),
  margenBruto: z.string(),
  margenBrutoPct: z.string().nullable(),
  gastos: z.string(),
  margenNeto: z.string().nullable(),
  margenNetoPct: z.string().nullable(),
  motivo: MotivoResumenSchema.nullable(),
});

export const MesAnteriorDashboardSchema = z.object({
  periodo: MesSchema,
  unidadesVendidas: z.number().int(),
  ventasNetas: z.string(),
  /** Variación de las ventas netas del mes contra el anterior; null si el anterior no tuvo ventas. */
  variacionVentasPct: z.string().nullable(),
});

export const TopRentableSchema = z.object({
  producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  unidadesVendidas: z.number().int(),
  margenBruto: z.string(),
  margenBrutoPct: z.string().nullable(),
  /** margenBruto × unidadesVendidas: lo que dejó el producto en el mes. */
  margenBrutoMes: z.string(),
});
export type TopRentable = z.infer<typeof TopRentableSchema>;

export const AlertaStockSchema = z.object({
  id: z.uuid(),
  codigo: z.string(),
  nombre: z.string(),
  stockActual: z.number().int(),
  stockSeguridad: z.number().int(),
});
export type AlertaStock = z.infer<typeof AlertaStockSchema>;

export const AlertasDashboardSchema = z.object({
  sinStock: z.object({ total: z.number().int(), items: z.array(AlertaStockSchema) }),
  stockBajo: z.object({ total: z.number().int(), items: z.array(AlertaStockSchema) }),
  /** true cuando el margen neto no se puede calcular por falta de gastos del mes. */
  faltanGastos: z.boolean(),
  /** Alertas de reposición activas (HU-06); null si el plan no las incluye. */
  reposicion: ReposicionDashboardSchema,
});

/** Respuesta de GET /api/v1/dashboard. */
export const DashboardSchema = z.object({
  periodo: MesSchema,
  stock: StockDashboardSchema,
  ventas: VentasDashboardSchema,
  mesAnterior: MesAnteriorDashboardSchema,
  topRentables: z.array(TopRentableSchema),
  alertas: AlertasDashboardSchema,
});
export type Dashboard = z.infer<typeof DashboardSchema>;
