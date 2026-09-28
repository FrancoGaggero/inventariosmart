import { describe, expect, it } from 'vitest';
import {
  ahorroEstimado,
  ComparadorQuerySchema,
  compararInsumo,
  masBarato,
  puntuarProveedores,
  recomendado,
  type CandidatoComparador,
} from './comparador';

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const candidato = (
  n: number,
  nombre: string,
  costo: number,
  leadTimeDias: number,
  confiabilidad: number,
): CandidatoComparador => ({
  proveedorId: ID(n),
  nombre,
  costo,
  leadTimeDias,
  confiabilidad,
  vigenteDesde: '2026-09-01T12:00:00.000Z',
});

// CP-12.1: Norte es el principal; Sur es el más barato; Este entrega antes y es el más confiable.
const NORTE = candidato(1, 'Norte', 2340, 5, 3);
const SUR = candidato(2, 'Sur', 2000, 7, 4);
const ESTE = candidato(3, 'Este', 2100, 2, 5);
const FA220 = { id: ID(9), codigo: 'FA-220', nombre: 'Filtro de aire FA-220' };

describe('RN-13 puntaje del proveedor', () => {
  it('CP-12.1 y CP-12.2 tres proveedores para un insumo', () => {
    const r = puntuarProveedores([NORTE, SUR, ESTE], NORTE.proveedorId);
    expect(r.map((p) => p.proveedor.nombre)).toEqual(['Este', 'Sur', 'Norte']);
    expect(r[0]).toMatchObject({
      costoNeto: '2100.00',
      diferenciaPct: '5.00',
      puntajePrecio: '95.24',
      puntajePlazo: '100.00',
      puntajeConfiabilidad: '100.00',
      puntaje: '97.14',
      esPrincipal: false,
    });
    expect(r[1]).toMatchObject({
      diferenciaPct: '0.00',
      puntajePrecio: '100.00',
      puntajePlazo: '37.50',
      puntajeConfiabilidad: '80.00',
      puntaje: '81.38',
    });
    expect(r[2]).toMatchObject({
      diferenciaPct: '17.00',
      puntajePrecio: '85.47',
      puntajePlazo: '50.00',
      puntajeConfiabilidad: '60.00',
      puntaje: '72.78',
      esPrincipal: true,
    });
    expect(recomendado(r)?.proveedor.nombre).toBe('Este');
    expect(masBarato(r)?.proveedor.nombre).toBe('Sur');
  });

  it('CP-12.4 un costo nuevo cambia los puntajes', () => {
    const r = puntuarProveedores([{ ...NORTE, costo: 1700 }, SUR, ESTE]);
    expect(r.map((p) => [p.proveedor.nombre, p.puntaje])).toEqual([
      ['Este', '88.57'],
      ['Norte', '81.50'],
      ['Sur', '72.38'],
    ]);
    expect(masBarato(r)?.proveedor.nombre).toBe('Norte');
    expect(r[1]).toMatchObject({ costoNeto: '1700.00', diferenciaPct: '0.00' });
  });

  it('CP-12.2b entrega en el día', () => {
    const r = puntuarProveedores([candidato(1, 'A', 1000, 0, 3), candidato(2, 'B', 900, 3, 3)]);
    expect(r.map((p) => [p.proveedor.nombre, p.puntaje])).toEqual([
      ['A', '88.00'],
      ['B', '75.25'],
    ]);
  });

  it('CP-12.2b desempates: costo, plazo, confiabilidad y nombre', () => {
    const iguales = puntuarProveedores([
      candidato(2, 'D', 1000, 5, 3),
      candidato(1, 'C', 1000, 5, 3),
    ]);
    expect(iguales.map((p) => p.proveedor.nombre)).toEqual(['C', 'D']);
    expect(iguales[0]!.puntaje).toBe(iguales[1]!.puntaje);
  });

  it('CP-12.1b un solo proveedor se puntúa contra sí mismo', () => {
    const r = puntuarProveedores([NORTE]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      puntajePrecio: '100.00',
      puntajePlazo: '100.00',
      puntajeConfiabilidad: '60.00',
      puntaje: '94.00',
    });
  });

  it('un costo que no es positivo no participa', () => {
    const r = puntuarProveedores([candidato(1, 'Gratis', 0, 1, 5), SUR]);
    expect(r.map((p) => p.proveedor.nombre)).toEqual(['Sur']);
    expect(puntuarProveedores([])).toEqual([]);
    expect(recomendado([])).toBeNull();
    expect(masBarato([])).toBeNull();
  });
});

