import { describe, expect, it } from 'vitest';
import {
  DIAS_STOCK_PARADO,
  NUNCA_SE_VENDIO,
  detallePanel,
  diasSinVenderLegible,
  formatearCapital,
  fraseTotales,
  ultimaVentaLegible,
} from './stock-parado-formato';

const NBSP = '\u00a0';
const totales = (extra = {}) => ({
  capitalParado: '34000.00',
  productos: 3,
  unidades: 15,
  porcentajeDelStock: '34.00',
  ...extra,
});

describe('stock parado (HU-19)', () => {
  it('formatea el capital, la última venta y los días', () => {
    expect(formatearCapital('21000.00')).toBe(`$${NBSP}21.000`);
    expect(ultimaVentaLegible(null)).toBe(NUNCA_SE_VENDIO);
    // 03:00 UTC es medianoche en Buenos Aires: la fecha no se corre de día.
    expect(ultimaVentaLegible('2026-06-03T03:00:00.000Z')).toMatch(/^3 de jun\.? de 2026$/);
    expect(diasSinVenderLegible(120)).toBe('120 días');
    expect(diasSinVenderLegible(1)).toBe('1 día');
    expect(DIAS_STOCK_PARADO).toEqual([30, 60, 90, 180]);
  });

  it('CP-19.5 la frase de totales', () => {
    expect(fraseTotales(totales(), 90)).toBe(
      `Tenés $${NBSP}34.000 (el 34 % de tu stock) en 3 productos que no se vendieron en los últimos 90 días.`,
    );
    expect(fraseTotales(totales({ productos: 1, porcentajeDelStock: '12.50' }), 30)).toBe(
      `Tenés $${NBSP}34.000 (el 12,5 % de tu stock) en 1 producto que no se vendió en los últimos 30 días.`,
    );
    expect(fraseTotales(totales({ productos: 0 }), 180)).toBe(
      'Ningún producto con stock lleva más de 180 días sin venderse.',
    );
    expect(detallePanel(2)).toBe('en 2 productos sin ventas en 90 días');
  });
});
