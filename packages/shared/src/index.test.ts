import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  LIMITES_PLAN,
  PLANES,
  PlanSchema,
  ROLES,
  RolSchema,
  planCumple,
} from './index';

describe('RolSchema', () => {
  it('acepta los tres roles definidos en la Propuesta §2.4', () => {
    expect(ROLES).toEqual(['DUENIO', 'EMPLEADO', 'CONTADOR']);
    for (const rol of ROLES) expect(RolSchema.parse(rol)).toBe(rol);
  });

  it('rechaza un rol inexistente', () => {
    expect(() => RolSchema.parse('ADMIN')).toThrow();
  });
});

describe('PlanSchema y límites', () => {
  it('acepta FREE, PRO y PREMIUM', () => {
    expect(PLANES).toEqual(['FREE', 'PRO', 'PREMIUM']);
    for (const plan of PLANES) expect(PlanSchema.parse(plan)).toBe(plan);
  });

  it('el plan FREE limita a 50 productos y 1 usuario (HU-14)', () => {
    expect(LIMITES_PLAN.FREE).toEqual({ productos: 50, usuarios: 1 });
    expect(LIMITES_PLAN.PRO.productos).toBeNull();
    expect(LIMITES_PLAN.PREMIUM.usuarios).toBeNull();
  });

  it('planCumple compara por jerarquía FREE < PRO < PREMIUM', () => {
    expect(planCumple('FREE', 'FREE')).toBe(true);
    expect(planCumple('FREE', 'PRO')).toBe(false);
    expect(planCumple('PRO', 'PRO')).toBe(true);
    expect(planCumple('PREMIUM', 'PRO')).toBe(true);
    expect(planCumple('PRO', 'PREMIUM')).toBe(false);
  });
});

describe('ApiErrorSchema', () => {
  it('exige code y message; details es opcional', () => {
    expect(ApiErrorSchema.parse({ code: 'NO_AUTENTICADO', message: 'Sesión inválida' })).toEqual({
      code: 'NO_AUTENTICADO',
      message: 'Sesión inválida',
    });
    expect(() => ApiErrorSchema.parse({ code: 'X' })).toThrow();
  });
});
