import { randomUUID } from 'node:crypto';
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

/** Varias filas de una vez (importación): el llamador ya filtró las que cambian. */
export async function registrarPreciosVenta(
  tx: TransaccionRaw,
  filas: RegistroPrecioVenta[],
): Promise<void> {
  if (filas.length === 0) return;
  await tx.precioVentaHistorial.createMany({
    data: filas.map((r) => ({
      id: randomUUID(),
      comercioId: r.comercioId,
      productoId: r.productoId,
      precioVenta: r.precioVenta,
      alicuotaIva: r.alicuotaIva,
      origen: r.origen,
      usuarioId: r.usuarioId,
    })),
  });
}
