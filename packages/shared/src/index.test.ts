import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  ComercioPatchSchema,
  InvitacionSchema,
  LIMITES_PLAN,
  OnboardingSchema,
  PLANES,
  PlanSchema,
  ROLES,
  RolSchema,
  UsuarioPatchSchema,
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

describe('esquemas de HU-11', () => {
  it('OnboardingSchema recorta y exige 2 a 120 caracteres', () => {
    expect(OnboardingSchema.parse({ nombreComercio: '  Repuestos Carlos ' })).toEqual({
      nombreComercio: 'Repuestos Carlos',
    });
    expect(() => OnboardingSchema.parse({ nombreComercio: ' ' })).toThrow();
    expect(() => OnboardingSchema.parse({ nombreComercio: 'x'.repeat(121) })).toThrow();
  });

  it('ComercioPatchSchema valida CUIT de 11 dígitos, IVA entre 0 y 100 y al menos un campo', () => {
    expect(ComercioPatchSchema.parse({ cuit: '20123456789', ivaDefault: 10.5 })).toEqual({
      cuit: '20123456789',
      ivaDefault: 10.5,
    });
    expect(ComercioPatchSchema.parse({ cuit: null })).toEqual({ cuit: null });
    expect(() => ComercioPatchSchema.parse({ cuit: '20-12345678-9' })).toThrow();
    expect(() => ComercioPatchSchema.parse({ ivaDefault: 101 })).toThrow();
    expect(() => ComercioPatchSchema.parse({})).toThrow();
  });

  it('InvitacionSchema normaliza el email a minúsculas y exige un rol válido', () => {
    expect(InvitacionSchema.parse({ email: ' Ana@Comercio.com ', rol: 'EMPLEADO' })).toEqual({
      email: 'ana@comercio.com',
      rol: 'EMPLEADO',
    });
    expect(() => InvitacionSchema.parse({ email: 'no-es-email', rol: 'EMPLEADO' })).toThrow();
    expect(() => InvitacionSchema.parse({ email: 'ana@comercio.com', rol: 'JEFE' })).toThrow();
  });

  it('UsuarioPatchSchema exige rol o activo', () => {
    expect(UsuarioPatchSchema.parse({ activo: false })).toEqual({ activo: false });
    expect(UsuarioPatchSchema.parse({ rol: 'CONTADOR' })).toEqual({ rol: 'CONTADOR' });
    expect(() => UsuarioPatchSchema.parse({})).toThrow();
  });
});
