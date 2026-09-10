import {
  aProducto,
  codificarCursor,
  decodificarCursor,
  normalizarCodigo,
} from './products.service';

describe('products.service (unitario)', () => {
  it('normalizarCodigo recorta y pasa a mayúsculas (RN-05)', () => {
    expect(normalizarCodigo('  fa-220 ')).toBe('FA-220');
  });

  it('el cursor codifica y decodifica (nombre, id) de ida y vuelta', () => {
    const c = codificarCursor('Aceite Mineral 1L', '11111111-1111-4111-8111-111111111111');
    expect(c).not.toMatch(/[+/=]/);
    expect(decodificarCursor(c)).toEqual({
      nombre: 'Aceite Mineral 1L',
      id: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('un cursor inválido produce VALIDACION', () => {
    expect(() => decodificarCursor('no-es-base64-json')).toThrow(/cursor/i);
  });

  it('aProducto normaliza montos a 2 decimales y deriva el estado de stock', () => {
    const base = {
      id: 'x',
      codigo: 'FA-220',
      nombre: 'Filtro',
      categoria: null,
      precioVenta: '3900',
      alicuotaIva: '21.00',
      costoReposicion: '2340.5',
      stockSeguridad: 10,
      activo: true,
      creadoEn: new Date('2026-09-11T00:00:00Z'),
      actualizadoEn: new Date('2026-09-11T00:00:00Z'),
    };
    expect(aProducto({ ...base, stockActual: 47 })).toMatchObject({
      precioVenta: '3900.00',
      alicuotaIva: '21',
      costoReposicion: '2340.50',
      estadoStock: 'OK',
    });
    expect(aProducto({ ...base, stockActual: 8 }).estadoStock).toBe('BAJO');
    expect(aProducto({ ...base, stockActual: 0 }).estadoStock).toBe('SIN_STOCK');
  });
});
