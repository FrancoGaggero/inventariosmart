import { describe, expect, it } from 'vitest';
import {
  GastoCreateSchema,
  GastoPatchSchema,
  GastosQuerySchema,
  aplicaAlMes,
  importeDelMes,
  mesActual,
  prorratear,
  sumarMeses,
  totalizar,
  validarCoherencia,
} from './gastos';

const camposDe = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : (r.error?.issues ?? []).map((i) => String(i.path[0]));

const alquiler = {
  periodo: '2026-08',
  periodicidad: 'MENSUAL',
  fin: null,
  importe: '250000.00',
} as const;
const seguro = {
  periodo: '2026-09',
  periodicidad: 'ANUAL',
  fin: null,
  importe: '120000.00',
} as const;
const comisiones = {
  periodo: '2026-09',
  periodicidad: 'UNICO',
  fin: null,
  importe: '30000.00',
} as const;
const flete = { periodo: '2026-08', periodicidad: 'UNICO', fin: null, importe: '8000.00' } as const;

describe('esquemas y reglas de HU-13 (gastos)', () => {
  it('sumarMeses y mesActual', () => {
    expect(sumarMeses('2026-09', 3)).toBe('2026-12');
    expect(sumarMeses('2026-09', 4)).toBe('2027-01');
    expect(sumarMeses('2026-01', -1)).toBe('2025-12');
    expect(mesActual(new Date(2026, 8, 24))).toBe('2026-09');
  });

  it('CP-13.2 aplicabilidad por mes: único, mensual y anual', () => {
    expect(aplicaAlMes(alquiler, '2026-09')).toBe(true);
    expect(aplicaAlMes(alquiler, '2026-07')).toBe(false);
    expect(aplicaAlMes(seguro, '2026-09')).toBe(true);
    expect(aplicaAlMes(seguro, '2027-08')).toBe(true);
    expect(aplicaAlMes(seguro, '2027-09')).toBe(false);
    expect(aplicaAlMes(comisiones, '2026-09')).toBe(true);
    expect(aplicaAlMes(comisiones, '2026-10')).toBe(false);
    expect(aplicaAlMes(flete, '2026-09')).toBe(false);
  });

  it('CP-13.2b recurrente con fin', () => {
    const g = {
      periodo: '2026-06',
      periodicidad: 'MENSUAL',
      fin: '2026-08',
      importe: '1.00',
    } as const;
    expect(aplicaAlMes(g, '2026-07')).toBe(true);
    expect(aplicaAlMes(g, '2026-08')).toBe(true);
    expect(aplicaAlMes(g, '2026-09')).toBe(false);
  });

  it('importeDelMes y totales del mes (CP-13.2)', () => {
    expect(importeDelMes(alquiler)).toBe('250000.00');
    expect(importeDelMes(seguro)).toBe('10000.00');
    expect(
      totalizar([
        { tipo: 'FIJO', importeMes: importeDelMes(alquiler) },
        { tipo: 'FIJO', importeMes: importeDelMes(seguro) },
        { tipo: 'VARIABLE', importeMes: importeDelMes(comisiones) },
      ]),
    ).toEqual({ fijos: '260000.00', variables: '30000.00', total: '290000.00' });
  });

  it('CP-13.3, CP-13.5, CP-13.5b prorrateo', () => {
    expect(prorratear('290000.00', 145)).toEqual({ gastoPorUnidad: '2000.00', motivo: null });
    expect(prorratear('0.00', 145)).toEqual({ gastoPorUnidad: null, motivo: 'SIN_GASTOS' });
    expect(prorratear('290000.00', 0)).toEqual({ gastoPorUnidad: null, motivo: 'SIN_VENTAS' });
    expect(prorratear('0.00', 0)).toEqual({ gastoPorUnidad: null, motivo: 'SIN_GASTOS' });
  });

  it('CP-13.1 alta válida y CP-13.1c datos inválidos', () => {
    const ok = GastoCreateSchema.parse({
      concepto: ' Alquiler ',
      tipo: 'FIJO',
      importe: 250000,
      periodo: '2026-09',
      periodicidad: 'MENSUAL',
    });
    expect(ok).toMatchObject({ concepto: 'Alquiler', importe: '250000.00' });
    const r = GastoCreateSchema.safeParse({
      concepto: '',
      tipo: 'OTRO',
      importe: 0,
      periodo: 'septiembre',
      periodicidad: 'SEMANAL',
    });
    expect(camposDe(r).sort()).toEqual(['concepto', 'importe', 'periodicidad', 'periodo', 'tipo']);
    const finAnterior = GastoCreateSchema.safeParse({
      concepto: 'Alquiler',
      tipo: 'FIJO',
      importe: 1,
      periodo: '2026-09',
      periodicidad: 'MENSUAL',
      fin: '2026-08',
    });
    expect(camposDe(finAnterior)).toEqual(['fin']);
    const unicoConFin = GastoCreateSchema.safeParse({
      concepto: 'Flete',
      tipo: 'VARIABLE',
      importe: 1,
      periodo: '2026-09',
      periodicidad: 'UNICO',
      fin: '2026-10',
    });
    expect(camposDe(unicoConFin)).toEqual(['fin']);
  });

  it('GastoPatchSchema exige algún campo; validarCoherencia combina valores', () => {
    expect(() => GastoPatchSchema.parse({})).toThrow();
    expect(GastoPatchSchema.parse({ fin: null })).toEqual({ fin: null });
    expect(
      validarCoherencia({ periodicidad: 'MENSUAL', periodo: '2026-09', fin: null }),
    ).toBeNull();
    expect(
      validarCoherencia({ periodicidad: 'UNICO', periodo: '2026-09', fin: '2026-10' }),
    ).toMatch(/único/);
    expect(
      validarCoherencia({ periodicidad: 'ANUAL', periodo: '2026-09', fin: '2026-08' }),
    ).toMatch(/anterior/);
  });

  it('GastosQuerySchema valida el mes (CP-13.2c)', () => {
    expect(GastosQuerySchema.parse({ periodo: '2026-09', tipo: 'VARIABLE' })).toEqual({
      periodo: '2026-09',
      tipo: 'VARIABLE',
    });
    expect(camposDe(GastosQuerySchema.safeParse({ periodo: '2026-13' }))).toEqual(['periodo']);
  });
});
