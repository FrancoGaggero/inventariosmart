import { describe, expect, it } from 'vitest';
import {
  ImportacionConfirmSchema,
  PreciosCreateSchema,
  ProveedorCreateSchema,
  ProveedorPatchSchema,
  ProveedoresQuerySchema,
  filasAplicables,
  resumirVistaPrevia,
  type FilaVistaPrevia,
} from './proveedores';
import { ProductoPatchSchema } from './productos';

const uuid = (n: number) => `3f1c2a9e-5b6d-4c7e-8f90-1a2b3c4d5e6${n}`;
const camposDe = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : (r.error?.issues ?? []).map((i) => String(i.path[0]));

describe('esquemas de HU-02 (proveedores y listas de precios)', () => {
  it('ProveedorCreateSchema aplica defaults y normaliza vacíos', () => {
    const r = ProveedorCreateSchema.parse({ nombre: ' Distribuidora Norte ', email: '', cuit: '' });
    expect(r).toEqual({
      nombre: 'Distribuidora Norte',
      email: null,
      cuit: null,
      leadTimeDias: 7,
      confiabilidad: 3,
    });
  });

  it('CP-02.1d datos inválidos nombran cada campo', () => {
    const r = ProveedorCreateSchema.safeParse({
      nombre: '',
      email: 'no-es-email',
      leadTimeDias: -1,
      confiabilidad: 6,
      cuit: '12-3',
    });
    expect(camposDe(r).sort()).toEqual([
      'confiabilidad',
      'cuit',
      'email',
      'leadTimeDias',
      'nombre',
    ]);
  });

  it('CP-02.3 la confiabilidad va de 1 a 5 y el patch exige algún campo', () => {
    expect(ProveedorPatchSchema.parse({ confiabilidad: 5 })).toEqual({ confiabilidad: 5 });
    expect(camposDe(ProveedorPatchSchema.safeParse({ confiabilidad: 0 }))).toEqual([
      'confiabilidad',
    ]);
    expect(() => ProveedorPatchSchema.parse({})).toThrow();
    expect(ProveedorPatchSchema.parse({ activo: true, leadTimeDias: 12 })).toEqual({
      activo: true,
      leadTimeDias: 12,
    });
  });

  it('ProveedoresQuerySchema convierte activo y limit', () => {
    expect(ProveedoresQuerySchema.parse({})).toEqual({ activo: true, limit: 25 });
    expect(ProveedoresQuerySchema.parse({ activo: 'false', limit: '5', q: ' nor ' })).toEqual({
      activo: false,
      limit: 5,
      q: 'nor',
    });
  });

  it('CP-02.4 la carga manual normaliza montos y rechaza repetidos o fechas futuras', () => {
    const ok = PreciosCreateSchema.parse({ items: [{ productoId: uuid(1), costoNeto: '2100' }] });
    expect(ok.items[0]?.costoNeto).toBe('2100.00');
    const repetido = PreciosCreateSchema.safeParse({
      items: [
        { productoId: uuid(1), costoNeto: 1 },
        { productoId: uuid(1), costoNeto: 2 },
      ],
    });
    expect(camposDe(repetido)).toEqual(['items']);
    const futura = PreciosCreateSchema.safeParse({
      items: [{ productoId: uuid(1), costoNeto: 1 }],
      vigenteDesde: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(camposDe(futura)).toEqual(['vigenteDesde']);
    expect(camposDe(PreciosCreateSchema.safeParse({ items: [] }))).toEqual(['items']);
  });

  it('ImportacionConfirmSchema acepta hasta 5000 filas sin repetidos', () => {
    expect(
      ImportacionConfirmSchema.parse({ items: [{ productoId: uuid(2), costoNeto: 10 }] }).items,
    ).toHaveLength(1);
    expect(camposDe(ImportacionConfirmSchema.safeParse({ items: [] }))).toEqual(['items']);
  });

  it('resumirVistaPrevia y filasAplicables', () => {
    const filas: FilaVistaPrevia[] = [
      {
        fila: 1,
        codigo: 'FA-220',
        costoNeto: '2340.00',
        estado: 'CAMBIA',
        productoId: uuid(1),
        nombre: 'Filtro',
        costoAnterior: '2100.00',
        error: null,
      },
      {
        fila: 2,
        codigo: 'AM-1L',
        costoNeto: '880.00',
        estado: 'NUEVO',
        productoId: uuid(2),
        nombre: 'Aceite',
        costoAnterior: null,
        error: null,
      },
      {
        fila: 3,
        codigo: 'ZZ-999',
        costoNeto: '100.00',
        estado: 'SIN_PRODUCTO',
        productoId: null,
        nombre: null,
        costoAnterior: null,
        error: null,
      },
      {
        fila: 4,
        codigo: 'FA-220',
        costoNeto: null,
        estado: 'INVALIDA',
        productoId: null,
        nombre: null,
        costoAnterior: null,
        error: 'Costo inválido',
      },
      {
        fila: 5,
        codigo: 'BI-09',
        costoNeto: '50.00',
        estado: 'IGUAL',
        productoId: uuid(3),
        nombre: 'Bujía',
        costoAnterior: '50.00',
        error: null,
      },
    ];
    expect(resumirVistaPrevia(filas)).toEqual({
      total: 5,
      nuevos: 1,
      cambios: 1,
      iguales: 1,
      sinProducto: 1,
      invalidas: 1,
    });
    expect(filasAplicables(filas)).toEqual([
      { productoId: uuid(1), costoNeto: '2340.00' },
      { productoId: uuid(2), costoNeto: '880.00' },
    ]);
  });

  it('ProductoPatchSchema admite proveedorPrincipalId (uuid o null)', () => {
    expect(ProductoPatchSchema.parse({ proveedorPrincipalId: uuid(1) })).toEqual({
      proveedorPrincipalId: uuid(1),
    });
    expect(ProductoPatchSchema.parse({ proveedorPrincipalId: null })).toEqual({
      proveedorPrincipalId: null,
    });
    expect(camposDe(ProductoPatchSchema.safeParse({ proveedorPrincipalId: 'x' }))).toEqual([
      'proveedorPrincipalId',
    ]);
  });
});
