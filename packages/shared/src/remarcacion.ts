import { z } from 'zod';
import { variacionPct } from './dashboard';
import { MesSchema } from './gastos';
import { EstadoPrecioSchema, type EstadoPrecio } from './inflacion';
import { MontoSchema, listaPaginadaSchema } from './productos';
import { margenBruto, porcentaje, precioNeto, redondear2 } from './rentabilidad';

// ---------------------------------------------------------------------------
// Remarcación asistida — HU-17 (RF-18; RN-01, RN-03, RN-11, RN-12)
// ---------------------------------------------------------------------------

export const CRITERIOS_REMARCACION = [
  'INFLACION',
  'MARGEN',
  'PORCENTAJE',
  'MARGEN_OBJETIVO',
] as const;
export const CriterioRemarcacionSchema = z.enum(
  CRITERIOS_REMARCACION,
  'Elegí un criterio de remarcación.',
);
export type CriterioRemarcacion = z.infer<typeof CriterioRemarcacionSchema>;

export const ETIQUETA_CRITERIO: Record<CriterioRemarcacion, string> = {
  INFLACION: 'Alcanzar la inflación',
  MARGEN: 'Sostener el margen',
  PORCENTAJE: 'Porcentaje fijo',
  MARGEN_OBJETIVO: 'Margen objetivo',
};

export const REDONDEOS = ['NINGUNO', 'PESO', 'DECENA', 'CENTENA'] as const;
export const RedondeoSchema = z.enum(REDONDEOS, 'Elegí un redondeo válido.');
export type Redondeo = z.infer<typeof RedondeoSchema>;

export const ETIQUETA_REDONDEO: Record<Redondeo, string> = {
  NINGUNO: 'Sin redondeo',
  PESO: 'Al peso',
  DECENA: 'A la decena',
  CENTENA: 'A la centena',
};

export const RESULTADOS_REMARCACION = ['SUBE', 'BAJA', 'SIN_CAMBIO', 'SIN_DATOS'] as const;
export const ResultadoRemarcacionSchema = z.enum(RESULTADOS_REMARCACION);
export type ResultadoRemarcacion = z.infer<typeof ResultadoRemarcacionSchema>;

export const MAX_PRODUCTOS_LOTE = 5000;
export const PORCENTAJE_MAX = 500;
export const MARGEN_OBJETIVO_MAX = 95;

/** Centavos por múltiplo de cada redondeo. */
const MULTIPLO: Record<Redondeo, number> = { NINGUNO: 1, PESO: 100, DECENA: 1000, CENTENA: 10000 };

/**
 * Redondea un precio hacia arriba al múltiplo pedido. Primero lo lleva a centavos, así un
 * 2989,9999… que viene de multiplicar no sube a 3000 (CP-17.2b).
 */
export function redondearPrecio(precio: number, redondeo: Redondeo): string {
  const centavos = Math.round((precio + Number.EPSILON) * 100);
  const multiplo = MULTIPLO[redondeo];
  return ((Math.ceil(centavos / multiplo) * multiplo) / 100).toFixed(2);
}

/** Precio actual más un porcentaje. */
export function precioPorPorcentaje(precio: string | number, pct: number): number {
  return Number(precio) * (1 + pct / 100);
}

/**
 * Precio con IVA que deja el margen bruto pedido sobre el precio neto (RN-01, RN-03):
 * neto = costo ÷ (1 − margen ÷ 100). Sin costo cargado no se puede calcular.
 */
export function precioPorMargenObjetivo(
  costo: string | number,
  margenPct: number,
  alicuotaIva: string | number,
): number | null {
  const c = Number(costo);
  if (!(c > 0) || !(margenPct < 100)) return null;
  return (c / (1 - margenPct / 100)) * (1 + Number(alicuotaIva) / 100);
}

/** Margen bruto porcentual sobre el precio neto, o null si falta el precio o el costo. */
export function margenBrutoPct(
  precioConIva: string | number,
  costo: string | number,
  alicuotaIva: string | number,
): string | null {
  // Sin costo cargado el margen daría 100 %: no es un dato, es que falta el costo.
  if (!(Number(costo) > 0)) return null;
  const neto = precioNeto(precioConIva, alicuotaIva);
  return porcentaje(margenBruto(neto, costo), neto);
}

export interface CalculoItem {
  precioActual: string | number;
  /** Costo de reposición vigente, neto. */
  costo: string | number;
  alicuotaIva: string | number;
  /** Precio que pide el criterio, sin redondear; null si no se puede calcular. */
  precioCalculado: number | null;
  redondeo: Redondeo;
  permitirBajas: boolean;
}

export interface ItemCalculado {
  precioNuevo: string | null;
  variacion: string | null;
  margenBrutoPctActual: string | null;
  margenBrutoPctNuevo: string | null;
  resultado: ResultadoRemarcacion;
}

