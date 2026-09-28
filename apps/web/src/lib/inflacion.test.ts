import { describe, expect, it } from 'vitest';
import {
  aDolares,
  desdeDelPeriodo,
  etiquetasDeMes,
  formatearUsd,
  formatearVariacion,
  fraseInflacion,
} from './inflacion';

const comparacion = (
  misPrecios: string | null,
  ipc: string | null,
  preciosVsIpc: string | null,
  motivo: 'SIN_VENTAS' | 'SIN_IPC' | null = null,
) => ({
  variaciones: { misPrecios, misCostos: null, ipc, ipcBienes: null },
  brechas: { preciosVsIpc, preciosVsCostos: null },
  motivo,
});

describe('fraseInflacion (CP-15.6)', () => {
  it('precios por debajo de la inflación', () => {
    expect(fraseInflacion(comparacion('18.00', '20.00', '-1.67'))).toBe(
      'Tus precios subieron 18 % y la inflación 20 %: en términos reales bajaron 1,7 %.',
    );
  });

  it('precios por encima de la inflación', () => {
    expect(fraseInflacion(comparacion('30.00', '20.00', '8.33'))).toBe(
      'Tus precios subieron 30 % y la inflación 20 %: en términos reales subieron 8,3 %.',
    );
  });

  it('precios sin cambios', () => {
    expect(fraseInflacion(comparacion('0.00', '20.00', '-16.67'))).toBe(
      'Tus precios no cambiaron y la inflación 20 %: en términos reales bajaron 16,7 %.',
    );
  });

  it('sin ventas sólo informa la inflación', () => {
    expect(fraseInflacion(comparacion(null, '20.00', null, 'SIN_VENTAS'))).toBe(
      'En el período la inflación fue de 20 %. Registrá ventas para ver cómo acompañaron tus precios.',
    );
  });

  it('sin índice del INDEC lo avisa', () => {
    expect(fraseInflacion(comparacion('18.00', null, null, 'SIN_IPC'))).toBe(
      'Tus precios subieron 18 %. Todavía no tenemos el índice de precios del INDEC para comparar.',
    );
  });
});

describe('formatos', () => {
  it('variaciones con y sin signo', () => {
    expect(formatearVariacion('-8.33')).toBe('8,3 %');
    expect(formatearVariacion('-8.33', true)).toBe('−8,3 %');
    expect(formatearVariacion('8.33', true)).toBe('+8,3 %');
    expect(formatearVariacion('0.00', true)).toBe('0 %');
  });

  it('CP-15.6b stock en dólares', () => {
    expect(aDolares('2362100.00', '1545.12')).toBe(1528.75);
    expect(formatearUsd(1528.75)).toBe('US$ 1.528,75');
    expect(aDolares('2362100.00', null)).toBeNull();
    expect(aDolares(undefined, '1545.12')).toBeNull();
    expect(aDolares('100', '0')).toBeNull();
  });

  it('período que termina en el último mes con IPC', () => {
    expect(desdeDelPeriodo(6, '2026-08')).toBe('2026-03');
    expect(desdeDelPeriodo(12, '2026-08')).toBe('2025-09');
    expect(desdeDelPeriodo(3, '2026-01')).toBe('2025-11');
  });

  it('etiquetas de los meses', () => {
    expect(etiquetasDeMes('2026-01')).toEqual({ corta: 'ene 26', larga: 'enero de 2026' });
  });
});
