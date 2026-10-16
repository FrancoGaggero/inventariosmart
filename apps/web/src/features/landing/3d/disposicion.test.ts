// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { tramoDePaso } from '@/lib/animacion';
import {
  ALTURAS_PANEL,
  ESTANTERIAS,
  barras,
  curva,
  escalonar,
  estanterias,
  repartir,
} from './disposicion';
import { estadoDePaso } from './pasos3d';

describe('depósito vivo (landing-3d D3)', () => {
  it('repartir suma exactamente el total y respeta la proporción', () => {
    for (const n of [64, 160, 7]) {
      const partes = repartir(n, ALTURAS_PANEL);
      expect(partes.reduce((a, b) => a + b, 0)).toBe(n);
      const suma = ALTURAS_PANEL.reduce((a, b) => a + b, 0);
      partes.forEach((p, i) =>
        expect(Math.abs(p - (ALTURAS_PANEL[i]! / suma) * n)).toBeLessThan(1),
      );
    }
    expect(repartir(5, [0, 0])).toEqual([0, 0]);
  });

  it('estanterías, barras y curva tienen la misma cantidad de cajas', () => {
    for (const [n, calidad] of [
      [160, 'completa'],
      [64, 'liviana'],
    ] as const) {
      const e = estanterias(n, ESTANTERIAS[calidad]);
      const b = barras(n);
      const c = curva(n);
      expect(e.pos.length).toBe(n * 3);
      expect(b.pos.length).toBe(n * 3);
      expect(c.pos.length).toBe(n * 3);
      expect([...b.pos].every(Number.isFinite)).toBe(true);
      expect([...c.pos].every(Number.isFinite)).toBe(true);
    }
  });

  it('las barras crecen como el gráfico del panel y la curva va de izquierda a derecha', () => {
    const n = 160;
    const b = barras(n);
    const alto = (columna: number) => {
      let max = 0;
      const inicio = repartir(n, ALTURAS_PANEL)
        .slice(0, columna)
        .reduce((a, x) => a + x, 0);
      const cuantas = repartir(n, ALTURAS_PANEL)[columna]!;
      for (let i = inicio; i < inicio + cuantas; i++) max = Math.max(max, b.pos[i * 3 + 1]!);
      return max;
    };
    expect(alto(7)).toBeGreaterThan(alto(0));
    const c = curva(n);
    for (let i = 1; i < n; i++) expect(c.pos[i * 3]!).toBeGreaterThanOrEqual(c.pos[(i - 1) * 3]!);
  });

  it('escalonar es creciente, acotada y todas las cajas llegan al final', () => {
    for (const i of [0, 40, 159]) {
      expect(escalonar(0, i, 160)).toBe(0);
      expect(escalonar(1, i, 160)).toBe(1);
      let anterior = 0;
      for (let t = 0; t <= 1; t += 0.05) {
        const v = escalonar(t, i, 160);
        expect(v).toBeGreaterThanOrEqual(anterior);
        expect(v).toBeLessThanOrEqual(1);
        anterior = v;
      }
    }
    expect(escalonar(0.3, 0, 160)).toBeGreaterThan(escalonar(0.3, 159, 160));
  });
});

describe('pasos de "Cómo funciona" (landing-3d D4)', () => {
  it('cada paso se enciende en el mismo tramo que su tarjeta', () => {
    for (let i = 0; i < 4; i++) {
      const [a, b, c] = tramoDePaso(i, 4);
      const medio = (b + c) / 2;
      const e = estadoDePaso(medio, 4);
      expect(e.pesos[i]).toBeCloseTo(1);
      expect(e.indice).toBe(i);
      if (a > 0) expect(estadoDePaso(a - 0.001, 4).pesos[i]).toBeCloseTo(0);
    }
  });

  it('al final queda encendido el último paso y los pesos están acotados', () => {
    const fin = estadoDePaso(1, 4);
    expect(fin.indice).toBe(3);
    expect(fin.pesos[3]).toBe(1);
    expect(fin.local).toBe(1);
    for (let p = 0; p <= 1; p += 0.02) {
      for (const w of estadoDePaso(p, 4).pesos) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
    }
  });
});
