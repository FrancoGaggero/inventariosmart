import {
  DIAS_STOCK_PARADO,
  type DiasStockParado,
  type TotalesStockParado,
} from '@inventariosmart/shared';

// Textos y formatos del stock parado (HU-19): funciones puras, sin red ni sesión.

export const RUTA_STOCK_PARADO = '/stock-parado';
export { DIAS_STOCK_PARADO };

export const IDEAS_STOCK_PARADO =
  'Para liberar esa plata: armá una promoción o un combo con un producto que sí sale, preguntale al proveedor si te lo toma de vuelta, y si ya no lo vas a vender, dalo de baja.';

export const NUNCA_SE_VENDIO = 'Nunca se vendió';

const entero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const fecha = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Argentina/Buenos_Aires',
});

/** "21000.00" → "$ 21.000", con un espacio que no se corta. */
export function formatearCapital(monto: string): string {
  return `$\u00a0${entero.format(Number(monto))}`;
}

/** Fecha corta de la última venta, o "Nunca se vendió". */
export function ultimaVentaLegible(iso: string | null): string {
  return iso === null ? NUNCA_SE_VENDIO : fecha.format(new Date(iso));
}

/** 120 → "120 días"; 1 → "1 día". */
export function diasSinVenderLegible(dias: number): string {
  return dias === 1 ? '1 día' : `${entero.format(dias)} días`;
}

export const etiquetaPeriodo = (dias: DiasStockParado) => `Sin ventas en ${dias} días`;

const productos = (n: number) => (n === 1 ? '1 producto' : `${entero.format(n)} productos`);

/** Totales en una frase. */
export function fraseTotales(t: TotalesStockParado, dias: DiasStockParado): string {
  if (t.productos === 0) {
    return `Ningún producto con stock lleva más de ${dias} días sin venderse.`;
  }
  const parte =
    t.porcentajeDelStock === null
      ? ''
      : ` (el ${decimal.format(Number(t.porcentajeDelStock))} % de tu stock)`;
  return `Tenés ${formatearCapital(t.capitalParado)}${parte} en ${productos(t.productos)} que no se ${
    t.productos === 1 ? 'vendió' : 'vendieron'
  } en los últimos ${dias} días.`;
}

/** Detalle de la tarjeta del panel. */
export function detallePanel(n: number): string {
  return `en ${productos(n)} sin ventas en 90 días`;
}
