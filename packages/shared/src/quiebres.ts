import { z } from 'zod';
import { margenBruto, precioNeto, redondear2 } from './rentabilidad';

// ---------------------------------------------------------------------------
// Pérdidas por falta de stock — HU-18 (RF-19, RN-14; RN-01, RN-03)
// ---------------------------------------------------------------------------

export const DIAS_QUIEBRES = [30, 60, 90] as const;
export type DiasQuiebres = (typeof DIAS_QUIEBRES)[number];
/** La demanda se estima siempre con los últimos 90 días (design D4). */
export const VENTANA_DEMANDA_DIAS = 90;
/** Con menos días con stock que estos no hay de dónde estimar la demanda (RN-14). */
export const MIN_DIAS_CON_STOCK = 7;
export const DIA_MS = 24 * 60 * 60 * 1000;

/** El stock que dejó un movimiento, en el orden en que se registró. */
export interface EventoStock {
  instante: Date;
  stockResultante: number;
}

export interface TramoSinStock {
  desde: Date;
  hasta: Date;
  /** Sigue sin stock al final del rango (el momento de la consulta). */
  enCurso: boolean;
}

interface Tramo {
  desde: number;
  hasta: number;
  conStock: boolean;
  /** Sin stock después de haberlo tenido: los ceros previos al primer stock no son quiebre. */
  quiebre: boolean;
}

function tramosDeStock(
  stockInicial: number,
  eventos: EventoStock[],
  desde: Date,
  hasta: Date,
  teniaStockAntes: boolean,
): Tramo[] {
  const fin = hasta.getTime();
  const tramos: Tramo[] = [];
  let inicio = desde.getTime();
  let stock = stockInicial;
  let tuvoStock = stockInicial > 0 || teniaStockAntes;
  const cerrar = (hastaMs: number) => {
    const h = Math.min(hastaMs, fin);
    if (h > inicio)
      tramos.push({
        desde: inicio,
        hasta: h,
        conStock: stock > 0,
        quiebre: stock <= 0 && tuvoStock,
      });
  };
  for (const e of eventos) {
    const t = Math.max(e.instante.getTime(), inicio);
    if (t >= fin) break;
    if (e.stockResultante > 0 === stock > 0) {
      stock = e.stockResultante;
      continue;
    }
    cerrar(t);
    inicio = t;
    stock = e.stockResultante;
    if (stock > 0) tuvoStock = true;
  }
  cerrar(fin);
  return tramos;
}

/**
 * Tramos con stock 0 dentro de [desde, hasta] (RN-14). `stockInicial` es el stock en `desde` y
 * `eventos` los movimientos posteriores, en orden. Si el producto arranca en 0 sin haber tenido
 * stock antes (`teniaStockAntes: false`), ese primer cero no es un quiebre.
 */
export function tramosSinStock(
  stockInicial: number,
  eventos: EventoStock[],
  desde: Date,
  hasta: Date,
  teniaStockAntes = true,
): TramoSinStock[] {
  const fin = hasta.getTime();
  return tramosDeStock(stockInicial, eventos, desde, hasta, teniaStockAntes)
    .filter((t) => t.quiebre)
    .map((t) => ({ desde: new Date(t.desde), hasta: new Date(t.hasta), enCurso: t.hasta === fin }));
}

/** Días (con fracción) en que el producto tuvo stock dentro de [desde, hasta]. */
export function diasConStock(
  stockInicial: number,
  eventos: EventoStock[],
  desde: Date,
  hasta: Date,
): number {
  return (
    tramosDeStock(stockInicial, eventos, desde, hasta, true)
      .filter((t) => t.conStock)
      .reduce((s, t) => s + (t.hasta - t.desde), 0) / DIA_MS
  );
}

/** Los tramos recortados a [desde, hasta]; los que quedan afuera desaparecen. */
export function recortarTramos(tramos: TramoSinStock[], desde: Date, hasta: Date): TramoSinStock[] {
  return tramos.flatMap((t) => {
    const d = Math.max(t.desde.getTime(), desde.getTime());
    const h = Math.min(t.hasta.getTime(), hasta.getTime());
    return h > d ? [{ ...t, desde: new Date(d), hasta: new Date(h) }] : [];
  });
}

export const diasDe = (tramos: TramoSinStock[]) =>
  tramos.reduce((s, t) => s + (t.hasta.getTime() - t.desde.getTime()), 0) / DIA_MS;

export const MotivoQuiebreSchema = z.enum(['SIN_HISTORIAL']);
export type MotivoQuiebre = z.infer<typeof MotivoQuiebreSchema>;

export interface Perdida {
  demandaDiaria: string | null;
  unidadesPerdidas: string | null;
  ventaPerdida: string | null;
  gananciaPerdida: string | null;
  motivo: MotivoQuiebre | null;
}

/**
 * RN-14: demanda diaria = ventas de los días con stock / esos días; unidades perdidas = días sin
 * stock × demanda; venta y ganancia perdidas con el precio neto (RN-03) y el margen bruto (RN-01)
 * vigentes. Se redondea al final para no acumular error.
 */
