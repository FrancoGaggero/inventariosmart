import { describe, expect, it } from 'vitest';
import { DashboardSchema, variacionPct } from './dashboard';

describe('HU-04 (dashboard)', () => {
  it('variacionPct: CP-04.1 (200 %) y CP-04.1c (sin base → null)', () => {
    expect(variacionPct('1200.00', '400.00')).toBe('200.00');
    expect(variacionPct('300.00', '400.00')).toBe('-25.00');
    expect(variacionPct('1200.00', '0.00')).toBeNull();
    expect(variacionPct('0.00', '0.00')).toBeNull();
  });

  it('DashboardSchema acepta una respuesta completa', () => {
    const r = DashboardSchema.safeParse({
      periodo: '2026-09',
      stock: {
        productosActivos: 3,
        unidades: 13,
        valorizacion: '1060.00',
        sinStock: 1,
        stockBajo: 1,
      },
      ventas: {
        unidadesVendidas: 12,
        ventasNetas: '1200.00',
        costoVendido: '1200.00',
        margenBruto: '0.00',
        margenBrutoPct: '0.00',
        gastos: '60.00',
        margenNeto: '-60.00',
        margenNetoPct: '-5.00',
        motivo: null,
      },
      mesAnterior: {
        periodo: '2026-08',
        unidadesVendidas: 4,
        ventasNetas: '400.00',
        variacionVentasPct: '200.00',
      },
      topRentables: [],
      alertas: {
        sinStock: { total: 0, items: [] },
        stockBajo: { total: 0, items: [] },
        faltanGastos: false,
      },
    });
    expect(r.success).toBe(true);
  });
});
