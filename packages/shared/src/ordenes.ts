import { z } from 'zod';
import { SeveridadAlertaSchema } from './alertas';
import { listaPaginadaSchema } from './productos';

// ---------------------------------------------------------------------------
// Órdenes de compra en modo copiloto — HU-07 (RF-07, RN-06)
// ---------------------------------------------------------------------------

export const ESTADOS_ORDEN = ['BORRADOR', 'CONFIRMADA', 'ENVIADA', 'CANCELADA'] as const;
export const EstadoOrdenSchema = z.enum(ESTADOS_ORDEN);
export type EstadoOrden = z.infer<typeof EstadoOrdenSchema>;

export const ETIQUETA_ESTADO_ORDEN: Record<EstadoOrden, string> = {
  BORRADOR: 'Borrador',
  CONFIRMADA: 'Confirmada',
  ENVIADA: 'Enviada',
  CANCELADA: 'Cancelada',
};

/** Por qué una orden confirmada no salió por correo. */
export const MOTIVOS_NO_ENVIO = ['SIN_EMAIL', 'ENVIO_FALLIDO'] as const;
export const MotivoNoEnvioSchema = z.enum(MOTIVOS_NO_ENVIO);
export type MotivoNoEnvio = z.infer<typeof MotivoNoEnvioSchema>;

export const ETIQUETA_MOTIVO_NO_ENVIO: Record<MotivoNoEnvio, string> = {
  SIN_EMAIL: 'El proveedor no tiene email cargado: envíala por otro medio.',
  ENVIO_FALLIDO: 'El correo no pudo enviarse: copiá el texto y envialo por otro medio.',
};

/** Por qué se eligió ese proveedor para un producto (HU-07 criterio 1). */
export const MOTIVOS_ELECCION = [
  'MENOR_COSTO',
  'MENOR_LEAD_TIME',
  'MAYOR_CONFIABILIDAD',
  'PROVEEDOR_PRINCIPAL',
] as const;
export const MotivoEleccionSchema = z.enum(MOTIVOS_ELECCION);
export type MotivoEleccion = z.infer<typeof MotivoEleccionSchema>;

export const ETIQUETA_MOTIVO_ELECCION: Record<MotivoEleccion, string> = {
  MENOR_COSTO: 'menor costo',
  MENOR_LEAD_TIME: 'mismo costo, entrega más rápida',
  MAYOR_CONFIABILIDAD: 'mismo costo y plazo, más confiable',
  PROVEEDOR_PRINCIPAL: 'proveedor principal, sin precios cargados',
};

/** Número correlativo por comercio con formato OC-0001. */
export function formatearNumeroOrden(numero: number): string {
  return `OC-${String(numero).padStart(4, '0')}`;
}

/** Un proveedor con precio vigente para el producto. */
export interface CandidatoProveedor {
  proveedorId: string;
  /** Costo neto vigente, como número. */
  costo: number;
  leadTimeDias: number;
  confiabilidad: number;
}

export interface EleccionProveedor {
  proveedorId: string;
  /** null cuando se eligió el principal sin precio cargado. */
  costo: number | null;
  motivo: MotivoEleccion;
}

/**
 * Proveedor más conveniente (HU-07 criterio 1): menor costo vigente; a igual costo, menor lead
 * time; a igual plazo, mayor confiabilidad; sin candidatos, el proveedor principal; sin nada, null.
 */
export function elegirProveedor(
  candidatos: CandidatoProveedor[],
  proveedorPrincipalId: string | null,
): EleccionProveedor | null {
  if (candidatos.length === 0) {
    return proveedorPrincipalId
      ? { proveedorId: proveedorPrincipalId, costo: null, motivo: 'PROVEEDOR_PRINCIPAL' }
      : null;
  }
  const orden = [...candidatos].sort(
    (a, b) =>
      a.costo - b.costo ||
      a.leadTimeDias - b.leadTimeDias ||
      b.confiabilidad - a.confiabilidad ||
      a.proveedorId.localeCompare(b.proveedorId),
  );
  const mejor = orden[0]!;
  const segundo = orden[1];
  let motivo: MotivoEleccion = 'MENOR_COSTO';
  if (segundo && segundo.costo === mejor.costo) {
    motivo =
      segundo.leadTimeDias === mejor.leadTimeDias ? 'MAYOR_CONFIABILIDAD' : 'MENOR_LEAD_TIME';
  }
  return { proveedorId: mejor.proveedorId, costo: mejor.costo, motivo };
}