export function estimarPerdida(d: {
  diasSinStock: number;
  diasConStock: number;
  unidadesVendidas: number;
  precioVenta: string | number;
  alicuotaIva: string | number;
  costo: string | number;
}): Perdida {
  if (d.diasConStock < MIN_DIAS_CON_STOCK || d.unidadesVendidas <= 0) {
    return {
      demandaDiaria: null,
      unidadesPerdidas: null,
      ventaPerdida: null,
      gananciaPerdida: null,
      motivo: 'SIN_HISTORIAL',
    };
  }
  const demanda = d.unidadesVendidas / d.diasConStock;
  const unidades = d.diasSinStock * demanda;
  const neto = precioNeto(d.precioVenta, d.alicuotaIva);
  return {
    demandaDiaria: demanda.toFixed(1),
    unidadesPerdidas: unidades.toFixed(1),
    ventaPerdida: redondear2(unidades * Number(neto)),
    gananciaPerdida: redondear2(unidades * Number(margenBruto(neto, d.costo))),
    motivo: null,
  };
}

/** Un decimal, como número: así se informan los días. */
export const unDecimal = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

export const ProductoConQuiebresSchema = z.object({
  producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  /** Quiebres que tocan el período, aunque hayan empezado antes. */
  quiebres: z.number().int(),
  diasSinStock: z.number(),
  enCurso: z.boolean(),
  /** Inicio del último quiebre (ISO 8601), aunque sea anterior al período. */
  inicioUltimo: z.string(),
  demandaDiaria: z.string().nullable(),
  unidadesPerdidas: z.string().nullable(),
  ventaPerdida: z.string().nullable(),
  gananciaPerdida: z.string().nullable(),
  motivo: MotivoQuiebreSchema.nullable(),
});
export type ProductoConQuiebres = z.infer<typeof ProductoConQuiebresSchema>;

export const TotalesQuiebresSchema = z.object({
  gananciaPerdida: z.string(),
  ventaPerdida: z.string(),
  unidadesPerdidas: z.string(),
  productosAfectados: z.number().int(),
  enCurso: z.number().int(),
});
export type TotalesQuiebres = z.infer<typeof TotalesQuiebresSchema>;

/** Respuesta de GET /api/v1/stockouts. */
export const ListaQuiebresSchema = z.object({
  dias: z.number().int(),
  desde: z.string(),
  hasta: z.string(),
  totales: TotalesQuiebresSchema,
  items: z.array(ProductoConQuiebresSchema),
  siguienteCursor: z.string().nullable(),
});
export type ListaQuiebres = z.infer<typeof ListaQuiebresSchema>;

/** Parámetros de GET /api/v1/stockouts. */
export const StockoutsQuerySchema = z.object({
  dias: z.coerce
    .number('Elegí 30, 60 o 90 días.')
    .refine((n): n is DiasQuiebres => (DIAS_QUIEBRES as readonly number[]).includes(n), {
      message: 'Elegí 30, 60 o 90 días.',
    })
    .default(30),
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type StockoutsQuery = z.infer<typeof StockoutsQuerySchema>;

/** Bloque del panel: los últimos 30 días; null si el plan no lo incluye. */
export const QuiebresDashboardSchema = z
  .object({
    gananciaPerdida: z.string(),
    ventaPerdida: z.string(),
    productosAfectados: z.number().int(),
  })
  .nullable();
export type QuiebresDashboard = z.infer<typeof QuiebresDashboardSchema>;

/** Ganancia perdida de mayor a menor; los no calculables al final, por días sin stock (D5). */
export function ordenarQuiebres(items: ProductoConQuiebres[]): ProductoConQuiebres[] {
  const ganancia = (p: ProductoConQuiebres) =>
    p.gananciaPerdida === null ? Number.NEGATIVE_INFINITY : Number(p.gananciaPerdida);
  return [...items].sort(
    (a, b) =>
      ganancia(b) - ganancia(a) ||
      b.diasSinStock - a.diasSinStock ||
      a.producto.nombre.localeCompare(b.producto.nombre, 'es') ||
      a.producto.id.localeCompare(b.producto.id),
  );
}

/** Totales sobre todos los productos con quiebres; los no calculables sólo cuentan como afectados. */
export function totalizarQuiebres(items: ProductoConQuiebres[]): TotalesQuiebres {
  const suma = (campo: 'gananciaPerdida' | 'ventaPerdida' | 'unidadesPerdidas') =>
    items.reduce((s, p) => s + (p[campo] === null ? 0 : Number(p[campo])), 0);
  return {
    gananciaPerdida: redondear2(suma('gananciaPerdida')),
    ventaPerdida: redondear2(suma('ventaPerdida')),
    unidadesPerdidas: suma('unidadesPerdidas').toFixed(1),
    productosAfectados: items.length,
    enCurso: items.filter((p) => p.enCurso).length,
  };
}
