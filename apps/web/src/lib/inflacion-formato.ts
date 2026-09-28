import {
  mesActual,
  sumarMeses,
  type ComparacionInflacion,
  type EstadoPrecio,
  type Mes,
} from '@inventariosmart/shared';

// Formatos y textos de "Precios e inflación" (HU-15): funciones puras, sin red ni sesión.

/** Primer mes de un período de `meses` que termina en el último mes con IPC publicado. */
export function desdeDelPeriodo(meses: number, ultimoIpc: Mes | null | undefined): Mes {
  const hasta = ultimoIpc ?? sumarMeses(mesActual(), -1);
  return sumarMeses(hasta, -(meses - 1));
}

const pct = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

/** "18.00" → "18 %"; "-1.67" → "1,7 %" (sin signo: el sentido lo da el verbo). */
export function formatearVariacion(valor: string | number, conSigno = false): string {
  const n = Number(valor);
  const texto = `${pct.format(Math.abs(n))} %`;
  if (!conSigno || Number(pct.format(Math.abs(n)).replace(',', '.')) === 0) return texto;
  return `${n > 0 ? '+' : '−'}${texto}`;
}

function movimiento(valor: string, igual: string): string {
  const n = Number(valor);
  if (Math.abs(n) < 0.05) return igual;
  return `${n > 0 ? 'subieron' : 'bajaron'} ${formatearVariacion(valor)}`;
}

/** Frase de cabecera en lenguaje claro (CP-15.6). */
export function fraseInflacion(
  c: Pick<ComparacionInflacion, 'variaciones' | 'brechas' | 'motivo'>,
): string {
  const { misPrecios, ipc } = c.variaciones;
  if (c.motivo === 'SIN_VENTAS' || misPrecios === null) {
    return ipc === null
      ? 'Todavía no hay datos suficientes para comparar tus precios con la inflación.'
      : `En el período la inflación fue de ${formatearVariacion(ipc)}. Registrá ventas para ver cómo acompañaron tus precios.`;
  }
  const precios = `Tus precios ${movimiento(misPrecios, 'no cambiaron')}`;
  if (ipc === null || c.brechas.preciosVsIpc === null) {
    return `${precios}. Todavía no tenemos el índice de precios del INDEC para comparar.`;
  }
  return `${precios} y la inflación ${formatearVariacion(ipc)}: en términos reales ${movimiento(c.brechas.preciosVsIpc, 'quedaron igual')}.`;
}

export const CLASE_ESTADO_PRECIO: Record<EstadoPrecio, string> = {
  ATRASADO: 'bg-crit/15 text-crit',
  ALINEADO: 'bg-ok/15 text-ok',
  ADELANTADO: 'bg-brand/15 text-brand-3',
};

const dolares = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'symbol',
});

/** 1528.75 → "US$ 1.528,75". */
export function formatearUsd(monto: number): string {
  return dolares.format(monto).replace(/\s/g, ' ');
}

/** Pesos a dólares al tipo de cambio dado; null si falta alguno de los dos. */
export function aDolares(
  pesos: string | null | undefined,
  tipoDeCambio: string | null | undefined,
): number | null {
  if (pesos === null || pesos === undefined || !tipoDeCambio) return null;
  const tc = Number(tipoDeCambio);
  if (!(tc > 0)) return null;
  return Math.round((Number(pesos) / tc) * 100) / 100;
}

const mesCorto = new Intl.DateTimeFormat('es-AR', { month: 'short' });
const mesLargo = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
const diaMes = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** Etiquetas de un mes para el eje del gráfico: "ene 26" y "enero de 2026". */
export function etiquetasDeMes(mes: Mes): { corta: string; larga: string } {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  const fecha = new Date(a, m - 1, 1);
  return {
    corta: `${mesCorto.format(fecha).replace('.', '')} ${String(a).slice(2)}`,
    larga: mesLargo.format(fecha),
  };
}

/** "2026-09-25" → "25 sept". */
export function formatearDia(fecha: string): string {
  return diaMes.format(new Date(`${fecha}T00:00:00Z`)).replace('.', '');
}
