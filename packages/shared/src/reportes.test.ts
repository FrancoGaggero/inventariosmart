import { describe, expect, it } from 'vitest';
import {
  AjustesReportesPatchSchema,
  type FilaOportunidad,
  GenerarReporteSchema,
  MAX_OPORTUNIDADES,
  SemanaSchema,
  capitalInmovilizado,
  diasDeSemana,
  margenBajo,
  mesDeSemana,
  oportunidadesCompra,
  rangoSemana,
  semanaAnterior,
  semanaDe,
  semanasDelAnio,
  ultimaSemanaCerrada,
} from './reportes';

describe('semana ISO en Buenos Aires (HU-09, design D1)', () => {
  it('el lunes 29/12/2025 ya es la semana 1 de 2026 y el domingo 4/1/2026 también', () => {
    expect(semanaDe(new Date('2025-12-29T03:00:00Z'))).toBe('2026-W01');
    expect(semanaDe(new Date('2026-01-04T23:00:00-03:00'))).toBe('2026-W01');
    expect(semanaDe(new Date('2026-01-05T00:00:00-03:00'))).toBe('2026-W02');
  });

  it('el límite del día es la medianoche de Buenos Aires, no la de UTC', () => {
    // Domingo 20/9 23:30 en Buenos Aires = lunes 21/9 02:30 UTC: sigue siendo la W38.
    expect(semanaDe(new Date('2026-09-21T02:30:00Z'))).toBe('2026-W38');
    expect(semanaDe(new Date('2026-09-21T03:00:00Z'))).toBe('2026-W39');
  });

  it('rango, días civiles, semana anterior y mes de gastos', () => {
    const r = rangoSemana('2026-W38');
    expect(r.desde.toISOString()).toBe('2026-09-14T03:00:00.000Z');
    expect(r.hasta.toISOString()).toBe('2026-09-21T03:00:00.000Z');
    expect(diasDeSemana('2026-W38')).toEqual({ lunes: '2026-09-14', domingo: '2026-09-20' });
    expect(semanaAnterior('2026-W38')).toBe('2026-W37');
    expect(semanaAnterior('2026-W01')).toBe('2025-W52');
    // La W40 de 2026 va del 28/9 al 4/10: el gasto por unidad es el de octubre.
    expect(mesDeSemana('2026-W40')).toBe('2026-10');
    expect(mesDeSemana('2026-W38')).toBe('2026-09');
  });

  it('última semana cerrada y semanas del año', () => {
    expect(ultimaSemanaCerrada(new Date('2026-09-24T15:00:00Z'))).toBe('2026-W38');
    expect(semanasDelAnio(2026)).toBe(53);
    expect(semanasDelAnio(2025)).toBe(52);
  });

  it('el esquema rechaza semanas inexistentes', () => {
    expect(SemanaSchema.safeParse('2026-W38').success).toBe(true);
    expect(SemanaSchema.safeParse('2026-W60').success).toBe(false);
    expect(SemanaSchema.safeParse('2025-W53').success).toBe(false);
    expect(SemanaSchema.safeParse('2026-38').success).toBe(false);
    expect(GenerarReporteSchema.parse({})).toEqual({ enviar: false });
  });
});

const producto = (codigo: string) => ({
  id: `00000000-0000-4000-8000-0000000000${codigo.length === 1 ? '0' + codigo : codigo}`.slice(
    0,
    36,
  ),
  codigo,
  nombre: `Producto ${codigo}`,
});