/** Suma cantidad × costo de los ítems con costo conocido, con 2 decimales como string. */
export function totalOrden(
  items: { cantidad: number; costoUnitarioNeto: string | null }[],
): string {
  const centavos = items.reduce((acc, i) => {
    if (i.costoUnitarioNeto === null) return acc;
    return acc + Math.round(Number(i.costoUnitarioNeto) * 100) * i.cantidad;
  }, 0);
  return (centavos / 100).toFixed(2);
}

/** Subtotal de un ítem (cantidad × costo) o null sin costo. */
export function subtotalItem(cantidad: number, costoUnitarioNeto: string | null): string | null {
  if (costoUnitarioNeto === null) return null;
  return ((Math.round(Number(costoUnitarioNeto) * 100) * cantidad) / 100).toFixed(2);
}

// --- Sugerencia -------------------------------------------------------------

export const SEVERIDADES_SUGERENCIA = ['CRITICA', 'TODAS'] as const;
export const SugerenciaQuerySchema = z.object({
  severidad: z.enum(SEVERIDADES_SUGERENCIA).default('CRITICA'),
});
export type SugerenciaQuery = z.infer<typeof SugerenciaQuerySchema>;

export const ProductoOrdenSchema = z.object({
  id: z.uuid(),
  codigo: z.string(),
  nombre: z.string(),
  stockActual: z.number().int(),
});

export const ProveedorOrdenSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  contacto: z.string().nullable(),
  email: z.string().nullable(),
  leadTimeDias: z.number().int(),
  confiabilidad: z.number().int(),
});
export type ProveedorOrden = z.infer<typeof ProveedorOrdenSchema>;

export const ItemSugeridoSchema = z.object({
  producto: ProductoOrdenSchema,
  alertaId: z.uuid(),
  severidad: SeveridadAlertaSchema,
  diasCobertura: z.number().int().nullable(),
  cantidad: z.number().int(),
  costoUnitarioNeto: z.string().nullable(),
  subtotal: z.string().nullable(),
  motivoEleccion: MotivoEleccionSchema,
});
export type ItemSugerido = z.infer<typeof ItemSugeridoSchema>;

export const GrupoSugeridoSchema = z.object({
  proveedor: ProveedorOrdenSchema,
  items: z.array(ItemSugeridoSchema),
  totalNeto: z.string(),
});
export type GrupoSugerido = z.infer<typeof GrupoSugeridoSchema>;

export const ProductoSinProveedorSchema = z.object({
  producto: ProductoOrdenSchema,
  alertaId: z.uuid(),
  severidad: SeveridadAlertaSchema,
  cantidad: z.number().int(),
});

/** Respuesta de GET /api/v1/purchase-orders/suggest. Sólo lectura: no crea nada (RN-06). */
export const SugerenciaOrdenesSchema = z.object({
  severidad: z.enum(SEVERIDADES_SUGERENCIA),
  grupos: z.array(GrupoSugeridoSchema),
  sinProveedor: z.array(ProductoSinProveedorSchema),
  calculadasEn: z.string().nullable(),
});
export type SugerenciaOrdenes = z.infer<typeof SugerenciaOrdenesSchema>;

// --- Orden ----------------------------------------------------------------------

export const ItemOrdenSchema = z.object({
  id: z.uuid(),
  producto: ProductoOrdenSchema,
  alertaId: z.uuid().nullable(),
  cantidad: z.number().int(),
  /** Costo al momento de armar la orden; null si no había ninguno. */
  costoUnitarioNeto: z.string().nullable(),
  subtotal: z.string().nullable(),
});
export type ItemOrden = z.infer<typeof ItemOrdenSchema>;

const UsuarioOrdenSchema = z.object({ id: z.uuid(), nombre: z.string().nullable() });

