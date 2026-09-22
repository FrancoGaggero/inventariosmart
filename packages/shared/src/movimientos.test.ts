import { describe, expect, it } from 'vitest';
import {
  AnulacionSchema,
  MOTIVOS_POR_TIPO,
  MovimientoCreateSchema,
  MovimientosQuerySchema,
  efectoStockDe,
  esAnulable,
} from './movimientos';

const productoId = '3f1c2a9e-5b6d-4c7e-8f90-1a2b3c4d5e6f';
const camposDe = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : (r.error?.issues ?? []).map((i) => String(i.path[0]));

describe('esquemas de HU-10 (movimientos)', () => {
  it('efectoStockDe: VENTA resta, INGRESO suma, AJUSTE conserva el signo', () => {
    expect(efectoStockDe('VENTA', 2)).toBe(-2);
    expect(efectoStockDe('INGRESO', 30)).toBe(30);
    expect(efectoStockDe('AJUSTE', -3)).toBe(-3);
    expect(efectoStockDe('AJUSTE', 5)).toBe(5);
  });

  it('CP-10.1 una venta válida sólo necesita producto y cantidad', () => {
    const r = MovimientoCreateSchema.parse({ tipo: 'VENTA', productoId, cantidad: 2 });
    expect(r).toEqual({ tipo: 'VENTA', productoId, cantidad: 2 });
  });

  it('CP-10.1c el AJUSTE exige motivo y admite cantidad negativa; 0 se rechaza', () => {
    const ok = MovimientoCreateSchema.parse({
      tipo: 'AJUSTE',
      productoId,
      cantidad: -3,
      motivo: 'ROTURA',
      observacion: '  ',
    });
    expect(ok).toMatchObject({ cantidad: -3, motivo: 'ROTURA', observacion: null });

    const sinMotivo = MovimientoCreateSchema.safeParse({
      tipo: 'AJUSTE',
      productoId,
      cantidad: -3,
    });
    expect(camposDe(sinMotivo)).toContain('motivo');

    const cero = MovimientoCreateSchema.safeParse({
      tipo: 'AJUSTE',
      productoId,
      cantidad: 0,
      motivo: 'INVENTARIO',
    });
    expect(camposDe(cero)).toContain('cantidad');

    const motivoAjeno = MovimientoCreateSchema.safeParse({
      tipo: 'AJUSTE',
      productoId,
      cantidad: 1,
      motivo: 'ANULACION',
    });
    expect(camposDe(motivoAjeno)).toContain('motivo');
  });

  it('CP-10.1d la fecha puede ser pasada pero no futura', () => {
    const ayer = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const maniana = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      MovimientoCreateSchema.safeParse({ tipo: 'VENTA', productoId, cantidad: 1, fecha: ayer })
        .success,
    ).toBe(true);
    const futura = MovimientoCreateSchema.safeParse({
      tipo: 'VENTA',
      productoId,
      cantidad: 1,
      fecha: maniana,
    });
    expect(camposDe(futura)).toEqual(['fecha']);
    const malFormada = MovimientoCreateSchema.safeParse({
      tipo: 'VENTA',
      productoId,
      cantidad: 1,
      fecha: '22/09/2026',
    });
    expect(camposDe(malFormada)).toEqual(['fecha']);
  });

  it('CP-10.1e datos inválidos nombran cada campo', () => {
    expect(
      camposDe(MovimientoCreateSchema.safeParse({ tipo: 'VENTA', productoId, cantidad: 0 })),
    ).toEqual(['cantidad']);
    expect(
      camposDe(MovimientoCreateSchema.safeParse({ tipo: 'INGRESO', productoId, cantidad: -1 })),
    ).toEqual(['cantidad']);
    expect(
      camposDe(MovimientoCreateSchema.safeParse({ tipo: 'VENTA', productoId, cantidad: 1.5 })),
    ).toEqual(['cantidad']);
    expect(
      camposDe(MovimientoCreateSchema.safeParse({ tipo: 'EGRESO', productoId, cantidad: 1 })),
    ).toEqual(['tipo']);
    expect(
      camposDe(MovimientoCreateSchema.safeParse({ tipo: 'VENTA', productoId: 'x', cantidad: 1 })),
    ).toEqual(['productoId']);
    expect(
      camposDe(
        MovimientoCreateSchema.safeParse({
          tipo: 'VENTA',
          productoId,
          cantidad: 1,
          observacion: 'x'.repeat(201),
        }),
      ),
    ).toEqual(['observacion']);
  });

  it('CP-10.5c el rango de fechas debe ser coherente y ISO 8601', () => {
    expect(MovimientosQuerySchema.parse({})).toEqual({ limit: 25 });
    const invertido = MovimientosQuerySchema.safeParse({
      desde: '2026-09-20T00:00:00.000Z',
      hasta: '2026-09-10T00:00:00.000Z',
    });
    expect(camposDe(invertido)).toEqual(['hasta']);
    expect(camposDe(MovimientosQuerySchema.safeParse({ desde: 'ayer' }))).toEqual(['desde']);
    expect(MovimientosQuerySchema.parse({ tipo: 'VENTA', limit: '10', productoId })).toEqual({
      tipo: 'VENTA',
      limit: 10,
      productoId,
    });
  });

  it('AnulacionSchema y esAnulable', () => {
    expect(AnulacionSchema.parse({})).toEqual({});
    expect(AnulacionSchema.parse({ observacion: 'Cobrada dos veces' })).toEqual({
      observacion: 'Cobrada dos veces',
    });
    expect(esAnulable({ anuladoPorId: null, corrigeAId: null })).toBe(true);
    expect(esAnulable({ anuladoPorId: productoId, corrigeAId: null })).toBe(false);
    expect(esAnulable({ anuladoPorId: null, corrigeAId: productoId })).toBe(false);
  });

  it('la VENTA no ofrece motivos; INGRESO y AJUSTE sí', () => {
    expect(MOTIVOS_POR_TIPO.VENTA).toEqual([]);
    expect(MOTIVOS_POR_TIPO.INGRESO).toContain('COMPRA');
    expect(MOTIVOS_POR_TIPO.AJUSTE).toContain('ROTURA');
  });
});
