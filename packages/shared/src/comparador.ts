import { z } from 'zod';
import { redondear2 } from './rentabilidad';

// ---------------------------------------------------------------------------
// Comparador de precios entre proveedores — HU-12 (RF-12; RN-08, RN-13)
// ---------------------------------------------------------------------------

/** RN-13: cuánto pesa cada componente en el puntaje de un proveedor. */
export const PESOS_PUNTAJE = { precio: 0.6, plazo: 0.25, confiabilidad: 0.15 } as const;
export const CONFIABILIDAD_MAX = 5;
/** Con menos de dos proveedores no hay nada que comparar. */
export const MIN_PROVEEDORES_COMPARABLES = 2;

/** Un proveedor activo con su costo vigente para el insumo. */
export interface CandidatoComparador {
  proveedorId: string;
  nombre: string;
  /** Costo neto vigente. */
  costo: number;
  leadTimeDias: number;
  confiabilidad: number;
  /** Desde cuándo rige ese costo (ISO). */
  vigenteDesde: string;
}

export const ProveedorComparadoSchema = z.object({
  proveedor: z.object({ id: z.uuid(), nombre: z.string() }),
  costoNeto: z.string(),
  vigenteDesde: z.string(),
  leadTimeDias: z.number().int(),
  confiabilidad: z.number().int(),
  /** Cuánto más caro es que el más barato, en porcentaje. */
  diferenciaPct: z.string(),
  esPrincipal: z.boolean(),
  /** Componentes de 0 a 100 (RN-13). */
  puntajePrecio: z.string(),
  puntajePlazo: z.string(),
  puntajeConfiabilidad: z.string(),
  puntaje: z.string(),
});
export type ProveedorComparado = z.infer<typeof ProveedorComparadoSchema>;

/**
 * RN-13: puntaje = 0,60 × precio + 0,25 × plazo + 0,15 × confiabilidad, cada componente de 0 a
 * 100 contra el mejor de los comparados. El plazo usa (mínimo + 1) ÷ (plazo + 1) para admitir
 * entrega en el día. Devuelve los proveedores de mayor a menor puntaje; ante un empate, menor
 * costo, menor plazo, mayor confiabilidad y nombre. Un costo que no es positivo no participa.
 */
export function puntuarProveedores(
  candidatos: CandidatoComparador[],
  proveedorPrincipalId: string | null = null,
): ProveedorComparado[] {
  const validos = candidatos.filter((c) => c.costo > 0);
  if (validos.length === 0) return [];
  const costoMinimo = Math.min(...validos.map((c) => c.costo));
  const plazoMinimo = Math.min(...validos.map((c) => c.leadTimeDias));
  return validos
    .map((c) => {
      const precio = (100 * costoMinimo) / c.costo;
      const plazo = (100 * (plazoMinimo + 1)) / (c.leadTimeDias + 1);
      const confiabilidad = (100 * c.confiabilidad) / CONFIABILIDAD_MAX;
      const puntaje =
        PESOS_PUNTAJE.precio * precio +
        PESOS_PUNTAJE.plazo * plazo +
        PESOS_PUNTAJE.confiabilidad * confiabilidad;
      return { c, precio, plazo, confiabilidad, puntaje: Number(redondear2(puntaje)) };
    })
    .sort(
      (a, b) =>
        b.puntaje - a.puntaje ||
        a.c.costo - b.c.costo ||
        a.c.leadTimeDias - b.c.leadTimeDias ||
        b.c.confiabilidad - a.c.confiabilidad ||
        a.c.nombre.localeCompare(b.c.nombre, 'es') ||
        a.c.proveedorId.localeCompare(b.c.proveedorId),
    )
    .map(({ c, precio, plazo, confiabilidad, puntaje }) => ({
      proveedor: { id: c.proveedorId, nombre: c.nombre },
      costoNeto: redondear2(c.costo),
      vigenteDesde: c.vigenteDesde,
      leadTimeDias: c.leadTimeDias,
      confiabilidad: c.confiabilidad,
      diferenciaPct: redondear2((c.costo / costoMinimo - 1) * 100),
      esPrincipal: c.proveedorId === proveedorPrincipalId,
      puntajePrecio: redondear2(precio),
      puntajePlazo: redondear2(plazo),
      puntajeConfiabilidad: redondear2(confiabilidad),
      puntaje: redondear2(puntaje),
    }));
}

/** El de mayor puntaje: el primero de la lista ya ordenada. */
export function recomendado(puntuados: ProveedorComparado[]): ProveedorComparado | null {
  return puntuados[0] ?? null;
}

/** El de menor costo; ante un empate, el de mayor puntaje. */
export function masBarato(puntuados: ProveedorComparado[]): ProveedorComparado | null {
  return puntuados.find((p) => Number(p.diferenciaPct) === 0) ?? null;
}

