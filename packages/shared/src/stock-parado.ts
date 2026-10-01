import { z } from 'zod';
import { DIA_MS } from './quiebres';
import { redondear2 } from './rentabilidad';

// ---------------------------------------------------------------------------
// Stock parado — HU-19 (RF-20, RN-15; RN-08)
// ---------------------------------------------------------------------------

export const DIAS_STOCK_PARADO = [30, 60, 90, 180] as const;
export type DiasStockParado = (typeof DIAS_STOCK_PARADO)[number];

/** RN-15: días enteros desde la última venta no anulada o, si nunca se vendió, desde el alta. */
export function diasSinVender(ultimaVenta: Date | null, alta: Date, ahora: Date): number {
  const desde = (ultimaVenta ?? alta).getTime();
  return Math.max(0, Math.floor((ahora.getTime() - desde) / DIA_MS));
}

/** RN-15: stock × costo de reposición vigente, neto de IVA (RN-08). */
export function capitalParado(stock: number, costo: string | number): string {
  return redondear2(stock * Number(costo));
}

export const ProductoParadoSchema = z.object({
  producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  stock: z.number().int(),
  costoReposicion: z.string(),
  capitalParado: z.string(),
  /** Fecha (ISO 8601) de la última venta no anulada; null si nunca se vendió. */
  ultimaVenta: z.string().nullable(),
  diasSinVender: z.number().int(),
});
export type ProductoParado = z.infer<typeof ProductoParadoSchema>;

export const TotalesStockParadoSchema = z.object({
  capitalParado: z.string(),
  productos: z.number().int(),
  unidades: z.number().int(),
  /** Capital parado sobre el stock valorizado de los activos; null si ese stock vale 0. */
  porcentajeDelStock: z.string().nullable(),
});
export type TotalesStockParado = z.infer<typeof TotalesStockParadoSchema>;

/** Respuesta de GET /api/v1/dead-stock. */
export const ListaStockParadoSchema = z.object({
  dias: z.number().int(),
  desde: z.string(),
  hasta: z.string(),
  totales: TotalesStockParadoSchema,
  items: z.array(ProductoParadoSchema),
  siguienteCursor: z.string().nullable(),
});
export type ListaStockParado = z.infer<typeof ListaStockParadoSchema>;

/** Parámetros de GET /api/v1/dead-stock. */
export const DeadStockQuerySchema = z.object({
  dias: z.coerce
    .number('Elegí 30, 60, 90 o 180 días.')
    .refine((n): n is DiasStockParado => (DIAS_STOCK_PARADO as readonly number[]).includes(n), {
      message: 'Elegí 30, 60, 90 o 180 días.',
    })
    .default(90),
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type DeadStockQuery = z.infer<typeof DeadStockQuerySchema>;

/** Bloque del panel: el criterio de 90 días; null si el plan no lo incluye. */
export const StockParadoDashboardSchema = z
  .object({ capitalParado: z.string(), productos: z.number().int() })
  .nullable();
export type StockParadoDashboard = z.infer<typeof StockParadoDashboardSchema>;

/** Capital parado de mayor a menor; después más días sin vender y por nombre (D4). */
export function ordenarStockParado(items: ProductoParado[]): ProductoParado[] {
  return [...items].sort(
    (a, b) =>
      Number(b.capitalParado) - Number(a.capitalParado) ||
      b.diasSinVender - a.diasSinVender ||
      a.producto.nombre.localeCompare(b.producto.nombre, 'es') ||
      a.producto.id.localeCompare(b.producto.id),
  );
}

/** Totales sobre todos los productos parados, antes de paginar. */
export function totalizarStockParado(
  items: ProductoParado[],
  valorizacionTotal: string | number,
): TotalesStockParado {
  const capital = items.reduce((s, p) => s + Number(p.capitalParado), 0);
  const total = Number(valorizacionTotal);
  return {
    capitalParado: redondear2(capital),
    productos: items.length,
    unidades: items.reduce((s, p) => s + p.stock, 0),
    porcentajeDelStock: total > 0 ? redondear2((capital / total) * 100) : null,
  };
}
