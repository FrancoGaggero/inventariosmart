import { describe, expect, it } from 'vitest';
import {
  OrdenCreateSchema,
  OrdenPatchSchema,
  elegirProveedor,
  formatearNumeroOrden,
  subtotalItem,
  totalOrden,
} from './ordenes';

const norte = { proveedorId: 'norte', costo: 2340, leadTimeDias: 5, confiabilidad: 3 };
const sur = { proveedorId: 'sur', costo: 2000, leadTimeDias: 7, confiabilidad: 3 };

describe('HU-07 proveedor más conveniente', () => {
  it('CP-07.1: gana el menor costo vigente', () => {
    expect(elegirProveedor([norte, sur], 'norte')).toEqual({
      proveedorId: 'sur',
      costo: 2000,
      motivo: 'MENOR_COSTO',
    });
  });

  it('CP-07.1b: a igual costo gana el menor lead time', () => {
    expect(elegirProveedor([{ ...norte, costo: 2000 }, sur], null)).toMatchObject({
      proveedorId: 'norte',
      motivo: 'MENOR_LEAD_TIME',
    });
  });

  it('CP-07.1b: a igual costo y plazo gana la mayor confiabilidad', () => {
    const surConfiable = { ...sur, costo: 2340, leadTimeDias: 5, confiabilidad: 5 };
    expect(elegirProveedor([norte, surConfiable], 'norte')).toMatchObject({
      proveedorId: 'sur',
      motivo: 'MAYOR_CONFIABILIDAD',
    });
  });

  it('CP-07.1b: sin precios cargados usa el proveedor principal, sin costo', () => {
    expect(elegirProveedor([], 'este')).toEqual({
      proveedorId: 'este',
      costo: null,
      motivo: 'PROVEEDOR_PRINCIPAL',
    });
  });

  it('CP-07.1c: sin precios ni principal no hay proveedor', () => {
    expect(elegirProveedor([], null)).toBeNull();
  });

  it('el empate total se resuelve de forma determinista', () => {
    const a = { proveedorId: 'b', costo: 10, leadTimeDias: 1, confiabilidad: 3 };
    const b = { proveedorId: 'a', costo: 10, leadTimeDias: 1, confiabilidad: 3 };
    expect(elegirProveedor([a, b], null)?.proveedorId).toBe('a');
    expect(elegirProveedor([b, a], null)?.proveedorId).toBe('a');
  });
});

describe('HU-07 totales y numeración', () => {
  it('CP-07.2: total con dos decimales; los ítems sin costo no suman', () => {
    expect(
      totalOrden([
        { cantidad: 56, costoUnitarioNeto: '2000.00' },
        { cantidad: 3, costoUnitarioNeto: '0.10' },
        { cantidad: 9, costoUnitarioNeto: null },
      ]),
    ).toBe('112000.30');
    expect(totalOrden([])).toBe('0.00');
    expect(subtotalItem(56, '2000.00')).toBe('112000.00');
    expect(subtotalItem(5, null)).toBeNull();
  });

  it('CP-07.2b: OC-0001', () => {
    expect(formatearNumeroOrden(1)).toBe('OC-0001');
    expect(formatearNumeroOrden(12345)).toBe('OC-12345');
  });
});

describe('HU-07 esquemas', () => {
  const productoId = '6f1e2d3c-4b5a-4c6d-8e7f-90a1b2c3d4e5';
  const proveedorId = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

  it('CP-07.2c: sin ítems, cantidad 0 o productos repetidos es inválido', () => {
    expect(OrdenCreateSchema.safeParse({ proveedorId, items: [] }).success).toBe(false);
    expect(
      OrdenCreateSchema.safeParse({ proveedorId, items: [{ productoId, cantidad: 0 }] }).success,
    ).toBe(false);
    expect(
      OrdenCreateSchema.safeParse({
        proveedorId,
        items: [
          { productoId, cantidad: 1 },
          { productoId, cantidad: 2 },
        ],
      }).success,
    ).toBe(false);
    const ok = OrdenCreateSchema.safeParse({
      proveedorId,
      items: [{ productoId, cantidad: 56 }],
      notas: '  ',
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.notas).toBeNull();
  });

  it('CP-07.3b: el patch exige al menos un cambio', () => {
    expect(OrdenPatchSchema.safeParse({}).success).toBe(false);
    expect(OrdenPatchSchema.safeParse({ regenerarTexto: true }).success).toBe(true);
    expect(OrdenPatchSchema.safeParse({ texto: 'Hola Marta' }).success).toBe(true);
  });
});
