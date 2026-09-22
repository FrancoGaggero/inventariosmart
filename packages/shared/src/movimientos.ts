import { z } from 'zod';
import { EstadoStockSchema, listaPaginadaSchema } from './productos';

// ---------------------------------------------------------------------------
// Movimientos de stock — HU-10 (RF-13, RN-07)
// ---------------------------------------------------------------------------

/** Tipos de movimiento (Propuesta v2.0, HU-10 criterio 1). */
export const TIPOS_MOVIMIENTO = ['VENTA', 'INGRESO', 'AJUSTE'] as const;
export const TipoMovimientoSchema = z.enum(TIPOS_MOVIMIENTO);
export type TipoMovimiento = z.infer<typeof TipoMovimientoSchema>;

export const ETIQUETA_TIPO: Record<TipoMovimiento, string> = {
  VENTA: 'Venta',
  INGRESO: 'Ingreso',
  AJUSTE: 'Ajuste',
};

/**
 * Motivos. `STOCK_INICIAL` y `ANULACION` los pone el sistema; el resto los elige
 * la persona según el tipo (ver `MOTIVOS_POR_TIPO`).
 */
export const MOTIVOS_MOVIMIENTO = [
  'STOCK_INICIAL',
  'COMPRA',
  'DEVOLUCION',
  'INVENTARIO',
  'ROTURA',
  'VENCIMIENTO',
  'ROBO',
  'USO_INTERNO',
  'ANULACION',
  'OTRO',
] as const;
export const MotivoMovimientoSchema = z.enum(MOTIVOS_MOVIMIENTO);
export type MotivoMovimiento = z.infer<typeof MotivoMovimientoSchema>;

export const ETIQUETA_MOTIVO: Record<MotivoMovimiento, string> = {
  STOCK_INICIAL: 'Stock inicial',
  COMPRA: 'Compra a proveedor',
  DEVOLUCION: 'Devolución de cliente',
  INVENTARIO: 'Conteo de inventario',
  ROTURA: 'Rotura o daño',
  VENCIMIENTO: 'Vencimiento',
  ROBO: 'Robo o faltante',
  USO_INTERNO: 'Uso interno',
  ANULACION: 'Anulación',
  OTRO: 'Otro',
};

export const MOTIVOS_INGRESO = ['COMPRA', 'DEVOLUCION', 'OTRO'] as const;
export const MOTIVOS_AJUSTE = [
  'INVENTARIO',
  'ROTURA',
  'VENCIMIENTO',
  'ROBO',
  'USO_INTERNO',
  'OTRO',
] as const;

/** Motivos que puede elegir la persona para cada tipo (la VENTA no lleva motivo). */
export const MOTIVOS_POR_TIPO: Record<TipoMovimiento, readonly MotivoMovimiento[]> = {
  VENTA: [],
  INGRESO: MOTIVOS_INGRESO,
  AJUSTE: MOTIVOS_AJUSTE,
};

/** Efecto sobre el stock según el tipo: VENTA resta, INGRESO suma, AJUSTE lleva el signo. */
export function efectoStockDe(tipo: TipoMovimiento, cantidad: number): number {
  switch (tipo) {
    case 'VENTA':
      return -cantidad;
    case 'INGRESO':
      return cantidad;
    case 'AJUSTE':
      return cantidad;
  }
}

/** Tolerancia para "no futura": desfase razonable entre el reloj del cliente y el del servidor. */
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

const FechaMovimientoSchema = z.iso
  .datetime({ offset: true, message: 'La fecha debe estar en formato ISO 8601.' })
  .refine(
    (f) => {
      const t = new Date(f).getTime();
      // Si el formato ya falló, no sumar un segundo error sobre el mismo campo.
      return Number.isNaN(t) || t <= Date.now() + TOLERANCIA_FUTURO_MS;
    },
    { message: 'La fecha no puede ser futura.' },
  );

const ObservacionSchema = z
  .string()
  .trim()
  .max(200, 'La observación no puede superar los 200 caracteres.')
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const cantidadPositiva = z
  .number('La cantidad debe ser un número entero.')
  .int('La cantidad debe ser un número entero.')
  .positive('La cantidad debe ser mayor a 0.');