describe('ahorro estimado', () => {
  it('CP-12.3 diferencia de costo por las unidades de 30 días', () => {
    expect(ahorroEstimado('2340.00', '2100.00', 60)).toBe('14400.00');
  });

  it('CP-12.3b sin principal, sin ventas o sin ahorro no se informa', () => {
    expect(ahorroEstimado(null, '2100.00', 60)).toBeNull();
    expect(ahorroEstimado('2340.00', '2100.00', 0)).toBeNull();
    expect(ahorroEstimado('2000.00', '2100.00', 60)).toBeNull();
    expect(ahorroEstimado('2100.00', '2100.00', 60)).toBeNull();
  });
});

describe('comparación de un insumo', () => {
  it('CP-12.1 arma recomendado, más barato, principal y ahorro', () => {
    const c = compararInsumo(FA220, [NORTE, SUR, ESTE], NORTE.proveedorId, 60);
    expect(c).toMatchObject({
      producto: FA220,
      recomendado: { nombre: 'Este', costoNeto: '2100.00', puntaje: '97.14' },
      masBarato: { nombre: 'Sur', costoNeto: '2000.00' },
      principal: { nombre: 'Norte', costoNeto: '2340.00' },
      comparable: true,
      cambiaProveedor: true,
      unidades30d: 60,
      ahorroEstimado: '14400.00',
    });
  });

  it('el recomendado ya es el principal', () => {
    const c = compararInsumo(FA220, [NORTE, SUR, ESTE], ESTE.proveedorId, 60);
    expect(c).toMatchObject({ cambiaProveedor: false, ahorroEstimado: null });
  });

  it('CP-12.3b sin proveedor principal conviene elegir uno, sin ahorro estimado', () => {
    const c = compararInsumo(FA220, [SUR, ESTE], null, 60);
    expect(c).toMatchObject({ principal: null, cambiaProveedor: true, ahorroEstimado: null });
  });

  it('CP-12.1b con un proveedor o ninguno no es comparable', () => {
    expect(compararInsumo(FA220, [NORTE], NORTE.proveedorId, 10)).toMatchObject({
      comparable: false,
      cambiaProveedor: false,
      recomendado: { nombre: 'Norte', puntaje: '94.00' },
    });
    expect(compararInsumo(FA220, [], null, 10)).toMatchObject({
      proveedores: [],
      recomendado: null,
      masBarato: null,
      comparable: false,
      cambiaProveedor: false,
    });
  });
});

describe('ComparadorQuerySchema', () => {
  it('aplica los valores por defecto y lee el filtro', () => {
    expect(ComparadorQuerySchema.parse({})).toEqual({ soloOportunidades: false, limit: 25 });
    expect(
      ComparadorQuerySchema.parse({ soloOportunidades: 'true', limit: '10', q: ' filtro ' }),
    ).toEqual({ soloOportunidades: true, limit: 10, q: 'filtro' });
  });

  it('rechaza valores inválidos', () => {
    const campos = (v: unknown) =>
      ComparadorQuerySchema.safeParse(v).error?.issues.map((i) => i.path.join('.')) ?? [];
    expect(campos({ soloOportunidades: 'si' })).toEqual(['soloOportunidades']);
    expect(campos({ limit: '0' })).toEqual(['limit']);
  });
});