/**
 * Ahorro mensual estimado al pasar del principal al recomendado: diferencia de costo × unidades
 * vendidas en 30 días. null si falta algún dato o si no hay ahorro.
 */
export function ahorroEstimado(
  costoPrincipal: string | number | null,
  costoRecomendado: string | number | null,
  unidades30d: number,
): string | null {
  if (costoPrincipal === null || costoRecomendado === null || unidades30d <= 0) return null;
  const diferencia = Number(costoPrincipal) - Number(costoRecomendado);
  return diferencia > 0 ? redondear2(diferencia * unidades30d) : null;
}

const ProductoRefSchema = z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() });

const ProveedorResumidoSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  costoNeto: z.string(),
  puntaje: z.string(),
});
export type ProveedorResumido = z.infer<typeof ProveedorResumidoSchema>;

/** Respuesta de GET /api/v1/products/:id/supplier-comparison. */
export const ComparacionProductoSchema = z.object({
  producto: ProductoRefSchema,
  /** De mayor a menor puntaje. */
  proveedores: z.array(ProveedorComparadoSchema),
  recomendado: ProveedorResumidoSchema.nullable(),
  masBarato: ProveedorResumidoSchema.nullable(),
  /** Proveedor principal del producto, si tiene un costo cargado y está activo. */
  principal: ProveedorResumidoSchema.nullable(),
  /** true con dos o más proveedores. */
  comparable: z.boolean(),
  /** true si el recomendado no es el proveedor principal. */
  cambiaProveedor: z.boolean(),
  unidades30d: z.number().int(),
  ahorroEstimado: z.string().nullable(),
});
export type ComparacionProducto = z.infer<typeof ComparacionProductoSchema>;

/** Fila del resumen de insumos. */
export const InsumoComparadoSchema = z.object({
  producto: ProductoRefSchema,
  proveedores: z.number().int(),
  recomendado: ProveedorResumidoSchema,
  masBarato: ProveedorResumidoSchema,
  principal: ProveedorResumidoSchema.nullable(),
  cambiaProveedor: z.boolean(),
  unidades30d: z.number().int(),
  ahorroEstimado: z.string().nullable(),
});
export type InsumoComparado = z.infer<typeof InsumoComparadoSchema>;

export const TotalesComparadorSchema = z.object({
  /** Insumos con dos o más proveedores. */
  comparables: z.number().int(),
  /** Insumos cuyo recomendado no es su proveedor principal. */
  conCambio: z.number().int(),
  ahorroEstimado: z.string(),
});
export type TotalesComparador = z.infer<typeof TotalesComparadorSchema>;

/** Respuesta de GET /api/v1/supplier-comparison. */
export const ResumenComparadorSchema = z.object({
  items: z.array(InsumoComparadoSchema),
  siguienteCursor: z.string().nullable(),
  /** Sobre todos los insumos comparables del comercio, sin filtros. */
  totales: TotalesComparadorSchema,
});
export type ResumenComparador = z.infer<typeof ResumenComparadorSchema>;

/** Parámetros de GET /api/v1/supplier-comparison. */
export const ComparadorQuerySchema = z.object({
  soloOportunidades: z
    .enum(['true', 'false'], 'Usá true o false.')
    .default('false')
    .transform((v) => v === 'true'),
  q: z.string().trim().max(120).optional(),
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ComparadorQuery = z.infer<typeof ComparadorQuerySchema>;

export const resumir = (p: ProveedorComparado): ProveedorResumido => ({
  id: p.proveedor.id,
  nombre: p.proveedor.nombre,
  costoNeto: p.costoNeto,
  puntaje: p.puntaje,
});

/** Insumo del resumen a partir de los proveedores puntuados; null si no es comparable. */
export function compararInsumo(
  producto: { id: string; codigo: string; nombre: string },
  candidatos: CandidatoComparador[],
  proveedorPrincipalId: string | null,
  unidades30d: number,
): ComparacionProducto {
  const proveedores = puntuarProveedores(candidatos, proveedorPrincipalId);
  const mejor = recomendado(proveedores);
  const barato = masBarato(proveedores);
  const principal = proveedores.find((p) => p.esPrincipal) ?? null;
  return {
    producto,
    proveedores,
    recomendado: mejor ? resumir(mejor) : null,
    masBarato: barato ? resumir(barato) : null,
    principal: principal ? resumir(principal) : null,
    comparable: proveedores.length >= MIN_PROVEEDORES_COMPARABLES,
    cambiaProveedor: mejor !== null && !mejor.esPrincipal,
    unidades30d,
    ahorroEstimado: ahorroEstimado(
      principal?.costoNeto ?? null,
      mejor?.costoNeto ?? null,
      unidades30d,
    ),
  };
}
