import { describe, expect, it } from 'vitest';
import {
  DIA_MS,
  StockoutsQuerySchema,
  diasConStock,
  diasDe,
  estimarPerdida,
  ordenarQuiebres,
  recortarTramos,
  totalizarQuiebres,
  tramosSinStock,
  type EventoStock,
  type ProductoConQuiebres,
} from './quiebres';

const AHORA = new Date('2026-10-01T15:00:00.000Z');
const hace = (dias: number) => new Date(AHORA.getTime() - dias * DIA_MS);
const ev = (dias: number, stockResultante: number): EventoStock => ({
  instante: hace(dias),
  stockResultante,
});
const VENTANA = hace(90);

describe('quiebres de stock (RN-14)', () => {
  it('CP-18.1 un quiebre cerrado dura desde que quedó en 0 hasta que se repuso', () => {
    const tramos = tramosSinStock(20, [ev(30, 5), ev(12, 0), ev(7, 30)], VENTANA, AHORA);
    expect(tramos).toEqual([{ desde: hace(12), hasta: hace(7), enCurso: false }]);
    expect(diasDe(tramos)).toBeCloseTo(5, 6);
  });

  it('CP-18.1b un quiebre en curso cuenta hasta el momento de la consulta', () => {
    const tramos = tramosSinStock(10, [ev(4, 0)], VENTANA, AHORA);
    expect(tramos).toEqual([{ desde: hace(4), hasta: AHORA, enCurso: true }]);
  });

  it('CP-18.1c suma varios quiebres y recorta el que empezó antes del período', () => {
    const varios = tramosSinStock(5, [ev(14, 0), ev(11, 8), ev(7, 0), ev(5, 3)], VENTANA, AHORA);
    expect(varios).toHaveLength(2);
    expect(diasDe(recortarTramos(varios, hace(30), AHORA))).toBeCloseTo(5, 6);

    const antes = tramosSinStock(2, [ev(40, 0), ev(25, 10)], VENTANA, AHORA);
    const enPeriodo = recortarTramos(antes, hace(30), AHORA);
    expect(enPeriodo).toEqual([{ desde: hace(30), hasta: hace(25), enCurso: false }]);
    expect(diasDe(enPeriodo)).toBeCloseTo(5, 6);
    expect(
      recortarTramos(tramosSinStock(2, [ev(60, 0), ev(45, 4)], VENTANA, AHORA), hace(30), AHORA),
    ).toEqual([]);
  });

  it('CP-18.1d una venta anulada una hora después deja un quiebre de una hora', () => {
    const t = new Date(AHORA.getTime() - 3 * DIA_MS);
    const tramos = tramosSinStock(
      4,
      [
        { instante: t, stockResultante: 0 },
        { instante: new Date(t.getTime() + 60 * 60 * 1000), stockResultante: 4 },
      ],
      VENTANA,
      AHORA,
    );
    expect(tramos).toHaveLength(1);
    expect(diasDe(tramos)).toBeCloseTo(1 / 24, 6);
  });

  it('el cero previo al primer stock no es un quiebre; un ingreso o venta que deja stock no corta', () => {
    expect(tramosSinStock(0, [ev(20, 10), ev(10, 4)], VENTANA, AHORA, false)).toEqual([]);
    // Estuvo en 0 desde antes de la ventana: quiebre desde el inicio de la ventana.
    expect(tramosSinStock(0, [], VENTANA, AHORA, true)).toEqual([
      { desde: VENTANA, hasta: AHORA, enCurso: true },
    ]);
    expect(tramosSinStock(0, [], VENTANA, AHORA, false)).toEqual([]);
  });

  it('días con stock: el complemento, sin contar el tiempo antes del primer ingreso', () => {
    expect(diasConStock(20, [ev(12, 0), ev(7, 30)], VENTANA, AHORA)).toBeCloseTo(85, 6);
    expect(diasConStock(0, [ev(30, 50)], VENTANA, AHORA)).toBeCloseTo(30, 6);
  });
});

