import { describe, expect, it } from 'vitest';
import {
  DIAS_QUIEBRES,
  detallePanel,
  diasLegibles,
  SIN_HISTORIAL,
  formatearPerdida,
  fraseTotales,
  textoGanancia,
  unidadesLegibles,
} from './quiebres-formato';

const totales = (extra = {}) => ({
  gananciaPerdida: '13000.00',
  ventaPerdida: '32500.00',
  unidadesPerdidas: '32.5',
  productosAfectados: 3,
  enCurso: 1,
  ...extra,
});

describe('pérdidas por falta de stock (HU-18)', () => {
  it('formatea montos sin centavos, días y unidades con un decimal', () => {
    expect(formatearPerdida('13000.00')).toBe('$\u00a013.000');
    expect(formatearPerdida(null)).toBe('—');
    expect(diasLegibles(5)).toBe('5,0 días');
    expect(diasLegibles(1)).toBe('1,0 día');
    expect(diasLegibles(0.04)).toBe('menos de un día');
    expect(unidadesLegibles('10.0')).toBe('10,0 unidades');
    expect(unidadesLegibles(null)).toBe('—');
    expect(DIAS_QUIEBRES).toEqual([30, 60, 90]);
  });

  it('la ganancia de un producto sin historial lo dice en lugar del monto', () => {
    expect(textoGanancia({ gananciaPerdida: null, motivo: 'SIN_HISTORIAL' })).toBe(SIN_HISTORIAL);
    expect(SIN_HISTORIAL).toBe('Sin historial suficiente');
    expect(textoGanancia({ gananciaPerdida: '4000.00', motivo: null })).toBe('$\u00a04.000');
  });

  it('CP-18.6 la frase de totales', () => {
    expect(fraseTotales(totales(), 30)).toBe(
      'En los últimos 30 días 3 productos se quedaron sin stock (1 sigue así): dejaste de ganar unos $\u00a013.000.',
    );
    expect(fraseTotales(totales({ productosAfectados: 1, enCurso: 0 }), 90)).toBe(
      'En los últimos 90 días 1 producto se quedó sin stock: dejaste de ganar unos $\u00a013.000.',
    );
    expect(fraseTotales(totales({ gananciaPerdida: '0.00', enCurso: 3 }), 60)).toBe(
      'En los últimos 60 días 3 productos se quedaron sin stock (3 siguen así).',
    );
    expect(fraseTotales(totales({ productosAfectados: 0, enCurso: 0 }), 30)).toBe(
      'En los últimos 30 días ningún producto se quedó sin stock.',
    );
    expect(detallePanel(2)).toBe('de ganancia en los últimos 30 días · 2 productos sin stock');
  });
});