/** Precio nuevo de un producto con su resultado (RN-12: no baja salvo que se pida). */
export function calcularItem(c: CalculoItem): ItemCalculado {
  const actual = redondear2(Number(c.precioActual));
  const margenBrutoPctActual = margenBrutoPct(actual, c.costo, c.alicuotaIva);
  if (c.precioCalculado === null || !(c.precioCalculado > 0)) {
    return {
      precioNuevo: null,
      variacion: null,
      margenBrutoPctActual,
      margenBrutoPctNuevo: null,
      resultado: 'SIN_DATOS',
    };
  }
  const calculado = redondearPrecio(c.precioCalculado, c.redondeo);
  const sube = Number(calculado) > Number(actual);
  const baja = Number(calculado) < Number(actual) && c.permitirBajas;
  const precioNuevo = sube || baja ? calculado : actual;
  return {
    precioNuevo,
    variacion: variacionPct(precioNuevo, actual) ?? '0.00',
    margenBrutoPctActual,
    margenBrutoPctNuevo: margenBrutoPct(precioNuevo, c.costo, c.alicuotaIva),
    resultado: sube ? 'SUBE' : baja ? 'BAJA' : 'SIN_CAMBIO',
  };
}

export const ResumenRemarcacionSchema = z.object({
  suben: z.number().int(),
  bajan: z.number().int(),
  sinCambio: z.number().int(),
  sinDatos: z.number().int(),
});
export type ResumenRemarcacion = z.infer<typeof ResumenRemarcacionSchema>;

export function resumirRemarcacion(
  items: { resultado: ResultadoRemarcacion }[],
): ResumenRemarcacion {
  const contar = (r: ResultadoRemarcacion) => items.filter((i) => i.resultado === r).length;
  return {
    suben: contar('SUBE'),
    bajan: contar('BAJA'),
    sinCambio: contar('SIN_CAMBIO'),
    sinDatos: contar('SIN_DATOS'),
  };
}

// --- Vista previa -------------------------------------------------------------------------

const PorcentajeSchema = z
  .number('Indicá el porcentaje.')
  .gt(0, 'El porcentaje debe ser mayor a 0.')
  .max(PORCENTAJE_MAX, `El porcentaje no puede superar ${PORCENTAJE_MAX}.`);

const MargenSchema = z
  .number('Indicá el margen objetivo.')
  .gt(0, 'El margen debe ser mayor a 0.')
  .max(MARGEN_OBJETIVO_MAX, `El margen no puede superar ${MARGEN_OBJETIVO_MAX} %.`);

const comunes = {
  /** Productos a remarcar; sin indicarlos, todos los activos. */
  productoIds: z
    .array(z.uuid('Producto inválido.'))
    .min(1, 'Elegí al menos un producto.')
    .max(MAX_PRODUCTOS_LOTE, `Hasta ${MAX_PRODUCTOS_LOTE} productos por remarcación.`)
    .optional(),
  /** Sólo los productos con ese estado frente a la inflación del período (HU-15). */
  estado: EstadoPrecioSchema.optional(),
  /** Período de la comparación con la inflación; por defecto, el de HU-15. */
  desde: MesSchema.optional(),
  hasta: MesSchema.optional(),
  redondeo: RedondeoSchema.default('NINGUNO'),
  permitirBajas: z.boolean().default(false),
};

/** Cuerpo de POST /api/v1/repricing/preview. */
export const RemarcacionPreviewSchema = z.discriminatedUnion(
  'criterio',
  [
    z.object({ criterio: z.literal('INFLACION'), ...comunes }),
    z.object({ criterio: z.literal('MARGEN'), ...comunes }),
    z.object({ criterio: z.literal('PORCENTAJE'), porcentaje: PorcentajeSchema, ...comunes }),
    z.object({ criterio: z.literal('MARGEN_OBJETIVO'), margen: MargenSchema, ...comunes }),
  ],
  'Elegí un criterio de remarcación.',
);
export type RemarcacionPreview = z.infer<typeof RemarcacionPreviewSchema>;

/** Parámetros con los que se calculó una remarcación; quedan guardados en el lote. */
export const ParametrosRemarcacionSchema = z.object({
  porcentaje: z.number().optional(),
  margen: z.number().optional(),
  redondeo: RedondeoSchema.optional(),
  permitirBajas: z.boolean().optional(),
  desde: MesSchema.optional(),
  hasta: MesSchema.optional(),
});
export type ParametrosRemarcacion = z.infer<typeof ParametrosRemarcacionSchema>;

const ProductoRefSchema = z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() });

