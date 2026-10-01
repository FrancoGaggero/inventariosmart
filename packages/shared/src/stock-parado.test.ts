import { describe, expect, it } from 'vitest';
import { DIA_MS } from './quiebres';
import {
  DeadStockQuerySchema,
  capitalParado,
  diasSinVender,
  ordenarStockParado,
  totalizarStockParado,
  type ProductoParado,
} from './stock-parado';

const AHORA = new Date('2026-10-01T15:00:00.000Z');
const hace = (dias: number) => new Date(AHORA.getTime() - dias * DIA_MS);

const item = (nombre: string, capital: string, dias: number, stock = 1): ProductoParado => ({
  producto: {
    id: `00000000-0000-4000-8000-0000000000${String(nombre.length).padStart(2, '0')}`,
    codigo: nombre,
    nombre,
  },
  stock,
  costoReposicion: capital,
  capitalParado: capital,
  ultimaVenta: null,
  diasSinVender: dias,
});

describe('stock parado (RN-15)', () => {
  it('CP-19.1 días desde la última venta, en días enteros', () => {
    expect(diasSinVender(hace(120), hace(200), AHORA)).toBe(120);
    expect(diasSinVender(hace(120.9), hace(200), AHORA)).toBe(120);
  });

  it('CP-19.1b sin ventas, los días se cuentan desde el alta', () => {
    expect(diasSinVender(null, hace(200), AHORA)).toBe(200);
    expect(diasSinVender(null, new Date(AHORA.getTime() + 1000), AHORA)).toBe(0);
  });

  it('el capital es stock × costo vigente, con dos decimales (RN-08)', () => {
    expect(capitalParado(10, '2100.00')).toBe('21000.00');
    expect(capitalParado(3, '33.335')).toBe('100.01');
    expect(capitalParado(0, '500')).toBe('0.00');
  });

  it('CP-19.2 ordena por capital y totaliza con el porcentaje del stock', () => {
    const items = [
      item('A', '4000.00', 100, 2),
      item('BB', '21000.00', 120, 10),
      item('CCC', '9000.00', 95, 3),
      item('DDDD', '9000.00', 150, 1),
    ];
    expect(ordenarStockParado(items).map((p) => p.producto.nombre)).toEqual([
      'BB',
      'DDDD',
      'CCC',
      'A',
    ]);
    expect(totalizarStockParado(items.slice(0, 3), '100000.00')).toEqual({
      capitalParado: '34000.00',
      productos: 3,
      unidades: 15,
      porcentajeDelStock: '34.00',
    });
  });

  it('CP-19.2d sin productos parados, y el porcentaje null si el stock no vale nada', () => {
    expect(totalizarStockParado([], '50000')).toEqual({
      capitalParado: '0.00',
      productos: 0,
      unidades: 0,
      porcentajeDelStock: '0.00',
    });
    expect(totalizarStockParado([], 0).porcentajeDelStock).toBeNull();
  });

  it('CP-19.2c sólo acepta 30, 60, 90 o 180 días', () => {
    expect(DeadStockQuerySchema.parse({})).toEqual({ dias: 90, limit: 25 });
    expect(DeadStockQuerySchema.parse({ dias: '180' }).dias).toBe(180);
    for (const dias of ['45', 'x', '0']) {
      const r = DeadStockQuerySchema.safeParse({ dias });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(['dias']);
    }
  });
});
