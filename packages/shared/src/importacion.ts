import { z } from 'zod';
import { ProductoCreateSchema } from './productos';

// ---------------------------------------------------------------------------
// Importación de productos desde planilla — HU-05 (RF-08)
// ---------------------------------------------------------------------------

/** Columnas admitidas: alias de encabezado (se normalizan sin tildes ni mayúsculas). */
export const COLUMNAS_IMPORTACION = {
  codigo: {
    alias: ['codigo', 'código', 'sku', 'cod', 'codigo de producto'],
    obligatoria: true,
    descripcion: 'Código único del producto',
  },
  nombre: {
    alias: ['nombre', 'descripcion', 'descripción', 'producto', 'articulo', 'artículo'],
    obligatoria: true,
    descripcion: 'Nombre del producto',
  },
  precioVenta: {
    alias: ['precio', 'precio de venta', 'precio venta', 'pvp', 'precio con iva'],
    obligatoria: true,
    descripcion: 'Precio de venta con IVA incluido',
  },
  costoReposicion: {
    alias: ['costo', 'costo neto', 'costo de reposicion', 'costo de reposición', 'costo sin iva'],
    obligatoria: false,
    descripcion: 'Costo de reposición sin IVA (0 si falta)',
  },
  stockInicial: {
    alias: ['stock', 'stock inicial', 'cantidad', 'existencia', 'existencias'],
    obligatoria: false,
    descripcion: 'Stock inicial (0 si falta; no se toca en productos existentes)',
  },
  stockSeguridad: {
    alias: [
      'stock minimo',
      'stock mínimo',
      'stock de seguridad',
      'minimo',
      'mínimo',
      'stock_minimo',
    ],
    obligatoria: false,
    descripcion: 'Stock de seguridad (0 si falta)',
  },
  categoria: {
    alias: ['categoria', 'categoría', 'rubro', 'familia'],
    obligatoria: false,
    descripcion: 'Categoría (texto libre)',
  },
  alicuotaIva: {
    alias: ['iva', 'iva %', 'alicuota', 'alícuota', 'alicuota iva', 'alícuota iva'],
    obligatoria: false,
    descripcion: 'Alícuota de IVA en % (la del comercio si falta)',
  },
} as const;
export type ColumnaImportacion = keyof typeof COLUMNAS_IMPORTACION;

export const ESTADOS_FILA_PRODUCTO = ['NUEVO', 'ACTUALIZA', 'INVALIDA'] as const;
export const EstadoFilaProductoSchema = z.enum(ESTADOS_FILA_PRODUCTO);
export type EstadoFilaProducto = z.infer<typeof EstadoFilaProductoSchema>;

export const ETIQUETA_ESTADO_FILA_PRODUCTO: Record<EstadoFilaProducto, string> = {
  NUEVO: 'Se va a crear',
  ACTUALIZA: 'Se va a actualizar',
  INVALIDA: 'Fila inválida',
};

/** Datos normalizados de una fila válida: la misma forma que el alta manual. */
export const DatosFilaProductoSchema = ProductoCreateSchema;
export type DatosFilaProducto = z.infer<typeof DatosFilaProductoSchema>;

/** Fila de la vista previa. */
export const FilaImportacionSchema = z.object({
  /** Número de fila de datos en la planilla (1 = primera). */
  fila: z.number().int(),
  codigo: z.string(),
  estado: EstadoFilaProductoSchema,
  /** Datos ya validados; null cuando la fila es inválida. */
  datos: DatosFilaProductoSchema.nullable(),
  /** Producto existente que se actualizaría. */
  productoId: z.uuid().nullable(),
  /** Stock actual del existente (no cambia con la importación). */
  stockActual: z.number().int().nullable(),
  error: z.string().nullable(),
});
export type FilaImportacion = z.infer<typeof FilaImportacionSchema>;

export const ResumenImportacionSchema = z.object({
  total: z.number().int(),
  nuevos: z.number().int(),
  actualizan: z.number().int(),
  invalidas: z.number().int(),
  productosActualesActivos: z.number().int(),
  /** Activos actuales más los nuevos. */
  productosResultantes: z.number().int(),
  /** Límite de productos activos del plan; null si es ilimitado. */
  limitePlan: z.number().int().nullable(),
  superaLimite: z.boolean(),
});

export const VistaPreviaImportacionSchema = z.object({
  filas: z.array(FilaImportacionSchema),
  resumen: ResumenImportacionSchema,
});
export type VistaPreviaImportacion = z.infer<typeof VistaPreviaImportacionSchema>;

const normalizar = (c: string) => c.trim().toUpperCase();

const FilaConfirmSchema = z.object({
  fila: z.number().int(),
  codigo: z.string(),
  estado: z.enum(['NUEVO', 'ACTUALIZA']),
  datos: DatosFilaProductoSchema,
});
export type FilaConfirm = z.infer<typeof FilaConfirmSchema>;

/** Cuerpo de POST /api/v1/import/commit. */
export const ImportacionProductosConfirmSchema = z.object({
  filas: z
    .array(FilaConfirmSchema)
    .min(1, 'No hay productos para importar.')
    .max(5000, 'Hasta 5000 filas por importación.')
    .refine(
      (filas) => new Set(filas.map((f) => normalizar(f.datos.codigo))).size === filas.length,
      'Hay códigos repetidos en la importación.',
    ),
});
export type ImportacionProductosConfirm = z.infer<typeof ImportacionProductosConfirmSchema>;

export const ResultadoImportacionProductosSchema = z.object({
  creados: z.number().int(),
  actualizados: z.number().int(),
  omitidos: z.number().int(),
  detalles: z.array(z.object({ fila: z.number().int(), codigo: z.string(), motivo: z.string() })),
});
export type ResultadoImportacionProductos = z.infer<typeof ResultadoImportacionProductosSchema>;

/** Filas que la confirmación debe enviar: las válidas (nuevas o a actualizar). */
export function filasAplicablesProductos(filas: FilaImportacion[]): FilaConfirm[] {
  return filas
    .filter(
      (f): f is FilaImportacion & { estado: 'NUEVO' | 'ACTUALIZA'; datos: DatosFilaProducto } =>
        (f.estado === 'NUEVO' || f.estado === 'ACTUALIZA') && f.datos !== null,
    )
    .map((f) => ({ fila: f.fila, codigo: f.codigo, estado: f.estado, datos: f.datos }));
}

/** Resumen de una vista previa (los conteos de plan los agrega la API). */
export function contarFilas(
  filas: FilaImportacion[],
): Pick<z.infer<typeof ResumenImportacionSchema>, 'total' | 'nuevos' | 'actualizan' | 'invalidas'> {
  const cuenta = (e: EstadoFilaProducto) => filas.filter((f) => f.estado === e).length;
  return {
    total: filas.length,
    nuevos: cuenta('NUEVO'),
    actualizan: cuenta('ACTUALIZA'),
    invalidas: cuenta('INVALIDA'),
  };
}
