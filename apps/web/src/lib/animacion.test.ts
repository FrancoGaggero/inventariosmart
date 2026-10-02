import { describe, expect, it } from 'vitest';
import {
  inclinacion,
  palabras,
  posicionRelativa,
  tokens,
  tramoDePaso,
  unirTokens,
} from './animacion';

const rect = { left: 100, top: 50, width: 200, height: 100 };

describe('animaciones de las pantallas públicas (landing-motion D2)', () => {
  it('palabras separa por espacios y deja la puntuación pegada', () => {
    expect(palabras('  Tu stock y tus números reales, en un solo lugar.  ')).toEqual([
      'Tu',
      'stock',
      'y',
      'tus',
      'números',
      'reales,',
      'en',
      'un',
      'solo',
      'lugar.',
    ]);
    expect(palabras('')).toEqual([]);
  });

  it('inclinacion es 0 en el centro y ±max en los bordes', () => {
    expect(inclinacion(200, 100, rect)).toEqual({ rotateX: 0, rotateY: 0 });
    expect(inclinacion(300, 50, rect)).toEqual({ rotateX: 8, rotateY: 8 });
    expect(inclinacion(100, 150, rect)).toEqual({ rotateX: -8, rotateY: -8 });
    expect(inclinacion(250, 100, rect, 4)).toEqual({ rotateX: 0, rotateY: 2 });
  });

  it('inclinacion queda acotada fuera del rectángulo y con tamaño cero', () => {
    expect(inclinacion(900, -400, rect)).toEqual({ rotateX: 8, rotateY: 8 });
    expect(inclinacion(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      rotateX: 0,
      rotateY: 0,
    });
  });

  it('posicionRelativa da el porcentaje acotado para el brillo', () => {
    expect(posicionRelativa(200, 100, rect)).toEqual({ x: 50, y: 50 });
    expect(posicionRelativa(0, 999, rect)).toEqual({ x: 0, y: 100 });
  });

  it('tokens pega la puntuación inicial a la palabra anterior', () => {
    const t = tokens(['Tu stock y tus', 'números reales', ', en un solo lugar.']);
    expect(t.map((x) => x.texto)).toEqual([
      'Tu',
      'stock',
      'y',
      'tus',
      'números',
      'reales',
      ',',
      'en',
      'un',
      'solo',
      'lugar.',
    ]);
    expect(t[6]).toEqual({ texto: ',', parte: 2, pegado: true });
    expect(t[4]!.parte).toBe(1);
    expect(unirTokens(t)).toBe('Tu stock y tus números reales, en un solo lugar.');
  });

  it('tramoDePaso queda en [0, 1] y creciente para cada paso', () => {
    for (const total of [1, 2, 3, 5]) {
      for (let i = 0; i < total; i += 1) {
        const t = tramoDePaso(i, total);
        for (const v of t) expect(v >= 0 && v <= 1).toBe(true);
        for (let k = 1; k < t.length; k += 1) expect(t[k]!).toBeGreaterThan(t[k - 1]!);
      }
    }
    expect(tramoDePaso(0, 3)).toEqual([0, 0.04, 0.293, 0.373]);
    expect(tramoDePaso(2, 3)[3]).toBeLessThanOrEqual(1);
  });
});
