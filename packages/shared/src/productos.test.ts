import { describe, expect, it } from 'vitest';
import {
  MontoSchema,
  ProductoCreateSchema,
  ProductoPatchSchema,
  ProductosQuerySchema,
  calcularEstadoStock,
} from './productos';

describe('esquemas de HU-01 (catálogo)', () => {
  it('calcularEstadoStock: SIN_STOCK, BAJO y OK', () => {
    expect(calcularEstadoStock(0, 10)).toBe('SIN_STOCK');
    expect(calcularEstadoStock(8, 10)).toBe('BAJO');
    expect(calcularEstadoStock(10, 10)).toBe('BAJO');
    expect(calcularEstadoStock(47, 10)).toBe('OK');
    expect(calcularEstadoStock(1, 0)).toBe('OK');
  });

  it('MontoSchema normaliza a string con 2 decimales y rechaza negativos o 3 decimales', () => {
    expect(MontoSchema.parse(3900)).toBe('3900.00');
    expect(MontoSchema.parse('2340,5')).toBe('2340.50');
    expect(() => MontoSchema.parse(-1)).toThrow();
    expect(() => MontoSchema.parse('1.234')).toThrow();
  });

  it('ProductoCreateSchema aplica defaults y valida CP-01.1c', () => {
    const ok = ProductoCreateSchema.parse({
      codigo: ' fa-220 ',
      nombre: 'Filtro Aire FA-220',
      precioVenta: 3900,
      costoReposicion: '2340',
    });
    expect(ok).toMatchObject({
      codigo: 'fa-220',
      precioVenta: '3900.00',
      costoReposicion: '2340.00',
      stockInicial: 0,
      stockSeguridad: 0,
    });
    const r = ProductoCreateSchema.safeParse({
      codigo: '',
      nombre: 'x'.repeat(121),
      precioVenta: -5,
      alicuotaIva: 101,
      costoReposicion: 1,
      stockInicial: -1,
    });
    expect(r.success).toBe(false);
    const campos = r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
    expect(campos).toEqual(
      expect.arrayContaining(['codigo', 'nombre', 'precioVenta', 'alicuotaIva', 'stockInicial']),
    );
  });

  it('ProductoPatchSchema rechaza stockActual con mensaje propio (CP-01.4b) y exige algún campo', () => {
    const r = ProductoPatchSchema.safeParse({ stockActual: 100 });
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues[0]?.message).toMatch(/movimiento/);
    expect(() => ProductoPatchSchema.parse({})).toThrow();
    expect(ProductoPatchSchema.parse({ stockSeguridad: 5, categoria: '' })).toEqual({
      stockSeguridad: 5,
      categoria: null,
    });
  });

  it('ProductosQuerySchema convierte activo y limit', () => {
    expect(ProductosQuerySchema.parse({})).toEqual({ activo: true, limit: 25 });
    expect(ProductosQuerySchema.parse({ activo: 'false', limit: '10', estado: 'BAJO' })).toEqual({
      activo: false,
      limit: 10,
      estado: 'BAJO',
    });
  });
});
