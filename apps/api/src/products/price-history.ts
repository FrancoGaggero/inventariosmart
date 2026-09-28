import type { OrigenPrecioVenta } from '@inventariosmart/shared';
import type { TransaccionRaw } from '../prisma/prisma.service';

export interface RegistroPrecioVenta {
  comercioId: string;
  productoId: string;
  /** Precio de venta con IVA incluido. */
  precioVenta: string | number;
  alicuotaIva: string | number;
  origen: OrigenPrecioVenta;
  usuarioId: string | null;
}

type Decimalish = { toString(): string } | string | number;

/** true si el precio o la alícuota difieren (comparación numérica: "1100" y "1100.00" son iguales). */
export function cambiaPrecio(
  anterior: { precioVenta: Decimalish; alicuotaIva: Decimalish },
  nuevo: { precioVenta: Decimalish; alicuotaIva: Decimalish },
): boolean {
  return (
    Number(anterior.precioVenta) !== Number(nuevo.precioVenta) ||
    Number(anterior.alicuotaIva) !== Number(nuevo.alicuotaIva)
  );
}

/**
 * Deja constancia del precio de venta de un producto (HU-15, design D5). Corre dentro de la
 * transacción que crea o edita el producto y no agrega filas si el precio no cambió.
 * Devuelve true si registró una fila.
 */
export async function registrarPrecioVenta(
  tx: TransaccionRaw,
  r: RegistroPrecioVenta,
): Promise<boolean> {
  const ultimo = await tx.precioVentaHistorial.findFirst({
    where: { comercioId: r.comercioId, productoId: r.productoId },
    orderBy: [{ vigenteDesde: 'desc' }, { creadoEn: 'desc' }],
    select: { precioVenta: true, alicuotaIva: true },
  });
  if (ultimo && !cambiaPrecio(ultimo, r)) return false;
  await tx.precioVentaHistorial.create({
    data: {
      comercioId: r.comercioId,
      productoId: r.productoId,
      precioVenta: r.precioVenta,
      alicuotaIva: r.alicuotaIva,
      origen: r.origen,
      usuarioId: r.usuarioId,
    },
  });
  return true;
}

export interface LotePreciosVenta {
  comercioId: string;
  origen: OrigenPrecioVenta;
  usuarioId: string | null;
}

/**
 * Varias filas de una vez (importación, remarcación): el llamador ya filtró las que cambian.
 * Una sola sentencia con arreglos: con miles de filas viaja mucho menos que fila por fila.
 */
export async function registrarPreciosVenta(
  tx: TransaccionRaw,
  lote: LotePreciosVenta,
  filas: { productoId: string; precioVenta: string | number; alicuotaIva: string | number }[],
): Promise<void> {
  if (filas.length === 0) return;
  await tx.$executeRaw`
    INSERT INTO precio_venta_historial
      (id, comercio_id, producto_id, precio_venta, alicuota_iva, origen, usuario_id)
    SELECT gen_random_uuid(), ${lote.comercioId}::uuid, v.producto, v.precio::numeric,
           v.iva::numeric, ${lote.origen}::origen_precio_venta, ${lote.usuarioId}::uuid
    FROM unnest(
      ${filas.map((f) => f.productoId)}::uuid[],
      ${filas.map((f) => String(f.precioVenta))}::text[],
      ${filas.map((f) => String(f.alicuotaIva))}::text[]
    ) AS v(producto, precio, iva)`;
}
