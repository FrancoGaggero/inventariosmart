import { z } from 'zod';
import { CuitSchema } from './index';
import { MontoSchema, listaPaginadaSchema } from './productos';

// ---------------------------------------------------------------------------
// Proveedores y listas de precios — HU-02 (RF-03, RN-08, RN-04)
// ---------------------------------------------------------------------------

const NombreProveedorSchema = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres.')
  .max(120, 'El nombre no puede superar los 120 caracteres.');

const textoOpcional = (max: number, que: string) =>
  z
    .string()
    .trim()
    .max(max, `${que} no puede superar los ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v))
    .nullable();

const EmailProveedorSchema = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .refine((v) => v === null || z.email().safeParse(v).success, 'El email no es válido.');

const CuitOpcionalSchema = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .refine((v) => v === null || CuitSchema.safeParse(v).success, {
    message: 'El CUIT debe tener 11 dígitos, sin guiones.',
  });

export const LEAD_TIME_DEFAULT = 7;
export const CONFIABILIDAD_DEFAULT = 3;

const LeadTimeSchema = z
  .number('El plazo de entrega debe ser un número entero de días.')
  .int('El plazo de entrega debe ser un número entero de días.')
  .min(0, 'El plazo de entrega no puede ser negativo.')
  .max(365, 'El plazo de entrega no puede superar los 365 días.');

const ConfiabilidadSchema = z
  .number('La confiabilidad debe ser un número entero.')
  .int('La confiabilidad debe ser un número entero.')
  .min(1, 'La confiabilidad va de 1 a 5.')
  .max(5, 'La confiabilidad va de 1 a 5.');

/** Proveedor tal como lo devuelve la API. */
export const ProveedorSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  contacto: z.string().nullable(),
  email: z.string().nullable(),
  telefono: z.string().nullable(),
  cuit: z.string().nullable(),
  /** Plazo de entrega en días; alimenta el punto de reposición (RN-04). */
  leadTimeDias: z.number().int(),
  /** Índice de confiabilidad de 1 a 5; lo usa el comparador (HU-12). */
  confiabilidad: z.number().int(),
  notas: z.string().nullable(),
  activo: z.boolean(),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});
export type Proveedor = z.infer<typeof ProveedorSchema>;

export const ListaProveedoresSchema = listaPaginadaSchema(ProveedorSchema);
export type ListaProveedores = z.infer<typeof ListaProveedoresSchema>;

/** Cuerpo de POST /api/v1/suppliers. */
export const ProveedorCreateSchema = z.object({
  nombre: NombreProveedorSchema,
  contacto: textoOpcional(120, 'El contacto').optional(),
  email: EmailProveedorSchema.optional(),
  telefono: textoOpcional(40, 'El teléfono').optional(),
  cuit: CuitOpcionalSchema.optional(),
  leadTimeDias: LeadTimeSchema.default(LEAD_TIME_DEFAULT),
  confiabilidad: ConfiabilidadSchema.default(CONFIABILIDAD_DEFAULT),
  notas: textoOpcional(500, 'Las notas').optional(),
});
export type ProveedorCreate = z.infer<typeof ProveedorCreateSchema>;

/** Cuerpo de PATCH /api/v1/suppliers/:id. */
export const ProveedorPatchSchema = z
  .object({
    nombre: NombreProveedorSchema.optional(),
    contacto: textoOpcional(120, 'El contacto').optional(),
    email: EmailProveedorSchema.optional(),
    telefono: textoOpcional(40, 'El teléfono').optional(),
    cuit: CuitOpcionalSchema.optional(),
    leadTimeDias: LeadTimeSchema.optional(),
    confiabilidad: ConfiabilidadSchema.optional(),
    notas: textoOpcional(500, 'Las notas').optional(),
    activo: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'No hay nada para actualizar.',
  });
export type ProveedorPatch = z.infer<typeof ProveedorPatchSchema>;

/** Parámetros de GET /api/v1/suppliers. */
export const ProveedoresQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  activo: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ProveedoresQuery = z.infer<typeof ProveedoresQuerySchema>;

// --- Precios ---------------------------------------------------------------

export const ORIGENES_PRECIO = ['MANUAL', 'IMPORT'] as const;
export const OrigenPrecioSchema = z.enum(ORIGENES_PRECIO);
export type OrigenPrecio = z.infer<typeof OrigenPrecioSchema>;

export const ETIQUETA_ORIGEN: Record<OrigenPrecio, string> = {
  MANUAL: 'Carga manual',
  IMPORT: 'Lista importada',
};

/** Fila del historial de costos (sólo inserción, RN-08). */
export const PrecioProveedorSchema = z.object({
  id: z.uuid(),
  producto: z.object({ id: z.uuid(), codigo: z.string(), nombre: z.string() }),
  proveedor: z.object({ id: z.uuid(), nombre: z.string() }),
  /** Costo neto sin IVA, decimal como string. */
  costoNeto: z.string(),
  vigenteDesde: z.string(),
  origen: OrigenPrecioSchema,
  loteId: z.uuid().nullable(),
  usuario: z.object({ id: z.uuid(), nombre: z.string().nullable() }),
  creadoEn: z.string(),
});
export type PrecioProveedor = z.infer<typeof PrecioProveedorSchema>;

export const ListaPreciosSchema = listaPaginadaSchema(PrecioProveedorSchema);
export type ListaPrecios = z.infer<typeof ListaPreciosSchema>;

const FechaVigenciaSchema = z.iso
  .datetime({ offset: true, message: 'La fecha debe estar en formato ISO 8601.' })
  .refine(
    (f) => {
      const t = new Date(f).getTime();
      return Number.isNaN(t) || t <= Date.now() + 5 * 60 * 1000;
    },
    { message: 'La fecha de vigencia no puede ser futura.' },
  );

const ItemPrecioSchema = z.object({
  productoId: z.uuid('Elegí un producto.'),
  costoNeto: MontoSchema,
});
export type ItemPrecio = z.infer<typeof ItemPrecioSchema>;

const sinProductosRepetidos = (items: { productoId: string }[]) =>
  new Set(items.map((i) => i.productoId)).size === items.length;

/** Cuerpo de POST /api/v1/suppliers/:id/prices (carga manual). */
export const PreciosCreateSchema = z.object({
  items: z
    .array(ItemPrecioSchema)
    .min(1, 'Cargá al menos un costo.')
    .max(500, 'Hasta 500 costos por carga manual; para más, importá una lista.')
    .refine(sinProductosRepetidos, 'Hay productos repetidos en la carga.'),
  vigenteDesde: FechaVigenciaSchema.optional(),
});
export type PreciosCreate = z.infer<typeof PreciosCreateSchema>;

// --- Importación de lista de precios ----------------------------------------

export const LIMITE_FILAS_IMPORTACION = 5000;
export const LIMITE_BYTES_IMPORTACION = 2 * 1024 * 1024;

export const ESTADOS_FILA_IMPORTACION = [
  'NUEVO',
  'CAMBIA',
  'IGUAL',
  'SIN_PRODUCTO',
  'INVALIDA',
] as const;
export const EstadoFilaImportacionSchema = z.enum(ESTADOS_FILA_IMPORTACION);
export type EstadoFilaImportacion = z.infer<typeof EstadoFilaImportacionSchema>;

export const ETIQUETA_ESTADO_FILA: Record<EstadoFilaImportacion, string> = {
  NUEVO: 'Costo nuevo',
  CAMBIA: 'Cambia el costo',
  IGUAL: 'Sin cambios',
  SIN_PRODUCTO: 'Sin producto',
  INVALIDA: 'Fila inválida',
};

/** Fila de la vista previa de una importación. */
export const FilaVistaPreviaSchema = z.object({
  /** Número de fila en la planilla (1 = primera fila de datos). */
  fila: z.number().int(),
  codigo: z.string(),
  /** Normalizado a string decimal; null si no se pudo interpretar. */
  costoNeto: z.string().nullable(),
  estado: EstadoFilaImportacionSchema,
  productoId: z.uuid().nullable(),
  nombre: z.string().nullable(),
  /** Último costo de este proveedor para el producto, si lo había. */
  costoAnterior: z.string().nullable(),
  error: z.string().nullable(),
});
export type FilaVistaPrevia = z.infer<typeof FilaVistaPreviaSchema>;

export const VistaPreviaSchema = z.object({
  filas: z.array(FilaVistaPreviaSchema),
  resumen: z.object({
    total: z.number().int(),
    nuevos: z.number().int(),
    cambios: z.number().int(),
    iguales: z.number().int(),
    sinProducto: z.number().int(),
    invalidas: z.number().int(),
  }),
});
export type VistaPrevia = z.infer<typeof VistaPreviaSchema>;

/** Cuerpo de POST /api/v1/suppliers/:id/price-list (confirmación). */
export const ImportacionConfirmSchema = z.object({
  items: z
    .array(ItemPrecioSchema)
    .min(1, 'No hay costos para importar.')
    .max(LIMITE_FILAS_IMPORTACION, `Hasta ${LIMITE_FILAS_IMPORTACION} filas por importación.`)
    .refine(sinProductosRepetidos, 'Hay productos repetidos en la importación.'),
});
export type ImportacionConfirm = z.infer<typeof ImportacionConfirmSchema>;

export const ResultadoImportacionSchema = z.object({
  loteId: z.uuid(),
  insertados: z.number().int(),
  productosActualizados: z.number().int(),
});
export type ResultadoImportacion = z.infer<typeof ResultadoImportacionSchema>;

/** Resumen de una vista previa a partir de sus filas. */
export function resumirVistaPrevia(filas: FilaVistaPrevia[]): VistaPrevia['resumen'] {
  const cuenta = (estado: EstadoFilaImportacion) => filas.filter((f) => f.estado === estado).length;
  return {
    total: filas.length,
    nuevos: cuenta('NUEVO'),
    cambios: cuenta('CAMBIA'),
    iguales: cuenta('IGUAL'),
    sinProducto: cuenta('SIN_PRODUCTO'),
    invalidas: cuenta('INVALIDA'),
  };
}

/** Filas que la confirmación debe enviar: las que tienen producto y cambian algo. */
export function filasAplicables(filas: FilaVistaPrevia[]): ItemPrecio[] {
  return filas
    .filter(
      (f): f is FilaVistaPrevia & { productoId: string; costoNeto: string } =>
        (f.estado === 'NUEVO' || f.estado === 'CAMBIA') && !!f.productoId && !!f.costoNeto,
    )
    .map((f) => ({ productoId: f.productoId, costoNeto: f.costoNeto }));
}
