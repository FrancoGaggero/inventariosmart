import { z } from 'zod';
import { variacionPct } from './dashboard';
import { MesSchema, mesesEntre, sumarMeses, type Mes } from './gastos';
import { redondear2 } from './rentabilidad';

// ---------------------------------------------------------------------------
// Precios frente a la inflación — HU-15 (RF-16, RNF-08; RN-01, RN-08, RN-11)
// ---------------------------------------------------------------------------

export const SERIES_INDICADOR = [
  'IPC_GENERAL',
  'IPC_BIENES',
  'INFLACION_MENSUAL',
  'INFLACION_INTERANUAL',
  'USD_MINORISTA',
] as const;
export const SerieIndicadorSchema = z.enum(SERIES_INDICADOR);
export type SerieIndicador = z.infer<typeof SerieIndicadorSchema>;

/** RN-11: un precio está alineado si su variación real queda dentro de ±2 %. */
export const UMBRAL_ALINEADO_PCT = 2;
export const MESES_MAX = 24;
export const MESES_DEFAULT = 6;
/** Períodos que ofrece la web. */
export const PERIODOS_INFLACION = [3, 6, 12] as const;

export const ESTADOS_PRECIO = ['ATRASADO', 'ALINEADO', 'ADELANTADO'] as const;
export const EstadoPrecioSchema = z.enum(ESTADOS_PRECIO);
export type EstadoPrecio = z.infer<typeof EstadoPrecioSchema>;

export const ETIQUETA_ESTADO_PRECIO: Record<EstadoPrecio, string> = {
  ATRASADO: 'Atrasado',
  ALINEADO: 'Alineado',
  ADELANTADO: 'Adelantado',
};

/**
 * RN-11: variación real = ((1 + nominal) ÷ (1 + referencia) − 1) × 100, con ambas en porcentaje.
 * null si falta alguna o si la referencia es −100 % o menos.
 */
export function variacionReal(
  nominalPct: string | number | null,
  referenciaPct: string | number | null,
): string | null {
  if (nominalPct === null || referenciaPct === null) return null;
  const base = 1 + Number(referenciaPct) / 100;
  if (!(base > 0)) return null;
  return redondear2(((1 + Number(nominalPct) / 100) / base - 1) * 100);
}

/** Serie en índice base 100 al primer valor positivo; los nulos y lo anterior a la base quedan null. */
export function indiceBase100(valores: (string | number | null)[]): (string | null)[] {
  const base = valores.map((v) => (v === null ? NaN : Number(v))).find((v) => v > 0);
  if (base === undefined) return valores.map(() => null);
  let empezo = false;
  return valores.map((v) => {
    if (v === null) return null;
    if (!empezo && !(Number(v) > 0)) return null;
    empezo = true;
    return redondear2((Number(v) / base) * 100);
  });
}

/** Valor de una canasta fija: Σ unidades × valor. */
export function valorCanasta<T extends { unidades: number }>(
  items: T[],
  valorDe: (item: T) => string | number,
): number {
  return items.reduce((acc, i) => acc + i.unidades * Number(valorDe(i)), 0);
}

/** Variación entre el primer y el último valor no nulo de una serie; null si no hay dos puntos. */
export function variacionSerie(serie: (string | null)[]): string | null {
  const valores = serie.filter((v): v is string => v !== null);
  if (valores.length < 2) return null;
  return variacionPct(valores[valores.length - 1]!, valores[0]!);
}

/** RN-11: estado de un precio según su variación real contra la inflación. */
export function estadoPrecio(variacionRealPct: string | number | null): EstadoPrecio | null {
  if (variacionRealPct === null) return null;
  const v = Number(variacionRealPct);
  if (v < -UMBRAL_ALINEADO_PCT) return 'ATRASADO';
  if (v > UMBRAL_ALINEADO_PCT) return 'ADELANTADO';
  return 'ALINEADO';
}

/** Precio que habría acompañado a la inflación del período. */
export function precioSugeridoInflacion(
  precioInicial: string | number,
  ipcPct: string | number | null,
): string | null {
  if (ipcPct === null) return null;
  return redondear2(Number(precioInicial) * (1 + Number(ipcPct) / 100));
}

/**
 * Precio que sostiene el margen bruto porcentual del inicio con el costo final (RN-01): como el
 * margen % depende de la relación costo ÷ precio, el precio acompaña al costo en la misma proporción.
 */
export function precioSugeridoMargen(
  precioInicial: string | number,
  costoInicial: string | number,
  costoFinal: string | number,
): string {
  const base = Number(costoInicial);
  if (!(base > 0)) return redondear2(Number(precioInicial));
  return redondear2((Number(precioInicial) * Number(costoFinal)) / base);
}