const cantidadConSigno = z
  .number('La cantidad debe ser un número entero.')
  .int('La cantidad debe ser un número entero.')
  .refine((n) => n !== 0, 'Indicá cuánto suma (positivo) o resta (negativo) el ajuste.');

const base = {
  productoId: z.uuid('Elegí un producto.'),
  fecha: FechaMovimientoSchema.optional(),
  observacion: ObservacionSchema,
};

/** Cuerpo de POST /api/v1/movements, discriminado por tipo (CP-10.1). */
export const MovimientoCreateSchema = z.discriminatedUnion(
  'tipo',
  [
    z.object({ tipo: z.literal('VENTA'), cantidad: cantidadPositiva, ...base }),
    z.object({
      tipo: z.literal('INGRESO'),
      cantidad: cantidadPositiva,
      motivo: z.enum(MOTIVOS_INGRESO, 'Elegí un motivo válido para un ingreso.').optional(),
      ...base,
    }),
    z.object({
      tipo: z.literal('AJUSTE'),
      cantidad: cantidadConSigno,
      motivo: z.enum(MOTIVOS_AJUSTE, 'Elegí el motivo del ajuste.'),
      ...base,
    }),
  ],
  { error: 'El tipo debe ser VENTA, INGRESO o AJUSTE.' },
);
export type MovimientoCreate = z.infer<typeof MovimientoCreateSchema>;

/** Cuerpo de POST /api/v1/movements/:id/anular. */
export const AnulacionSchema = z.object({ observacion: ObservacionSchema });
export type Anulacion = z.infer<typeof AnulacionSchema>;

/** Movimiento tal como lo devuelve la API. */
export const MovimientoSchema = z.object({
  id: z.uuid(),
  tipo: TipoMovimientoSchema,
  producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  usuario: z.object({ id: z.uuid(), nombre: z.string().nullable() }),
  /** Como se registró: positiva en VENTA e INGRESO; con signo en AJUSTE. */
  cantidad: z.number().int(),
  /** Delta aplicado al stock del producto. */
  efectoStock: z.number().int(),
  stockResultante: z.number().int(),
  /** Estado del producto con el stock resultante y su stock de seguridad actual. */
  estadoStock: EstadoStockSchema,
  /** Precio de venta vigente al momento de la VENTA (con IVA); null en otros tipos. */
  precioUnitario: z.string().nullable(),
  motivo: MotivoMovimientoSchema.nullable(),
  observacion: z.string().nullable(),
  /** Fecha del hecho (puede ser anterior a `creadoEn`). */
  fecha: z.string(),
  /** Id del movimiento que este AJUSTE anula. */
  corrigeAId: z.uuid().nullable(),
  /** Id del AJUSTE que anuló este movimiento. */
  anuladoPorId: z.uuid().nullable(),
  creadoEn: z.string(),
});
export type Movimiento = z.infer<typeof MovimientoSchema>;

export const ListaMovimientosSchema = listaPaginadaSchema(MovimientoSchema);
export type ListaMovimientos = z.infer<typeof ListaMovimientosSchema>;

const FechaFiltroSchema = z.iso.datetime({
  offset: true,
  message: 'La fecha debe estar en formato ISO 8601.',
});

/** Parámetros de GET /api/v1/movements (CP-10.5). */
export const MovimientosQuerySchema = z
  .object({
    productoId: z.uuid('El producto no es válido.').optional(),
    tipo: TipoMovimientoSchema.optional(),
    desde: FechaFiltroSchema.optional(),
    hasta: FechaFiltroSchema.optional(),
    cursor: z.string().max(400).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine((q) => !q.desde || !q.hasta || new Date(q.hasta) >= new Date(q.desde), {
    path: ['hasta'],
    message: 'La fecha "hasta" no puede ser anterior a "desde".',
  });
export type MovimientosQuery = z.infer<typeof MovimientosQuerySchema>;

/** Un movimiento se puede anular si no fue anulado y no es a su vez una anulación. */
export function esAnulable(m: Pick<Movimiento, 'anuladoPorId' | 'corrigeAId'>): boolean {
  return m.anuladoPorId === null && m.corrigeAId === null;
}
