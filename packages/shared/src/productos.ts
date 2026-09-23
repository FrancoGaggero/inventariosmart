import { z } from 'zod';

// ---------------------------------------------------------------------------
// Catálogo de productos — HU-01
// ---------------------------------------------------------------------------

/** Lista paginada por cursor (convención de todos los listados de la API). */
export function listaPaginadaSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    /** null cuando no hay más páginas. */
    siguienteCursor: z.string().nullable(),
  });
}
export type ListaPaginada<T> = { items: T[]; siguienteCursor: string | null };

/**
 * Monto en pesos: acepta número o string decimal, valida no negativo y hasta 2 decimales,
 * y lo devuelve normalizado como string ("1234.50"), que es la forma del contrato.
 */
export const MontoSchema = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const texto = typeof v === 'number' ? String(v) : v.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Ingresá un monto en pesos, sin signo y con hasta 2 decimales.',
    });
    return z.NEVER;
  }
  return Number(texto).toFixed(2);
});

const AlicuotaSchema = z
  .number('La alícuota de IVA debe ser un número.')
  .min(0, 'La alícuota de IVA no puede ser negativa.')
  .max(100, 'La alícuota de IVA no puede superar 100.');

const enteroNoNegativo = (que: string) =>
  z
    .number(`${que} debe ser un número entero.`)
    .int(`${que} debe ser un número entero.`)
    .min(0, `${que} no puede ser negativo.`);

/** Estado de stock derivado (D2 de product-catalog). HU-06 agrega el punto de reposición. */
export const ESTADOS_STOCK = ['SIN_STOCK', 'BAJO', 'OK'] as const;
export const EstadoStockSchema = z.enum(ESTADOS_STOCK);
export type EstadoStock = z.infer<typeof EstadoStockSchema>;

export function calcularEstadoStock(stockActual: number, stockSeguridad: number): EstadoStock {
  if (stockActual <= 0) return 'SIN_STOCK';
  if (stockActual <= stockSeguridad) return 'BAJO';
  return 'OK';
}

export const CodigoProductoSchema = z
  .string()
  .trim()
  .min(1, 'El código es obligatorio.')
  .max(64, 'El código no puede superar los 64 caracteres.');

const NombreProductoSchema = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres.')
  .max(120, 'El nombre no puede superar los 120 caracteres.');

const CategoriaSchema = z
  .string()
  .trim()
  .max(60, 'La categoría no puede superar los 60 caracteres.')
  .transform((v) => (v === '' ? null : v))
  .nullable();

export const ProductoSchema = z.object({
  id: z.uuid(),
  codigo: z.string(),
  nombre: z.string(),
  categoria: z.string().nullable(),
  /** Precio de venta al público, con IVA incluido. */
  precioVenta: z.string(),
  /** Alícuota de IVA en porcentaje (RN-03). */
  alicuotaIva: z.string(),
  /** Costo de reposición vigente, sin IVA. Oculto para EMPLEADO. */
  costoReposicion: z.string().optional(),
  stockActual: z.number().int(),
  stockSeguridad: z.number().int(),
  /** Días de anticipación de la alerta de reposición (HU-06 criterio 4). */
  diasAnticipacionAlerta: z.number().int(),
  estadoStock: EstadoStockSchema,
  /** Proveedor cuya última lista fija el costo vigente (RN-08, HU-02). */
  proveedorPrincipal: z.object({ id: z.uuid(), nombre: z.string() }).nullable(),
  activo: z.boolean(),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});
export type Producto = z.infer<typeof ProductoSchema>;

export const ListaProductosSchema = listaPaginadaSchema(ProductoSchema);
export type ListaProductos = z.infer<typeof ListaProductosSchema>;

/** Días de anticipación de la alerta de reposición: 0 a 90 (HU-06 criterio 4). */
export const DiasAnticipacionSchema = z
  .number('Los días de anticipación deben ser un número entero.')
  .int('Los días de anticipación deben ser un número entero.')
  .min(0, 'Los días de anticipación no pueden ser negativos.')
  .max(90, 'Los días de anticipación no pueden superar 90.');

/** Cuerpo de POST /api/v1/products. */
export const ProductoCreateSchema = z.object({
  codigo: CodigoProductoSchema,
  nombre: NombreProductoSchema,
  categoria: CategoriaSchema.optional(),
  precioVenta: MontoSchema,
  /** Si falta, se usa el IVA por defecto del comercio. */
  alicuotaIva: AlicuotaSchema.optional(),
  costoReposicion: MontoSchema,
  stockInicial: enteroNoNegativo('El stock inicial').default(0),
  stockSeguridad: enteroNoNegativo('El stock de seguridad').default(0),
  diasAnticipacionAlerta: DiasAnticipacionSchema.default(3),
});
export type ProductoCreate = z.infer<typeof ProductoCreateSchema>;

/**
 * Cuerpo de PATCH /api/v1/products/:id.
 * El stock actual no se edita: se ajusta con movimientos (RN-07).
 */
export const ProductoPatchSchema = z
  .object({
    codigo: CodigoProductoSchema.optional(),
    nombre: NombreProductoSchema.optional(),
    categoria: CategoriaSchema.optional(),
    precioVenta: MontoSchema.optional(),
    alicuotaIva: AlicuotaSchema.optional(),
    costoReposicion: MontoSchema.optional(),
    stockSeguridad: enteroNoNegativo('El stock de seguridad').optional(),
    diasAnticipacionAlerta: DiasAnticipacionSchema.optional(),
    /** null quita el proveedor principal; el costo vigente no cambia. */
    proveedorPrincipalId: z.uuid('Elegí un proveedor válido.').nullable().optional(),
    activo: z.boolean().optional(),
    stockActual: z.unknown().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.stockActual !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['stockActual'],
        message: 'El stock no se edita a mano: registrá un movimiento de ingreso o ajuste.',
      });
    }
    const { stockActual: _s, ...resto } = v;
    if (Object.values(resto).every((x) => x === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'No hay nada para actualizar.' });
    }
  })
  .transform(({ stockActual: _s, ...resto }) => resto);
export type ProductoPatch = z.infer<typeof ProductoPatchSchema>;

/** Parámetros de GET /api/v1/products. */
export const ProductosQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  estado: EstadoStockSchema.optional(),
  activo: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ProductosQuery = z.infer<typeof ProductosQuerySchema>;