describe('estimación de la pérdida (RN-14, RN-01, RN-03)', () => {
  const base = { precioVenta: '1210.00', alicuotaIva: '21', costo: '600.00' };

  it('CP-18.2 la demanda sale de los días con stock', () => {
    expect(
      estimarPerdida({ ...base, diasSinStock: 5, diasConStock: 30, unidadesVendidas: 60 }),
    ).toEqual({
      demandaDiaria: '2.0',
      unidadesPerdidas: '10.0',
      ventaPerdida: '10000.00',
      gananciaPerdida: '4000.00',
      motivo: null,
    });
  });

  it('CP-18.2b sin historial suficiente no estima', () => {
    const sin = {
      demandaDiaria: null,
      unidadesPerdidas: null,
      ventaPerdida: null,
      gananciaPerdida: null,
      motivo: 'SIN_HISTORIAL',
    };
    expect(
      estimarPerdida({ ...base, diasSinStock: 5, diasConStock: 3, unidadesVendidas: 9 }),
    ).toEqual(sin);
    expect(
      estimarPerdida({ ...base, diasSinStock: 5, diasConStock: 20, unidadesVendidas: 0 }),
    ).toEqual(sin);
    expect(
      estimarPerdida({ ...base, diasSinStock: 5, diasConStock: 7, unidadesVendidas: 7 }).motivo,
    ).toBeNull();
  });

  it('redondea al final', () => {
    const r = estimarPerdida({ ...base, diasSinStock: 1.5, diasConStock: 9, unidadesVendidas: 10 });
    // 10 / 9 = 1,111… por día; 1,5 días = 1,666… unidades.
    expect(r).toMatchObject({
      demandaDiaria: '1.1',
      unidadesPerdidas: '1.7',
      ventaPerdida: '1666.67',
      gananciaPerdida: '666.67',
    });
  });
});

describe('lista de quiebres', () => {
  const item = (
    nombre: string,
    ganancia: string | null,
    dias: number,
    enCurso = false,
  ): ProductoConQuiebres => ({
    producto: { id: `00000000-0000-4000-8000-00000000000${nombre.length}`, codigo: nombre, nombre },
    quiebres: 1,
    diasSinStock: dias,
    enCurso,
    inicioUltimo: AHORA.toISOString(),
    demandaDiaria: ganancia === null ? null : '1.0',
    unidadesPerdidas: ganancia === null ? null : String(dias),
    ventaPerdida: ganancia === null ? null : '100.00',
    gananciaPerdida: ganancia,
    motivo: ganancia === null ? 'SIN_HISTORIAL' : null,
  });

  it('CP-18.3 ordena por ganancia perdida, con los no calculables al final, y totaliza', () => {
    const items = [
      item('A', '4000.00', 5),
      item('BB', null, 9, true),
      item('CCC', '9000.00', 2),
      item('DDDD', null, 3),
    ];
    expect(ordenarQuiebres(items).map((p) => p.producto.nombre)).toEqual([
      'CCC',
      'A',
      'BB',
      'DDDD',
    ]);
    expect(totalizarQuiebres(items)).toEqual({
      gananciaPerdida: '13000.00',
      ventaPerdida: '200.00',
      unidadesPerdidas: '7.0',
      productosAfectados: 4,
      enCurso: 1,
    });
    expect(totalizarQuiebres([])).toEqual({
      gananciaPerdida: '0.00',
      ventaPerdida: '0.00',
      unidadesPerdidas: '0.0',
      productosAfectados: 0,
      enCurso: 0,
    });
  });

  it('CP-18.3c sólo acepta 30, 60 o 90 días', () => {
    expect(StockoutsQuerySchema.parse({})).toEqual({ dias: 30, limit: 25 });
    expect(StockoutsQuerySchema.parse({ dias: '90' }).dias).toBe(90);
    for (const dias of ['45', 'x', '0']) {
      const r = StockoutsQuerySchema.safeParse({ dias });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(['dias']);
    }
  });
});
