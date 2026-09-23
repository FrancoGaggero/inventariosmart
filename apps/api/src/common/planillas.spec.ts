import {
  leerMatriz,
  normalizarEncabezado,
  parsearEntero,
  resolverColumnas,
  verificarTope,
} from './planillas';

describe('common/planillas (unitario)', () => {
  it('normalizarEncabezado quita tildes, mayúsculas y símbolos', () => {
    expect(normalizarEncabezado('  Código ')).toBe('codigo');
    expect(normalizarEncabezado('Precio de Venta ($)')).toBe('precio de venta');
    expect(normalizarEncabezado('IVA %')).toBe('iva %');
    expect(normalizarEncabezado('Stock_Mínimo')).toBe('stock_minimo');
  });

  it('resolverColumnas encuentra alias en cualquier orden y devuelve null en las ausentes', () => {
    const columnas = resolverColumnas(['Rubro', 'Descripción', 'Código', 'Precio de venta'], {
      codigo: ['codigo', 'sku'],
      nombre: ['nombre', 'descripcion'],
      precioVenta: ['precio', 'precio de venta'],
      costoReposicion: ['costo'],
      categoria: ['categoria', 'rubro'],
    });
    expect(columnas).toEqual({
      codigo: 2,
      nombre: 1,
      precioVenta: 3,
      costoReposicion: null,
      categoria: 0,
    });
  });

  it('parsearEntero acepta enteros con formato y rechaza decimales o texto', () => {
    expect(parsearEntero('10')).toBe(10);
    expect(parsearEntero('1.000')).toBe(1000);
    expect(parsearEntero('10,0')).toBe(10);
    expect(parsearEntero('10,5')).toBeNull();
    expect(parsearEntero('diez')).toBeNull();
    expect(parsearEntero('')).toBeNull();
  });

  it('leerMatriz lee CSV con BOM y comillas, y rechaza formatos y planillas vacías', async () => {
    const matriz = await leerMatriz(Buffer.from('﻿a;b\n"x;y";2\n', 'utf8'), 'p.csv');
    expect(matriz).toEqual([
      ['a', 'b'],
      ['x;y', '2'],
    ]);
    await expect(leerMatriz(Buffer.from('x'), 'p.pdf')).rejects.toThrow(/xlsx o \.csv/);
    await expect(leerMatriz(Buffer.from('\n'), 'p.csv')).rejects.toThrow(/vacía/);
  });

  it('verificarTope rechaza más de 5.000 filas', () => {
    expect(() => verificarTope(5000)).not.toThrow();
    expect(() => verificarTope(5001)).toThrow(/5000/);
  });
});
