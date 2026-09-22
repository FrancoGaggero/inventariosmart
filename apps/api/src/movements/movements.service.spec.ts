import { aMovimiento, codificarCursor, decodificarCursor } from './movements.service';

describe('movements.service (unitario)', () => {
  it('el cursor codifica y decodifica (fecha, id) de ida y vuelta', () => {
    const fecha = new Date('2026-09-22T15:04:05.123Z');
    const c = codificarCursor(fecha, '11111111-1111-4111-8111-111111111111');
    expect(c).not.toMatch(/[+/=]/);
    expect(decodificarCursor(c)).toEqual({ fecha, id: '11111111-1111-4111-8111-111111111111' });
  });

  it('un cursor inválido o con fecha rota produce VALIDACION', () => {
    expect(() => decodificarCursor('no-es-base64-json')).toThrow(/cursor/i);
    const roto = Buffer.from(JSON.stringify(['ayer', 'x']), 'utf8').toString('base64url');
    expect(() => decodificarCursor(roto)).toThrow(/cursor/i);
  });

  it('aMovimiento arma producto, usuario, estado de stock y precio con 2 decimales', () => {
    const fila = {
      id: 'm1',
      tipo: 'VENTA' as const,
      cantidad: 2,
      efectoStock: -2,
      stockResultante: 9,
      precioUnitario: '3900',
      motivo: null,
      observacion: null,
      fecha: new Date('2026-09-22T12:00:00Z'),
      corrigeAId: null,
      anuladoPorId: null,
      creadoEn: new Date('2026-09-22T12:00:01Z'),
      productoId: 'p1',
      productoCodigo: 'FA-220',
      productoNombre: 'Filtro',
      stockSeguridad: 10,
      usuarioId: 'u1',
      usuarioNombre: 'Ana',
    };
    expect(aMovimiento(fila)).toMatchObject({
      producto: { id: 'p1', codigo: 'FA-220', nombre: 'Filtro' },
      usuario: { id: 'u1', nombre: 'Ana' },
      estadoStock: 'BAJO',
      precioUnitario: '3900.00',
      fecha: '2026-09-22T12:00:00.000Z',
    });
    expect(
      aMovimiento({ ...fila, tipo: 'INGRESO', precioUnitario: null }).precioUnitario,
    ).toBeNull();
    expect(aMovimiento({ ...fila, stockResultante: 0 }).estadoStock).toBe('SIN_STOCK');
  });
});
