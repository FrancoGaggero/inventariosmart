import { z } from 'zod';
import { MotivoResumenSchema } from './gastos';
import { margenBruto, porcentaje, redondear2 } from './rentabilidad';
import type { Mes } from './gastos';

// ---------------------------------------------------------------------------
// Reportes semanales de rentabilidad — HU-09 (RF-09; RN-01, RN-02, RN-08)
// ---------------------------------------------------------------------------

/** Margen bruto (% del precio neto) por debajo del cual un producto vendido es "margen bajo". */
export const UMBRAL_MARGEN_BAJO_PCT = 15;
export const MAX_ESTRELLAS = 5;
export const MAX_OPORTUNIDADES = 5;
export const MAX_DESTINATARIOS_EXTRA = 5;
/** Ventana de ventas para "comprar más barato" y "capital inmovilizado". */
export const VENTANA_ROTACION_DIAS = 30;

/** Argentina no tiene horario de verano: el desfase con UTC es fijo (−03:00). */
const DESFASE_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Semana ISO 8601 (lunes a domingo) como `AAAA-Www`. */
export type Semana = `${number}-W${string}`;

const SEMANA_REGEX = /^(\d{4})-W(\d{2})$/;

/** Fecha vista con los campos UTC como si fueran hora de Buenos Aires. */
function aBuenosAires(fecha: Date): Date {
  return new Date(fecha.getTime() - DESFASE_MS);
}

/** Lunes 00:00 UTC (en el calendario desplazado) de la semana 1 de un año ISO. */
function lunesSemana1(anio: number): number {
  const cuatroEnero = Date.UTC(anio, 0, 4);
  const dia = new Date(cuatroEnero).getUTCDay() || 7;
  return cuatroEnero - (dia - 1) * DIA_MS;
}

/** Cantidad de semanas ISO del año (52 o 53). */
export function semanasDelAnio(anio: number): number {
  return Number(semanaDe(new Date(Date.UTC(anio, 11, 28) + DESFASE_MS)).slice(6));
}

/** Semana ISO a la que pertenece un instante, en hora de Buenos Aires. */
export function semanaDe(fecha: Date): Semana {
  const d = aBuenosAires(fecha);
  const dia = d.getUTCDay() || 7;
  const jueves = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - dia);
  const anio = new Date(jueves).getUTCFullYear();
  const numero = Math.round((jueves - lunesSemana1(anio)) / (7 * DIA_MS)) + 1;
  return `${anio}-W${String(numero).padStart(2, '0')}`;
}

/** Instantes UTC del lunes 00:00 (inclusive) y del lunes siguiente 00:00 (exclusivo) en Buenos Aires. */
export function rangoSemana(semana: Semana): { desde: Date; hasta: Date } {
  const m = SEMANA_REGEX.exec(semana);
  if (!m) throw new Error(`Semana inválida: ${semana}`);
  const lunes = lunesSemana1(Number(m[1])) + (Number(m[2]) - 1) * 7 * DIA_MS;
  return { desde: new Date(lunes + DESFASE_MS), hasta: new Date(lunes + 7 * DIA_MS + DESFASE_MS) };
}

export function semanaAnterior(semana: Semana): Semana {
  return semanaDe(new Date(rangoSemana(semana).desde.getTime() - DIA_MS));
}

export function semanaSiguiente(semana: Semana): Semana {
  return semanaDe(rangoSemana(semana).hasta);
}

/** Última semana completa (la anterior a la que contiene `ahora`). */
export function ultimaSemanaCerrada(ahora: Date = new Date()): Semana {
  return semanaAnterior(semanaDe(ahora));
}