export const OrdenCompraSchema = z.object({
  id: z.uuid(),
  numero: z.string(),
  estado: EstadoOrdenSchema,
  proveedor: ProveedorOrdenSchema,
  items: z.array(ItemOrdenSchema),
  totalNeto: z.string(),
  asunto: z.string(),
  texto: z.string(),
  textoEditado: z.boolean(),
  notas: z.string().nullable(),
  motivoNoEnvio: MotivoNoEnvioSchema.nullable(),
  creadaPor: UsuarioOrdenSchema,
  confirmadaPor: UsuarioOrdenSchema.nullable(),
  confirmadaEn: z.string().nullable(),
  enviadaEn: z.string().nullable(),
  enviadaA: z.string().nullable(),
  canceladaEn: z.string().nullable(),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});
export type OrdenCompra = z.infer<typeof OrdenCompraSchema>;

/** Fila del listado. */
export const OrdenResumenSchema = z.object({
  id: z.uuid(),
  numero: z.string(),
  estado: EstadoOrdenSchema,
  proveedor: z.object({ id: z.uuid(), nombre: z.string() }),
  cantidadItems: z.number().int(),
  totalNeto: z.string(),
  motivoNoEnvio: MotivoNoEnvioSchema.nullable(),
  confirmadaEn: z.string().nullable(),
  enviadaEn: z.string().nullable(),
  creadoEn: z.string(),
});
export type OrdenResumen = z.infer<typeof OrdenResumenSchema>;

export const ListaOrdenesSchema = listaPaginadaSchema(OrdenResumenSchema);
export type ListaOrdenes = z.infer<typeof ListaOrdenesSchema>;

export const OrdenesQuerySchema = z.object({
  estado: z.enum([...ESTADOS_ORDEN, 'TODAS']).default('TODAS'),
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type OrdenesQuery = z.infer<typeof OrdenesQuerySchema>;

const CantidadSchema = z
  .number('La cantidad debe ser un número entero.')
  .int('La cantidad debe ser un número entero.')
  .min(1, 'La cantidad debe ser al menos 1.')
  .max(1_000_000, 'La cantidad no puede superar 1.000.000.');

export const ItemOrdenCreateSchema = z.object({
  productoId: z.uuid('Elegí un producto.'),
  cantidad: CantidadSchema,
  alertaId: z.uuid().nullable().optional(),
});
export type ItemOrdenCreate = z.infer<typeof ItemOrdenCreateSchema>;

const ItemsSchema = z
  .array(ItemOrdenCreateSchema)
  .min(1, 'La orden necesita al menos un producto.')
  .max(200, 'Una orden no puede tener más de 200 productos.')
  .refine(
    (items) => new Set(items.map((i) => i.productoId)).size === items.length,
    'Hay productos repetidos en la orden.',
  );

const NotasSchema = z
  .string()
  .trim()
  .max(500, 'Las notas no pueden superar los 500 caracteres.')
  .transform((v) => (v === '' ? null : v))
  .nullable();

/** Cuerpo de POST /api/v1/purchase-orders. */
export const OrdenCreateSchema = z.object({
  proveedorId: z.uuid('Elegí un proveedor.'),
  items: ItemsSchema,
  notas: NotasSchema.optional(),
});
export type OrdenCreate = z.infer<typeof OrdenCreateSchema>;

/** Cuerpo de PATCH /api/v1/purchase-orders/:id (sólo en BORRADOR). `items` reemplaza la lista. */
export const OrdenPatchSchema = z
  .object({
    proveedorId: z.uuid('Elegí un proveedor.').optional(),
    items: ItemsSchema.optional(),
    notas: NotasSchema.optional(),
    asunto: z
      .string()
      .trim()
      .min(1, 'El asunto no puede estar vacío.')
      .max(200, 'El asunto no puede superar los 200 caracteres.')
      .optional(),
    texto: z
      .string()
      .trim()
      .min(1, 'El texto no puede estar vacío.')
      .max(10_000, 'El texto no puede superar los 10.000 caracteres.')
      .optional(),
    /** Descarta el texto editado y vuelve al generado. */
    regenerarTexto: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'No hay nada para cambiar.');
export type OrdenPatch = z.infer<typeof OrdenPatchSchema>;