/** Meses de `desde` a `hasta`, ambos inclusive. */
export function listaMeses(desde: Mes, hasta: Mes): Mes[] {
  const n = mesesEntre(desde, hasta);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => sumarMeses(desde, i));
}

/** Argentina no tiene horario de verano: el desfase con UTC es fijo (−03:00). */
const DESFASE_HORAS = 3;

/** Instante UTC en que empieza un mes en Buenos Aires. */
export function inicioDeMes(mes: Mes): Date {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(a, m - 1, 1, DESFASE_HORAS));
}

/** Instante UTC (exclusivo) en que cierra un mes en Buenos Aires. */
export function cierreDeMes(mes: Mes): Date {
  return inicioDeMes(sumarMeses(mes, 1));
}

/** Mes (Buenos Aires) al que pertenece un instante. */
export function mesDe(fecha: Date): Mes {
  const d = new Date(fecha.getTime() - DESFASE_HORAS * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// --- Indicadores ----------------------------------------------------------------------

export const IndicadorValorSchema = z.object({
  /** Decimal con dos cifras. */
  valor: z.string(),
  /** Fecha del dato (YYYY-MM-DD). */
  fecha: z.string(),
  fuente: z.string(),
});
export type IndicadorValor = z.infer<typeof IndicadorValorSchema>;

export const IndicadorIpcSchema = z.object({
  /** Nivel del índice (base diciembre 2016 = 100). */
  valor: z.string(),
  periodo: MesSchema,
  fuente: z.string(),
});

/** Respuesta de GET /api/v1/indicators. */
export const IndicadoresSchema = z.object({
  inflacionMensual: IndicadorValorSchema.nullable(),
  inflacionInteranual: IndicadorValorSchema.nullable(),
  dolarMinorista: IndicadorValorSchema.nullable(),
  ipc: IndicadorIpcSchema.nullable(),
  /** Última actualización completa desde las fuentes; null si nunca se pudo. */
  actualizadoEn: z.string().nullable(),
  /** true si la última consulta a alguna fuente falló o el dato tiene más de 48 horas. */
  desactualizado: z.boolean(),
});
export type Indicadores = z.infer<typeof IndicadoresSchema>;

// --- Comparación ----------------------------------------------------------------------

/** Parámetros de GET /api/v1/insights/inflation. */
export const InflacionQuerySchema = z
  .object({
    desde: MesSchema.optional(),
    hasta: MesSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.desde === undefined || v.hasta === undefined) return;
    if (v.desde > v.hasta) {
      ctx.addIssue({
        code: 'custom',
        path: ['desde'],
        message: 'El mes inicial no puede ser posterior al final.',
      });
    } else if (mesesEntre(v.desde, v.hasta) + 1 > MESES_MAX) {
      ctx.addIssue({
        code: 'custom',
        path: ['hasta'],
        message: `El período no puede superar los ${MESES_MAX} meses.`,
      });
    }
  });
export type InflacionQuery = z.infer<typeof InflacionQuerySchema>;

export const MOTIVOS_COMPARACION = ['SIN_VENTAS', 'SIN_IPC'] as const;
export const MotivoComparacionSchema = z.enum(MOTIVOS_COMPARACION);
export type MotivoComparacion = z.infer<typeof MotivoComparacionSchema>;

export const ETIQUETA_MOTIVO_COMPARACION: Record<MotivoComparacion, string> = {
  SIN_VENTAS:
    'No hubo ventas en el período: sin ventas no se puede armar el índice de tus precios.',
  SIN_IPC: 'Todavía no pudimos traer el índice de precios del INDEC. Probá de nuevo más tarde.',
};

export const ProductoInflacionSchema = z.object({
  producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  unidadesVendidas: z.number().int(),
  /** Precios de venta con IVA, como se cargan. */
  precioInicial: z.string(),
  precioFinal: z.string(),
  /** Costos netos del proveedor principal. */
  costoInicial: z.string(),
  costoFinal: z.string(),
  variacionPrecio: z.string().nullable(),
  variacionCosto: z.string().nullable(),
  /** Variación del precio contra el IPC general (RN-11). */
  variacionReal: z.string().nullable(),
  estado: EstadoPrecioSchema.nullable(),
  precioSugeridoInflacion: z.string().nullable(),
  precioSugeridoMargen: z.string(),
  /** Desde cuándo se conoce el precio del producto. */
  datosDesde: z.string(),
});
export type ProductoInflacion = z.infer<typeof ProductoInflacionSchema>;

const SerieSchema = z.array(z.string().nullable());

/** Respuesta de GET /api/v1/insights/inflation. */
export const ComparacionInflacionSchema = z.object({
  desde: MesSchema,
  hasta: MesSchema,
  /** true si el período pedido se recortó al último mes con IPC publicado. */
  recortado: z.boolean(),
  meses: z.array(MesSchema),
  /** Índices base 100 al primer mes, alineados con `meses`; vacías si no se pueden calcular. */
  series: z.object({
    misPrecios: SerieSchema,
    misCostos: SerieSchema,
    ipc: SerieSchema,
    ipcBienes: SerieSchema,
  }),
  variaciones: z.object({
    misPrecios: z.string().nullable(),
    misCostos: z.string().nullable(),
    ipc: z.string().nullable(),
    ipcBienes: z.string().nullable(),
  }),
  /** Variaciones reales de mis precios (RN-11). */
  brechas: z.object({
    preciosVsIpc: z.string().nullable(),
    preciosVsCostos: z.string().nullable(),
  }),
  motivo: MotivoComparacionSchema.nullable(),
  productos: z.array(ProductoInflacionSchema),
});
export type ComparacionInflacion = z.infer<typeof ComparacionInflacionSchema>;

/** Fila por producto con precios y costos al cierre del primer y del último mes. */
export interface FilaProductoInflacion {
  producto: { id: string; codigo: string; nombre: string };
  unidades: number;
  precioInicial: string;
  precioFinal: string;
  costoInicial: string;
  costoFinal: string;
  datosDesde: string;
}

/** Cifras de un producto frente a la inflación del período (RN-11, RN-01). */
export function compararProducto(
  f: FilaProductoInflacion,
  ipcPct: string | null,
): ProductoInflacion {
  const variacionPrecio = variacionPct(f.precioFinal, f.precioInicial);
  const real = variacionReal(variacionPrecio, ipcPct);
  return {
    producto: f.producto,
    unidadesVendidas: f.unidades,
    precioInicial: redondear2(Number(f.precioInicial)),
    precioFinal: redondear2(Number(f.precioFinal)),
    costoInicial: redondear2(Number(f.costoInicial)),
    costoFinal: redondear2(Number(f.costoFinal)),
    variacionPrecio,
    // Sin costo inicial no hay base: el costo se toma como constante.
    variacionCosto: variacionPct(f.costoFinal, f.costoInicial) ?? '0.00',
    variacionReal: real,
    estado: estadoPrecio(real),
    precioSugeridoInflacion: precioSugeridoInflacion(f.precioInicial, ipcPct),
    precioSugeridoMargen: precioSugeridoMargen(f.precioInicial, f.costoInicial, f.costoFinal),
    datosDesde: f.datosDesde,
  };
}

/** Del más atrasado al más adelantado; sin variación real, al final. */
export function ordenarPorAtraso(productos: ProductoInflacion[]): ProductoInflacion[] {
  const clave = (p: ProductoInflacion) =>
    p.variacionReal === null ? Number.POSITIVE_INFINITY : Number(p.variacionReal);
  return [...productos].sort(
    (a, b) => clave(a) - clave(b) || a.producto.nombre.localeCompare(b.producto.nombre, 'es'),
  );
}

// --- Historial de precios de venta --------------------------------------------------------

export const ORIGENES_PRECIO_VENTA = ['ALTA', 'EDICION', 'IMPORT', 'INICIAL'] as const;
export const OrigenPrecioVentaSchema = z.enum(ORIGENES_PRECIO_VENTA);
export type OrigenPrecioVenta = z.infer<typeof OrigenPrecioVentaSchema>;

export const ETIQUETA_ORIGEN_PRECIO_VENTA: Record<OrigenPrecioVenta, string> = {
  ALTA: 'Alta del producto',
  EDICION: 'Edición',
  IMPORT: 'Importación',
  INICIAL: 'Reconstruido de las ventas',
};

export const PrecioHistorialSchema = z.object({
  id: z.uuid(),
  precioVenta: z.string(),
  alicuotaIva: z.string(),
  vigenteDesde: z.string(),
  origen: OrigenPrecioVentaSchema,
  usuario: z.object({ id: z.uuid(), nombre: z.string().nullable() }).nullable(),
});
export type PrecioHistorial = z.infer<typeof PrecioHistorialSchema>;

export const ListaPrecioHistorialSchema = z.object({
  items: z.array(PrecioHistorialSchema),
  siguienteCursor: z.string().nullable(),
});
export type ListaPrecioHistorial = z.infer<typeof ListaPrecioHistorialSchema>;