/** Mes (YYYY-MM, Buenos Aires) en que termina la semana: fija el gasto por unidad (RN-02). */
export function mesDeSemana(semana: Semana): Mes {
  const ultimoDia = aBuenosAires(new Date(rangoSemana(semana).hasta.getTime() - 1));
  return `${ultimoDia.getUTCFullYear()}-${String(ultimoDia.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Fechas civiles (YYYY-MM-DD, Buenos Aires) del lunes y del domingo de la semana. */
export function diasDeSemana(semana: Semana): { lunes: string; domingo: string } {
  const { desde, hasta } = rangoSemana(semana);
  const f = (d: Date) => aBuenosAires(d).toISOString().slice(0, 10);
  return { lunes: f(desde), domingo: f(new Date(hasta.getTime() - 1)) };
}

export const SemanaSchema = z
  .string()
  .regex(SEMANA_REGEX, 'La semana debe tener el formato AAAA-Www (por ejemplo 2026-W38).')
  .refine(
    (s) => {
      const m = SEMANA_REGEX.exec(s);
      if (!m) return false;
      const n = Number(m[2]);
      return n >= 1 && n <= semanasDelAnio(Number(m[1]));
    },
    { message: 'Esa semana no existe en ese año.' },
  )
  .transform((s) => s as Semana);

// --- Oportunidades de ahorro (funciones puras, RN-01 y RN-08) ---------------------

export interface ProductoRef {
  id: string;
  codigo: string;
  nombre: string;
}

/** Fila por producto activo con lo que las tres reglas necesitan (design D3). */
export interface FilaOportunidad {
  producto: ProductoRef;
  /** Costo de reposición vigente, neto. */
  costoActual: string;
  proveedorActual: { id: string; nombre: string } | null;
  /** Menor costo vigente cargado por otro proveedor activo, o null. */
  costoMinimoOtro: string | null;
  proveedorMinimo: { id: string; nombre: string } | null;
  unidades30d: number;
  stock: number;
  unidadesSemana: number;
  ventasNetasSemana: string;
  precioNeto: string;
}

export const OportunidadCompraSchema = z.object({
  producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  proveedorActual: z.string().nullable(),
  proveedorSugerido: z.string(),
  proveedorSugeridoId: z.uuid(),
  costoActual: z.string(),
  costoSugerido: z.string(),
  unidades30d: z.number().int(),
  ahorroEstimado: z.string(),
});
export type OportunidadCompra = z.infer<typeof OportunidadCompraSchema>;

export const CapitalInmovilizadoSchema = z.object({
  producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  stock: z.number().int(),
  costoActual: z.string(),
  monto: z.string(),
});
export type CapitalInmovilizado = z.infer<typeof CapitalInmovilizadoSchema>;

export const MargenBajoSchema = z.object({
  producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  precioNeto: z.string(),
  costoActual: z.string(),
  margenBrutoPct: z.string(),
  unidadesSemana: z.number().int(),
  monto: z.string(),
});
export type MargenBajo = z.infer<typeof MargenBajoSchema>;

function lista<T extends { monto?: string; ahorroEstimado?: string }>(
  items: T[],
  monto: (i: T) => string,
): { items: T[]; total: string } {
  const orden = [...items].sort((a, b) => Number(monto(b)) - Number(monto(a)));
  // El total suma todo lo detectado, aunque la lista muestre sólo las primeras.
  const total = redondear2(orden.reduce((acc, i) => acc + Number(monto(i)), 0));
  return { items: orden.slice(0, MAX_OPORTUNIDADES), total };
}

/** Productos que se compran más caro que el menor costo cargado por otro proveedor (RN-08). */
export function oportunidadesCompra(filas: FilaOportunidad[]): {
  items: OportunidadCompra[];
  total: string;
} {
  const items: OportunidadCompra[] = [];
  for (const f of filas) {
    if (f.costoMinimoOtro === null || !f.proveedorMinimo || f.unidades30d <= 0) continue;
    const diferencia = Number(f.costoActual) - Number(f.costoMinimoOtro);
    if (diferencia <= 0) continue;
    items.push({
      producto: f.producto,
      proveedorActual: f.proveedorActual?.nombre ?? null,
      proveedorSugerido: f.proveedorMinimo.nombre,
      proveedorSugeridoId: f.proveedorMinimo.id,
      costoActual: redondear2(Number(f.costoActual)),
      costoSugerido: redondear2(Number(f.costoMinimoOtro)),
      unidades30d: f.unidades30d,
      ahorroEstimado: redondear2(diferencia * f.unidades30d),
    });
  }
  return lista(items, (i) => i.ahorroEstimado);
}

/** Productos con stock y sin ventas en 30 días: plata parada en el depósito. */
export function capitalInmovilizado(filas: FilaOportunidad[]): {
  items: CapitalInmovilizado[];
  total: string;
} {
  const items: CapitalInmovilizado[] = filas
    .filter((f) => f.stock > 0 && f.unidades30d === 0)
    .map((f) => ({
      producto: f.producto,
      stock: f.stock,
      costoActual: redondear2(Number(f.costoActual)),
      monto: redondear2(f.stock * Number(f.costoActual)),
    }));
  return lista(items, (i) => i.monto);
}

/** Productos vendidos en la semana con margen bruto por debajo del umbral (RN-01). */
export function margenBajo(filas: FilaOportunidad[]): { items: MargenBajo[]; total: string } {
  const items: MargenBajo[] = [];
  for (const f of filas) {
    if (f.unidadesSemana <= 0) continue;
    const pct = porcentaje(margenBruto(f.precioNeto, f.costoActual), f.precioNeto);
    if (pct === null || Number(pct) >= UMBRAL_MARGEN_BAJO_PCT) continue;
    items.push({
      producto: f.producto,
      precioNeto: redondear2(Number(f.precioNeto)),
      costoActual: redondear2(Number(f.costoActual)),
      margenBrutoPct: pct,
      unidadesSemana: f.unidadesSemana,
      monto: redondear2(Number(f.ventasNetasSemana)),
    });
  }
  return lista(items, (i) => i.monto);
}

// --- Esquemas del reporte -----------------------------------------------------------

export const EstrellaSchema = z.object({
  producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  unidadesVendidas: z.number().int(),
  margenBruto: z.string(),
  margenBrutoPct: z.string().nullable(),
  /** margenBruto × unidades de la semana. */
  margenBrutoSemana: z.string(),
});
export type Estrella = z.infer<typeof EstrellaSchema>;

export const ResumenSemanaSchema = z.object({
  unidadesVendidas: z.number().int(),
  ventasNetas: z.string(),
  costoVendido: z.string(),
  margenBruto: z.string(),
  margenBrutoPct: z.string().nullable(),
  /** Gasto operativo por unidad del mes en que termina la semana (RN-02). */
  gastoPorUnidad: z.string().nullable(),
  gastos: z.string(),
  margenNeto: z.string().nullable(),
  margenNetoPct: z.string().nullable(),
  motivo: MotivoResumenSchema.nullable(),
});
export type ResumenSemana = z.infer<typeof ResumenSemanaSchema>;

export const AlertaCriticaReporteSchema = z.object({
  producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  stock: z.number().int(),
  diasCobertura: z.number().int().nullable(),
  cantidadSugerida: z.number().int(),
});

export const ContenidoReporteSchema = z.object({
  semana: z.string(),
  desde: z.string(),
  hasta: z.string(),
  /** Mes cuyo gasto por unidad se usó (RN-02). */
  mesGastos: z.string(),
  resumen: ResumenSemanaSchema,
  semanaAnterior: z.object({
    semana: z.string(),
    ventasNetas: z.string(),
    unidadesVendidas: z.number().int(),
    variacionVentasPct: z.string().nullable(),
  }),
  estrellas: z.array(EstrellaSchema),
  oportunidades: z.object({
    comprarMasBarato: z.object({ items: z.array(OportunidadCompraSchema), total: z.string() }),
    capitalInmovilizado: z.object({ items: z.array(CapitalInmovilizadoSchema), total: z.string() }),
    margenBajo: z.object({ items: z.array(MargenBajoSchema), total: z.string() }),
  }),
  alertasCriticas: z.array(AlertaCriticaReporteSchema),
  generadoEn: z.string(),
});
export type ContenidoReporte = z.infer<typeof ContenidoReporteSchema>;

export const MOTIVOS_NO_ENVIO_REPORTE = [
  'SIN_PROVEEDOR',
  'ENVIO_FALLIDO',
  'SIN_DESTINATARIOS',
] as const;
export const MotivoNoEnvioReporteSchema = z.enum(MOTIVOS_NO_ENVIO_REPORTE);
export type MotivoNoEnvioReporte = z.infer<typeof MotivoNoEnvioReporteSchema>;

export const ETIQUETA_MOTIVO_NO_ENVIO_REPORTE: Record<MotivoNoEnvioReporte, string> = {
  SIN_PROVEEDOR: 'No hay proveedor de correo configurado: el reporte quedó sólo en la web.',
  ENVIO_FALLIDO: 'El correo no pudo enviarse; podés reenviarlo desde el detalle.',
  SIN_DESTINATARIOS: 'No hay destinatarios: no hay dueños activos ni correos extra.',
};

export const ReporteSemanalSchema = z.object({
  id: z.uuid(),
  semana: z.string(),
  desde: z.string(),
  hasta: z.string(),
  contenido: ContenidoReporteSchema,
  destinatarios: z.array(z.string()),
  enviadoEn: z.string().nullable(),
  motivoNoEnvio: MotivoNoEnvioReporteSchema.nullable(),
  generadoEn: z.string(),
});
export type ReporteSemanal = z.infer<typeof ReporteSemanalSchema>;

/** Fila del listado. */
export const ReporteResumenSchema = z.object({
  id: z.uuid(),
  semana: z.string(),
  desde: z.string(),
  hasta: z.string(),
  unidadesVendidas: z.number().int(),
  ventasNetas: z.string(),
  margenBruto: z.string(),
  margenBrutoPct: z.string().nullable(),
  variacionVentasPct: z.string().nullable(),
  /** Cantidad de productos con alguna oportunidad de ahorro. */
  oportunidades: z.number().int(),
  enviadoEn: z.string().nullable(),
  motivoNoEnvio: MotivoNoEnvioReporteSchema.nullable(),
  generadoEn: z.string(),
});
export type ReporteResumen = z.infer<typeof ReporteResumenSchema>;

export const ListaReportesSchema = z.object({
  items: z.array(ReporteResumenSchema),
  siguienteCursor: z.string().nullable(),
});
export type ListaReportes = z.infer<typeof ListaReportesSchema>;

export const ReportesQuerySchema = z.object({
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(52).default(12),
});
export type ReportesQuery = z.infer<typeof ReportesQuerySchema>;

/** Cuerpo de POST /api/v1/reports/weekly/generate. */
export const GenerarReporteSchema = z.object({
  /** Default: la semana en curso. */
  semana: SemanaSchema.optional(),
  /** true: envía el correo aunque ya se haya enviado. */
  enviar: z.boolean().default(false),
});
export type GenerarReporte = z.infer<typeof GenerarReporteSchema>;

// Los errores se informan a nivel de la lista (details.destinatariosExtra), no por posición.
const DestinatariosSchema = z
  .array(z.string().trim())
  .max(MAX_DESTINATARIOS_EXTRA, `Hasta ${MAX_DESTINATARIOS_EXTRA} destinatarios extra.`)
  .refine(
    (v) => v.every((e) => z.email().safeParse(e).success),
    'Alguno de los correos no es válido.',
  )
  .refine(
    (v) => new Set(v.map((e) => e.toLowerCase())).size === v.length,
    'Hay correos repetidos.',
  );

export const AjustesReportesSchema = z.object({
  activo: z.boolean(),
  destinatariosExtra: z.array(z.string()),
});
export type AjustesReportes = z.infer<typeof AjustesReportesSchema>;

export const AjustesReportesPatchSchema = z
  .object({
    activo: z.boolean().optional(),
    destinatariosExtra: DestinatariosSchema.optional(),
  })
  .refine((v) => v.activo !== undefined || v.destinatariosExtra !== undefined, {
    message: 'No hay nada para cambiar.',
  });
export type AjustesReportesPatch = z.infer<typeof AjustesReportesPatchSchema>;
