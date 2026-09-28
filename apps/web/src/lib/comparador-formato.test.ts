import { compararInsumo, type CandidatoComparador } from '@inventariosmart/shared';
import { describe, expect, it } from 'vitest';
import {
  componentesPuntaje,
  formatearAhorro,
  formatearCosto,
  formatearDiferencia,
  formatearPlazo,
  formatearPuntaje,
  fraseConfirmarPrincipal,
  fraseRecomendacion,
  fraseTotales,
} from './comparador-formato';

const candidato = (
  nombre: string,
  costo: number,
  leadTimeDias: number,
  confiabilidad: number,
): CandidatoComparador => ({
  proveedorId: nombre.toLowerCase(),
  nombre,
  costo,
  leadTimeDias,
  confiabilidad,
  vigenteDesde: '2026-09-01T12:00:00.000Z',
});

const FILTRO = { id: 'p1', codigo: 'FA-220', nombre: 'Filtro Aire FA-220' };
const TRES = [
  candidato('Norte', 2340, 5, 3),
  candidato('Sur', 2000, 7, 4),
  candidato('Este', 2100, 2, 5),
];

describe('textos del comparador', () => {
  it('cuenta los totales en una frase', () => {
    expect(fraseTotales({ comparables: 23, conCambio: 4, ahorroEstimado: '86400.00' })).toBe(
      'Conviene cambiar de proveedor en 4 de 23 insumos: ahorrarías unos $ 86.400 por mes.',
    );
    expect(fraseTotales({ comparables: 1, conCambio: 1, ahorroEstimado: '0.00' })).toBe(
      'Conviene cambiar de proveedor en 1 de 1 insumo.',
    );
    expect(fraseTotales({ comparables: 5, conCambio: 0, ahorroEstimado: '0.00' })).toBe(
      'Ya le comprás al proveedor recomendado en tus 5 insumos con más de un proveedor.',
    );
    expect(fraseTotales({ comparables: 1, conCambio: 0, ahorroEstimado: '0.00' })).toBe(
      'Ya le comprás al proveedor recomendado en tu único insumo con más de un proveedor.',
    );
    expect(fraseTotales({ comparables: 0, conCambio: 0, ahorroEstimado: '0.00' })).toBe(
      'Todavía no hay insumos con dos o más proveedores.',
    );
  });

  it('formatea costos, ahorro, puntaje, diferencia y plazo', () => {
    expect(formatearCosto('2100.00')).toBe('$ 2.100,00');
    expect(formatearAhorro('14400.00')).toBe('$ 14.400 por mes');
    expect(formatearAhorro(null)).toBe('—');
    expect(formatearPuntaje('97.14')).toBe('97,1');
    expect(formatearPuntaje('100.00')).toBe('100');
    expect(formatearDiferencia('0.00')).toBe('El más barato');
    expect(formatearDiferencia('17.00')).toBe('17 % más caro');
    expect(formatearDiferencia('5.26')).toBe('5,3 % más caro');
    expect(formatearPlazo(0)).toBe('Entrega en el día');
    expect(formatearPlazo(1)).toBe('Entrega en 1 día');
    expect(formatearPlazo(7)).toBe('Entrega en 7 días');
  });

  it('explica qué conviene hacer con un insumo', () => {
    expect(fraseRecomendacion(compararInsumo(FILTRO, TRES, 'norte', 60))).toBe(
      'Te conviene Este en lugar de Norte: ahorrarías unos $ 14.400 por mes.',
    );
    expect(fraseRecomendacion(compararInsumo(FILTRO, TRES, 'norte', 0))).toBe(
      'Te conviene Este en lugar de Norte, por el puntaje.',
    );
    expect(fraseRecomendacion(compararInsumo(FILTRO, TRES, 'este', 60))).toBe(
      'Este es el recomendado y ya es tu proveedor principal.',
    );
    expect(fraseRecomendacion(compararInsumo(FILTRO, TRES, null, 60))).toBe(
      'Te conviene Este. Este insumo no tiene un proveedor principal que se pueda comparar.',
    );
    expect(fraseRecomendacion(compararInsumo(FILTRO, [TRES[0]!], 'norte', 60))).toBe(
      'Sólo Norte tiene un costo cargado: hace falta otro proveedor para comparar.',
    );
    expect(fraseRecomendacion(compararInsumo(FILTRO, [], null, 60))).toBe(
      'Ningún proveedor activo tiene un costo cargado para este insumo.',
    );
  });

  it('desarma el puntaje en sus tres componentes (RN-13)', () => {
    const este = compararInsumo(FILTRO, TRES, 'norte', 60).proveedores[0]!;
    expect(este.proveedor.nombre).toBe('Este');
    const partes = componentesPuntaje(este);
    expect(partes.map((p) => [p.etiqueta, p.peso, p.valor, p.aporte])).toEqual([
      ['Precio', 60, 95.24, 57.1],
      ['Plazo', 25, 100, 25],
      ['Confiabilidad', 15, 100, 15],
    ]);
    // Lo que aporta cada componente suma el puntaje (97,14), salvo el redondeo.
    const suma = partes.reduce((acc, p) => acc + p.aporte, 0);
    expect(Math.abs(suma - Number(este.puntaje))).toBeLessThan(0.15);
  });

  it('avisa que cambia el costo de reposición al usar un proveedor como principal', () => {
    expect(fraseConfirmarPrincipal('Filtro Aire FA-220', 'Este', '2100.00')).toBe(
      'Este pasa a ser el proveedor principal de Filtro Aire FA-220 y el costo de reposición del producto pasa a $ 2.100,00.',
    );
  });
});