const base: FilaOportunidad = {
  producto: { id: '6f1e2d3c-4b5a-4c6d-8e7f-90a1b2c3d4e5', codigo: 'FA-220', nombre: 'Filtro' },
  costoActual: '2340.00',
  proveedorActual: { id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', nombre: 'Norte' },
  costoMinimoOtro: '2000.00',
  proveedorMinimo: { id: '2a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', nombre: 'Sur' },
  unidades30d: 60,
  stock: 10,
  unidadesSemana: 30,
  ventasNetasSemana: '96694.20',
  precioNeto: '3223.14',
};

describe('oportunidades de ahorro (HU-09 criterio 2)', () => {
  it('CP-09.2: comprar más barato con ahorro = diferencia × unidades de 30 días', () => {
    const r = oportunidadesCompra([base]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({
      proveedorActual: 'Norte',
      proveedorSugerido: 'Sur',
      costoActual: '2340.00',
      costoSugerido: '2000.00',
      ahorroEstimado: '20400.00',
    });
    expect(r.total).toBe('20400.00');
    // Sin ventas en 30 días o sin otro proveedor más barato no hay oportunidad.
    expect(oportunidadesCompra([{ ...base, unidades30d: 0 }]).items).toHaveLength(0);
    expect(oportunidadesCompra([{ ...base, costoMinimoOtro: '2340.00' }]).items).toHaveLength(0);
    expect(
      oportunidadesCompra([{ ...base, costoMinimoOtro: null, proveedorMinimo: null }]).items,
    ).toHaveLength(0);
  });

  it('CP-09.2b: capital inmovilizado y margen bajo', () => {
    const zz: FilaOportunidad = {
      ...base,
      producto: { ...base.producto, codigo: 'ZZ-1' },
      costoActual: '500.00',
      stock: 20,
      unidades30d: 0,
      unidadesSemana: 0,
      ventasNetasSemana: '0.00',
    };
    const lb: FilaOportunidad = {
      ...base,
      producto: { ...base.producto, codigo: 'LB-1' },
      costoActual: '900.00',
      precioNeto: '1000.00',
      unidadesSemana: 3,
      ventasNetasSemana: '3000.00',
    };
    const ok: FilaOportunidad = { ...base, costoActual: '800.00', precioNeto: '1000.00' };
    expect(capitalInmovilizado([zz, lb, ok])).toEqual({
      items: [{ producto: zz.producto, stock: 20, costoActual: '500.00', monto: '10000.00' }],
      total: '10000.00',
    });
    const mb = margenBajo([zz, lb, ok]);
    expect(mb.items).toHaveLength(1);
    expect(mb.items[0]).toMatchObject({
      producto: { codigo: 'LB-1' },
      margenBrutoPct: '10.00',
      unidadesSemana: 3,
      monto: '3000.00',
    });
  });

  it('CP-09.2c: sin oportunidades, listas vacías con total 0.00', () => {
    const sano: FilaOportunidad = {
      ...base,
      costoMinimoOtro: null,
      proveedorMinimo: null,
      costoActual: '800.00',
      precioNeto: '1000.00',
    };
    expect(oportunidadesCompra([sano])).toEqual({ items: [], total: '0.00' });
    expect(capitalInmovilizado([sano])).toEqual({ items: [], total: '0.00' });
    expect(margenBajo([sano])).toEqual({ items: [], total: '0.00' });
  });

  it('las listas se ordenan por monto y se cortan a 5, el total suma todo', () => {
    const filas: FilaOportunidad[] = Array.from({ length: 7 }, (_, i) => ({
      ...base,
      producto: producto(String(i + 1)),
      stock: i + 1,
      costoActual: '100.00',
      unidades30d: 0,
      unidadesSemana: 0,
    }));
    const r = capitalInmovilizado(filas);
    expect(r.items).toHaveLength(MAX_OPORTUNIDADES);
    expect(r.items[0]!.monto).toBe('700.00');
    expect(r.total).toBe('2800.00');
  });
});

describe('ajustes del reporte (CP-09.5)', () => {
  it('acepta hasta 5 correos válidos y únicos', () => {
    expect(
      AjustesReportesPatchSchema.safeParse({ destinatariosExtra: ['contadora@ejemplo.test'] })
        .success,
    ).toBe(true);
    expect(AjustesReportesPatchSchema.safeParse({}).success).toBe(false);
    const seis = Array.from({ length: 6 }, (_, i) => `p${i}@ejemplo.test`);
    expect(AjustesReportesPatchSchema.safeParse({ destinatariosExtra: seis }).success).toBe(false);
    expect(
      AjustesReportesPatchSchema.safeParse({ destinatariosExtra: ['a@b.test', 'A@b.test'] })
        .success,
    ).toBe(false);
    expect(
      AjustesReportesPatchSchema.safeParse({ destinatariosExtra: ['no-es-mail'] }).success,
    ).toBe(false);
  });
});
