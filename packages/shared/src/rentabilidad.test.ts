import { describe, expect, it } from 'vitest';
import {
  RentabilidadQuerySchema,
  margenBruto,
  margenNeto,
  porcentaje,
  precioNeto,
  redondear2,
} from './rentabilidad';

describe('reglas de HU-03 (rentabilidad)', () => {
  it('RN-03: el precio neto sale del precio con IVA y la alícuota del producto (CP-03.1, CP-03.3)', () => {
    expect(precioNeto('12100.00', '21')).toBe('10000.00');
    expect(precioNeto(1105, 10.5)).toBe('1000.00');
    expect(precioNeto('3900.00', '21')).toBe('3223.14');
    expect(precioNeto('100', '0')).toBe('100.00');
  });

  it('RN-01: margen bruto en pesos y porcentaje sobre el precio neto', () => {
    expect(margenBruto('10000.00', '6000.00')).toBe('4000.00');
    expect(porcentaje('4000.00', '10000.00')).toBe('40.00');
    expect(margenBruto('1000.00', '800.00')).toBe('200.00');
    expect(porcentaje('200.00', '1000.00')).toBe('20.00');
    // CP-03.4: precio 14520 con IVA 21 → 12000 neto; costo 7000 → 5000 (41,67 %).
    expect(porcentaje(margenBruto(precioNeto(14520, 21), 7000), 12000)).toBe('41.67');
  });

  it('CP-03.1b: margen negativo y precio cero', () => {
    expect(margenBruto('1000.00', '1500.00')).toBe('-500.00');
    expect(porcentaje('-500.00', '1000.00')).toBe('-50.00');
    expect(margenBruto('0.00', '600.00')).toBe('-600.00');
    expect(porcentaje('-600.00', '0.00')).toBeNull();
  });

  it('RN-02: margen neto = bruto − gasto por unidad, o null si no es calculable (CP-03.2)', () => {
    expect(margenNeto('4000.00', '2000.00')).toBe('2000.00');
    expect(porcentaje(margenNeto('4000.00', '2000.00')!, '10000.00')).toBe('20.00');
    expect(margenNeto('4000.00', null)).toBeNull();
    expect(margenNeto('1000.00', '2500.00')).toBe('-1500.00');
  });

  it('redondear2 evita los errores clásicos de coma flotante', () => {
    expect(redondear2(1.005)).toBe('1.01');
    expect(redondear2(2.675)).toBe('2.68');
    expect(redondear2(0.1 + 0.2)).toBe('0.30');
  });

  it('RentabilidadQuerySchema', () => {
    expect(RentabilidadQuerySchema.parse({})).toEqual({ limit: 25 });
    expect(RentabilidadQuerySchema.parse({ periodo: '2026-09', q: ' fa ', limit: '5' })).toEqual({
      periodo: '2026-09',
      q: 'fa',
      limit: 5,
    });
    expect(RentabilidadQuerySchema.safeParse({ periodo: '2026-13' }).success).toBe(false);
  });
});