export const ItemRemarcacionSchema = z.object({
  producto: ProductoRefSchema,
  /** Precios de venta con IVA, como se cargan. */
  precioActual: z.string(),
  precioNuevo: z.string().nullable(),
  variacion: z.string().nullable(),
  costo: z.string(),
  alicuotaIva: z.string(),
  margenBrutoPctActual: z.string().nullable(),
  margenBrutoPctNuevo: z.string().nullable(),
  resultado: ResultadoRemarcacionSchema,
  /** Estado frente a la inflación, si el pedido lo necesitó. */
  estado: EstadoPrecioSchema.nullable(),
});
export type ItemRemarcacion = z.infer<typeof ItemRemarcacionSchema>;

/** Respuesta de POST /api/v1/repricing/preview. Sólo lectura. */
export const VistaPreviaRemarcacionSchema = z.object({
  criterio: CriterioRemarcacionSchema,
  parametros: ParametrosRemarcacionSchema,
  items: z.array(ItemRemarcacionSchema),
  resumen: ResumenRemarcacionSchema,
  /** SIN_IPC: todavía no está el índice del INDEC para el criterio de inflación. */
  motivo: z.enum(['SIN_IPC']).nullable(),
});
export type VistaPreviaRemarcacion = z.infer<typeof VistaPreviaRemarcacionSchema>;

// --- Aplicación -----------------------------------------------------------------------------

const PrecioNuevoSchema = MontoSchema.refine(
  (v) => Number(v) > 0,
  'El precio nuevo debe ser mayor a 0.',
);

export const ItemAplicarSchema = z
  .object({
    productoId: z.uuid('Producto inválido.'),
    /** Precio que el dueño vio en la vista previa: si cambió, no se aplica nada. */
    precioActual: MontoSchema,
    precioNuevo: PrecioNuevoSchema,
  })
  .refine((v) => Number(v.precioNuevo) !== Number(v.precioActual), {
    path: ['precioNuevo'],
    message: 'El precio nuevo es igual al actual.',
  });
export type ItemAplicar = z.infer<typeof ItemAplicarSchema>;

/** Cuerpo de POST /api/v1/repricing/apply. */
export const RemarcacionApplySchema = z.object({
  criterio: CriterioRemarcacionSchema,
  parametros: ParametrosRemarcacionSchema.default({}),
  items: z
    .array(ItemAplicarSchema)
    .min(1, 'Elegí al menos un producto para remarcar.')
    .max(MAX_PRODUCTOS_LOTE, `Hasta ${MAX_PRODUCTOS_LOTE} productos por remarcación.`)
    .refine(
      (items) => new Set(items.map((i) => i.productoId)).size === items.length,
      'Hay productos repetidos.',
    ),
});
export type RemarcacionApply = z.infer<typeof RemarcacionApplySchema>;

// --- Lotes ----------------------------------------------------------------------------------

const UsuarioLoteSchema = z.object({ id: z.uuid(), nombre: z.string().nullable() });

export const LoteRemarcacionSchema = z.object({
  id: z.uuid(),
  criterio: CriterioRemarcacionSchema,
  parametros: ParametrosRemarcacionSchema,
  cantidad: z.number().int(),
  usuario: UsuarioLoteSchema,
  creadoEn: z.string(),
  revertidoEn: z.string().nullable(),
  revertidoPor: UsuarioLoteSchema.nullable(),
  /** Productos que volvieron al precio anterior y productos que no se tocaron, tras deshacer. */
  revertidos: z.number().int().nullable(),
  omitidos: z.number().int().nullable(),
});
export type LoteRemarcacion = z.infer<typeof LoteRemarcacionSchema>;

export const ItemLoteSchema = z.object({
  producto: ProductoRefSchema,
  precioAnterior: z.string(),
  precioNuevo: z.string(),
  revertido: z.boolean(),
});
export type ItemLote = z.infer<typeof ItemLoteSchema>;

export const LoteRemarcacionDetalleSchema = LoteRemarcacionSchema.extend({
  items: z.array(ItemLoteSchema),
});
export type LoteRemarcacionDetalle = z.infer<typeof LoteRemarcacionDetalleSchema>;

export const ListaLotesSchema = listaPaginadaSchema(LoteRemarcacionSchema);
export type ListaLotes = z.infer<typeof ListaLotesSchema>;

export const LotesQuerySchema = z.object({
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type LotesQuery = z.infer<typeof LotesQuerySchema>;

/** Respuesta de POST /api/v1/repricing/batches/:id/revert. */
export const ResultadoReversionSchema = LoteRemarcacionDetalleSchema.extend({
  /** Productos que no se tocaron porque su precio cambió después o están dados de baja. */
  productosOmitidos: z.array(
    z.object({ producto: ProductoRefSchema, precioActual: z.string(), motivo: z.string() }),
  ),
});
export type ResultadoReversion = z.infer<typeof ResultadoReversionSchema>;

/** Conflicto al aplicar: productos cuyo precio cambió desde la vista previa. */
export interface ProductoCambiado {
  productoId: string;
  codigo: string;
  nombre: string;
  precioActual: string;
}

export type { EstadoPrecio };
