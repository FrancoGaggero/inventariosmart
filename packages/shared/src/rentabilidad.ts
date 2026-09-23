import { z } from 'zod';
import { MesSchema, MotivoResumenSchema } from './gastos';

// ---------------------------------------------------------------------------
// Rentabilidad — HU-03 (RF-04, RN-01, RN-02, RN-03)
// ---------------------------------------------------------------------------

/** Redondeo a dos decimales como string, la forma de los montos del contrato. */
export function redondear2(n: number): string {
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}

/** RN-03: precio neto a partir del precio con IVA incluido y la alícuota en porcentaje. */
export function precioNeto(precioConIva: string | number, alicuotaIva: string | number): string {
  return redondear2(Number(precioConIva) / (1 + Number(alicuotaIva) / 100));
}

/** RN-01: margen bruto en pesos = precio neto − costo de reposición neto. */
export function margenBruto(precioNeto: string | number, costo: string | number): string {
  return redondear2(Number(precioNeto) - Number(costo));
}

/** Porcentaje de `parte` sobre `base`, o null si la base no es positiva (RN-01 %). */
export function porcentaje(parte: string | number, base: string | number): string | null {
  const b = Number(base);
  if (!(b > 0)) return null;
  return redondear2((Number(parte) / b) * 100);
}

/** RN-02: margen neto = bruto − gasto por unidad; null cuando el prorrateo no es calculable. */
export function margenNeto(
  bruto: string | number,
  gastoPorUnidad: string | number | null,
): string | null {
  if (gastoPorUnidad === null) return null;
  return redondear2(Number(bruto) - Number(gastoPorUnidad));
}

/** Rentabilidad de un producto en un mes. */
export const RentabilidadProductoSchema = z.object({
  producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  /** Precio de venta con IVA, como se carga. */
  precioVenta: z.string(),
  alicuotaIva: z.string(),
  precioNeto: z.string(),
  costoReposicion: z.string(),
  margenBruto: z.string(),
  /** Sobre el precio neto; null si el precio es 0. */
  margenBrutoPct: z.string().nullable(),
  /** Ventas no anuladas del mes. */
  unidadesVendidas: z.number().int(),
  /** margenBruto × unidadesVendidas. */
  margenBrutoMes: z.string(),
  margenNeto: z.string().nullable(),
  margenNetoPct: z.string().nullable(),
});
export type RentabilidadProducto = z.infer<typeof RentabilidadProductoSchema>;

export const ListaRentabilidadSchema = z.object({
  periodo: MesSchema,
  /** Gasto operativo por unidad vendida del mes (operating-expenses), o null con motivo. */
  gastoPorUnidad: z.string().nullable(),
  motivoNeto: MotivoResumenSchema.nullable(),
  items: z.array(RentabilidadProductoSchema),
  siguienteCursor: z.string().nullable(),
});
export type ListaRentabilidad = z.infer<typeof ListaRentabilidadSchema>;

/** Consolidado del mes. */
export const ResumenRentabilidadSchema = z.object({
  periodo: MesSchema,
  unidadesVendidas: z.number().int(),
  /** Σ cantidad × precio unitario neto de las ventas no anuladas. */
  ventasNetas: z.string(),
  /** Σ cantidad × costo de reposición vigente (RN-08). */
  costoVendido: z.string(),
  margenBruto: z.string(),
  /** Sobre ventas netas; null sin ventas. */
  margenBrutoPct: z.string().nullable(),
  gastos: z.string(),
  margenNeto: z.string().nullable(),
  margenNetoPct: z.string().nullable(),
  motivo: MotivoResumenSchema.nullable(),
});
export type ResumenRentabilidad = z.infer<typeof ResumenRentabilidadSchema>;

/** Parámetros de GET /api/v1/profitability/products. */
export const RentabilidadQuerySchema = z.object({
  periodo: MesSchema.optional(),
  q: z.string().trim().max(120).optional(),
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type RentabilidadQuery = z.infer<typeof RentabilidadQuerySchema>;
