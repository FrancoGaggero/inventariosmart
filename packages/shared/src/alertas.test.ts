import { describe, expect, it } from 'vitest';
import {
  AlertaAccionSchema,
  AlertasQuerySchema,
  calculoVencido,
  cantidadSugerida,
  diasCobertura,
  evaluarReposicion,
  puntoReposicion,
  umbralAlerta,
  velocidadDiaria,
} from './alertas';
import { LEAD_TIME_DEFAULT } from './proveedores';

describe('RN-04 (HU-06)', () => {
  it('CP-06.1: velocidad, punto de reposición, umbral, cobertura y sugerido', () => {
    // 60 unidades en 30 días, lead time 5, seguridad 4, anticipación 3, stock 18.
    expect(velocidadDiaria(60)).toBe(2);
    expect(puntoReposicion(2, 5, 4)).toBe(14);
    expect(umbralAlerta(2, 5, 3, 4)).toBe(20);
    expect(diasCobertura(18, 2)).toBe(9);
    expect(cantidadSugerida(2, 5, 18, 4)).toBe(56);
    const e = evaluarReposicion({
      stock: 18,
      unidades30d: 60,
      leadTimeDias: 5,
      stockSeguridad: 4,
      diasAnticipacion: 3,
    });
    expect(e).toMatchObject({
      enAlerta: true,
      severidad: 'PROXIMA',
      velocidadDiaria: 2,
      diasCobertura: 9,
      puntoReposicion: 14,
      umbral: 20,
      leadTimeDias: 5,
      cantidadSugerida: 56,
    });
  });

  it('CP-06.2b: por debajo del punto de reposición es CRITICA', () => {
    const e = evaluarReposicion({
      stock: 10,
      unidades30d: 60,
      leadTimeDias: 5,
      stockSeguridad: 4,
      diasAnticipacion: 3,
    });
    expect(e.severidad).toBe('CRITICA');
    expect(e.diasCobertura).toBe(5);
  });

  it('CP-06.1b: sin ventas no hay alerta ni cobertura', () => {
    const e = evaluarReposicion({
      stock: 2,
      unidades30d: 0,
      leadTimeDias: 5,
      stockSeguridad: 5,
      diasAnticipacion: 3,
    });
    expect(e).toMatchObject({
      enAlerta: false,
      severidad: null,
      velocidadDiaria: 0,
      diasCobertura: null,
      cantidadSugerida: 0,
    });
    expect(e.puntoReposicion).toBe(5);
  });

  it('CP-06.1d: sin proveedor principal usa 7 días de lead time', () => {
    const e = evaluarReposicion({
      stock: 100,
      unidades30d: 30,
      leadTimeDias: null,
      stockSeguridad: 0,
      diasAnticipacion: 3,
    });
    expect(e.leadTimeDias).toBe(LEAD_TIME_DEFAULT);
    expect(e.puntoReposicion).toBe(7);
    expect(e.enAlerta).toBe(false);
  });

  it('CP-06.4: la anticipación mueve el umbral', () => {
    const base = { stock: 18, unidades30d: 60, leadTimeDias: 5, stockSeguridad: 4 };
    expect(evaluarReposicion({ ...base, diasAnticipacion: 0 })).toMatchObject({
      umbral: 14,
      enAlerta: false,
    });
    expect(evaluarReposicion({ ...base, diasAnticipacion: 10 })).toMatchObject({
      umbral: 34,
      enAlerta: true,
    });
  });

  it('redondea hacia arriba con velocidades fraccionarias', () => {
    expect(velocidadDiaria(7)).toBe(0.233);
    expect(puntoReposicion(0.233, 5, 0)).toBe(2);
    expect(umbralAlerta(0.233, 5, 3, 1)).toBe(3);
    expect(diasCobertura(1, 0.233)).toBe(4);
    expect(cantidadSugerida(0.233, 5, 1, 1)).toBe(9);
  });

  it('calculoVencido: nunca calculado o más de una hora', () => {
    const ahora = new Date('2026-09-25T10:00:00Z');
    expect(calculoVencido(null, ahora)).toBe(true);
    expect(calculoVencido(new Date('2026-09-25T09:30:00Z'), ahora)).toBe(false);
    expect(calculoVencido('2026-09-25T08:59:00Z', ahora)).toBe(true);
  });

  it('esquemas de consulta y acción', () => {
    expect(AlertasQuerySchema.parse({})).toEqual({ estado: 'ACTIVA', limit: 25 });
    expect(AlertasQuerySchema.parse({ estado: 'TODAS', limit: '10' }).limit).toBe(10);
    expect(AlertaAccionSchema.safeParse({ accion: 'BORRAR' }).success).toBe(false);
    expect(AlertaAccionSchema.parse({ accion: 'POSPONER' }).accion).toBe('POSPONER');
  });
});
