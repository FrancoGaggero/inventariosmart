import {
  DIAS_QUIEBRES,
  type DiasQuiebres,
  type ProductoConQuiebres,
  type TotalesQuiebres,
} from '@inventariosmart/shared';

// Textos y formatos de las pérdidas por falta de stock (HU-18): funciones puras, sin red ni sesión.

export const RUTA_QUIEBRES = '/quiebres';
export { DIAS_QUIEBRES };

export const EXPLICACION_QUIEBRES =
  'Estimamos lo que habrías vendido con lo que vendía cada producto en los días en que tuvo stock, en los últimos 90 días. Si un producto ya no se vende, dalo de baja para que no cuente.';

const entero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const unDecimal = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * "4000.00" → "$ 4.000": la pérdida es una estimación, va sin centavos. El espacio no se corta,
 * para que el signo no quede solo al final de una línea.
 */
export function formatearPerdida(monto: string | null): string {
  return monto === null ? '—' : `$\u00a0${entero.format(Number(monto))}`;
}

/** 5 → "5,0 días"; 1 → "1,0 día"; menos de un décimo → "menos de un día". */
export function diasLegibles(dias: number): string {
  if (dias < 0.05) return 'menos de un día';
  return `${unDecimal.format(dias)} ${dias === 1 ? 'día' : 'días'}`;
}

/** "10.0" → "10,0 unidades". */
export function unidadesLegibles(unidades: string | null): string {
  if (unidades === null) return '—';
  const n = Number(unidades);
  return `${unDecimal.format(n)} ${n === 1 ? 'unidad' : 'unidades'}`;
}

export const etiquetaPeriodo = (dias: DiasQuiebres) => `Últimos ${dias} días`;

export const SIN_STOCK_AHORA = 'Sin stock ahora';
export const SIN_HISTORIAL = 'Sin historial suficiente';

/** Ganancia perdida de la fila, o por qué no se estima. */
export function textoGanancia(p: Pick<ProductoConQuiebres, 'gananciaPerdida' | 'motivo'>): string {
  return p.motivo === 'SIN_HISTORIAL' ? SIN_HISTORIAL : formatearPerdida(p.gananciaPerdida);
}

const productos = (n: number) => (n === 1 ? '1 producto' : `${entero.format(n)} productos`);

/** Totales del período en una frase. */
export function fraseTotales(t: TotalesQuiebres, dias: DiasQuiebres): string {
  if (t.productosAfectados === 0) {
    return `En los últimos ${dias} días ningún producto se quedó sin stock.`;
  }
  const base = `En los últimos ${dias} días ${productos(t.productosAfectados)} se ${
    t.productosAfectados === 1 ? 'quedó' : 'quedaron'
  } sin stock`;
  const ahora =
    t.enCurso > 0 ? ` (${t.enCurso === 1 ? '1 sigue' : `${t.enCurso} siguen`} así)` : '';
  if (Number(t.gananciaPerdida) <= 0) return `${base}${ahora}.`;
  return `${base}${ahora}: dejaste de ganar unos ${formatearPerdida(t.gananciaPerdida)}.`;
}

/** Detalle de la tarjeta del panel. */
export function detallePanel(productosAfectados: number): string {
  return `de ganancia en los últimos 30 días · ${productos(productosAfectados)} sin stock`;
}
