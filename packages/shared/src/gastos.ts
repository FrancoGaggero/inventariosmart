import { z } from 'zod';
import { MontoSchema } from './productos';

// ---------------------------------------------------------------------------
// Gastos operativos — HU-13 (RF-14, RN-02, RN-03)
// ---------------------------------------------------------------------------

export const TIPOS_GASTO = ['FIJO', 'VARIABLE'] as const;
export const TipoGastoSchema = z.enum(TIPOS_GASTO);
export type TipoGasto = z.infer<typeof TipoGastoSchema>;

export const ETIQUETA_TIPO_GASTO: Record<TipoGasto, string> = {
  FIJO: 'Fijo',
  VARIABLE: 'Variable',
};

export const PERIODICIDADES = ['UNICO', 'MENSUAL', 'ANUAL'] as const;
export const PeriodicidadSchema = z.enum(PERIODICIDADES);
export type Periodicidad = z.infer<typeof PeriodicidadSchema>;

export const ETIQUETA_PERIODICIDAD: Record<Periodicidad, string> = {
  UNICO: 'Único',
  MENSUAL: 'Mensual',
  ANUAL: 'Anual',
};

/** Mes en formato YYYY-MM. */
export const MesSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Indicá el mes en formato AAAA-MM.');
export type Mes = z.infer<typeof MesSchema>;

/** Mes actual en la zona horaria del navegador o del servidor. */
export function mesActual(ahora: Date = new Date()): Mes {
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-09" + 3 → "2026-12"; admite negativos. */
export function sumarMeses(mes: Mes, cantidad: number): Mes {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const total = a * 12 + (m - 1) + cantidad;
  const anio = Math.floor(total / 12);
  const mesNuevo = (total % 12) + 1;
  return `${anio}-${String(mesNuevo).padStart(2, '0')}`;
}

/** Diferencia en meses entre dos meses (b - a). */
export function mesesEntre(a: Mes, b: Mes): number {
  const [aa, am] = a.split('-').map(Number) as [number, number];
  const [ba, bm] = b.split('-').map(Number) as [number, number];
  return (ba - aa) * 12 + (bm - am);
}

/** Datos mínimos de un gasto para decidir si aplica a un mes (D2). */
export interface GastoAplicable {
  periodo: Mes;
  periodicidad: Periodicidad;
  fin: Mes | null;
  importe: string;
}

/**
 * Un gasto aplica a un mes si: UNICO y es su mes; MENSUAL y el mes está entre período y fin;
 * ANUAL y el mes está dentro de sus doce meses (y del fin, si lo tiene).
 */
export function aplicaAlMes(g: GastoAplicable, mes: Mes): boolean {
  if (g.periodo > mes) return false;
  if (g.fin !== null && g.fin < mes) return false;
  switch (g.periodicidad) {
    case 'UNICO':
      return g.periodo === mes;
    case 'MENSUAL':
      return true;
    case 'ANUAL':
      return mesesEntre(g.periodo, mes) < 12;
  }
}

/** Importe que un gasto aporta a un mes: completo, o un doceavo si es ANUAL. */
export function importeDelMes(g: GastoAplicable): string {
  const importe = Number(g.importe);
  return (g.periodicidad === 'ANUAL' ? importe / 12 : importe).toFixed(2);
}

const ConceptoSchema = z
  .string()
  .trim()
  .min(2, 'El concepto debe tener al menos 2 caracteres.')
  .max(120, 'El concepto no puede superar los 120 caracteres.');

const ImporteSchema = MontoSchema.refine((v) => Number(v) > 0, 'El importe debe ser mayor a 0.');

const NotasSchema = z
  .string()
  .trim()
  .max(300, 'Las notas no pueden superar los 300 caracteres.')
  .transform((v) => (v === '' ? null : v))
  .nullable();

/** Gasto tal como lo devuelve la API. */
export const GastoSchema = z.object({
  id: z.uuid(),
  concepto: z.string(),
  tipo: TipoGastoSchema,
  /** Importe neto sin IVA (RN-03), decimal como string. */
  importe: z.string(),
  /** Mes de inicio (YYYY-MM). */
  periodo: MesSchema,
  periodicidad: PeriodicidadSchema,
  /** Último mes en que aplica (sólo recurrentes), o null. */
  fin: MesSchema.nullable(),
  notas: z.string().nullable(),
  usuario: z.object({ id: z.uuid(), nombre: z.string().nullable() }),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});
export type Gasto = z.infer<typeof GastoSchema>;

/** Gasto dentro del listado de un mes, con lo que aporta a ese mes. */
export const GastoDelMesSchema = GastoSchema.extend({ importeMes: z.string() });
export type GastoDelMes = z.infer<typeof GastoDelMesSchema>;

export const TotalesGastosSchema = z.object({
  fijos: z.string(),
  variables: z.string(),
  total: z.string(),
});
export type TotalesGastos = z.infer<typeof TotalesGastosSchema>;

export const ListaGastosMesSchema = z.object({
  periodo: MesSchema,
  items: z.array(GastoDelMesSchema),
  totales: TotalesGastosSchema,
});
export type ListaGastosMes = z.infer<typeof ListaGastosMesSchema>;

const coherenciaFin = (
  v: { periodicidad?: Periodicidad; periodo?: Mes; fin?: Mes | null },
  ctx: z.RefinementCtx,
) => {
  if (v.fin === null || v.fin === undefined) return;
  if (v.periodicidad === 'UNICO') {
    ctx.addIssue({ code: 'custom', path: ['fin'], message: 'Un gasto único no lleva fin.' });
  } else if (v.periodo !== undefined && v.fin < v.periodo) {
    ctx.addIssue({
      code: 'custom',
      path: ['fin'],
      message: 'El fin no puede ser anterior al mes de inicio.',
    });
  }
};

/** Cuerpo de POST /api/v1/expenses. */
export const GastoCreateSchema = z
  .object({
    concepto: ConceptoSchema,
    tipo: TipoGastoSchema,
    importe: ImporteSchema,
    periodo: MesSchema,
    periodicidad: PeriodicidadSchema,
    fin: MesSchema.nullable().optional(),
    notas: NotasSchema.optional(),
  })
  .superRefine(coherenciaFin);
export type GastoCreate = z.infer<typeof GastoCreateSchema>;

/**
 * Cuerpo de PATCH /api/v1/expenses/:id. La coherencia entre período, fin y periodicidad
 * se revalida en la API con los valores resultantes (`validarCoherencia`).
 */
export const GastoPatchSchema = z
  .object({
    concepto: ConceptoSchema.optional(),
    tipo: TipoGastoSchema.optional(),
    importe: ImporteSchema.optional(),
    periodo: MesSchema.optional(),
    periodicidad: PeriodicidadSchema.optional(),
    fin: MesSchema.nullable().optional(),
    notas: NotasSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'No hay nada para actualizar.',
  });
export type GastoPatch = z.infer<typeof GastoPatchSchema>;

/** Valida período, fin y periodicidad ya combinados; devuelve el mensaje de error o null. */
export function validarCoherencia(g: {
  periodicidad: Periodicidad;
  periodo: Mes;
  fin: Mes | null;
}): string | null {
  if (g.fin === null) return null;
  if (g.periodicidad === 'UNICO') return 'Un gasto único no lleva fin.';
  if (g.fin < g.periodo) return 'El fin no puede ser anterior al mes de inicio.';
  return null;
}

/** Parámetros de GET /api/v1/expenses y /expenses/summary. */
export const GastosQuerySchema = z.object({
  periodo: MesSchema.optional(),
  tipo: TipoGastoSchema.optional(),
});
export type GastosQuery = z.infer<typeof GastosQuerySchema>;

export const MOTIVOS_RESUMEN = ['SIN_GASTOS', 'SIN_VENTAS'] as const;
export const MotivoResumenSchema = z.enum(MOTIVOS_RESUMEN);
export type MotivoResumen = z.infer<typeof MotivoResumenSchema>;

export const ETIQUETA_MOTIVO_RESUMEN: Record<MotivoResumen, string> = {
  SIN_GASTOS: 'No se puede calcular el gasto por unidad: cargá los gastos del mes.',
  SIN_VENTAS: 'No se puede calcular el gasto por unidad: no hubo ventas en el mes.',
};

/** Respuesta de GET /api/v1/expenses/summary (RN-02). */
export const ResumenGastosSchema = z.object({
  periodo: MesSchema,
  totalFijos: z.string(),
  totalVariables: z.string(),
  total: z.string(),
  /** Ventas no anuladas con fecha en el mes. */
  unidadesVendidas: z.number().int(),
  /** total / unidadesVendidas, o null con motivo. */
  gastoPorUnidad: z.string().nullable(),
  motivo: MotivoResumenSchema.nullable(),
});
export type ResumenGastos = z.infer<typeof ResumenGastosSchema>;

/** Totales de un mes a partir de los gastos aplicables. */
export function totalizar(items: { tipo: TipoGasto; importeMes: string }[]): TotalesGastos {
  const suma = (tipo: TipoGasto) =>
    items.filter((i) => i.tipo === tipo).reduce((acc, i) => acc + Number(i.importeMes), 0);
  const fijos = suma('FIJO');
  const variables = suma('VARIABLE');
  return {
    fijos: fijos.toFixed(2),
    variables: variables.toFixed(2),
    total: (fijos + variables).toFixed(2),
  };
}

/** Gasto por unidad o null con motivo (D4). */
export function prorratear(
  total: string,
  unidadesVendidas: number,
): Pick<ResumenGastos, 'gastoPorUnidad' | 'motivo'> {
  if (Number(total) <= 0) return { gastoPorUnidad: null, motivo: 'SIN_GASTOS' };
  if (unidadesVendidas <= 0) return { gastoPorUnidad: null, motivo: 'SIN_VENTAS' };
  return { gastoPorUnidad: (Number(total) / unidadesVendidas).toFixed(2), motivo: null };
}
