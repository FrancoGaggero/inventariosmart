// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ANTARTIDA, ATLANTICO_SUR, CONTINENTE, type Poligono } from './argentina';

function dentro([x, y]: [number, number], anillo: [number, number][]): boolean {
  let adentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]!;
    const [xj, yj] = anillo[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro;
  }
  return adentro;
}
const enAlguno = (p: [number, number], lista: Poligono[]) =>
  lista.some((pol) => dentro(p, pol[0]!) && !pol.slice(1).some((h) => dentro(p, h)));
const puntos = (lista: Poligono[]) => lista.flat(2);

describe('contorno de Argentina (landing-3d D5, Ley 26.651)', () => {
  it('incluye las Islas Malvinas, Tierra del Fuego y Buenos Aires', () => {
    expect(enAlguno([-59, -51.7], CONTINENTE)).toBe(true); // Isla Soledad
    expect(enAlguno([-59.8, -51.8], CONTINENTE)).toBe(true); // Gran Malvina
    expect(enAlguno([-68.3, -54.75], CONTINENTE)).toBe(true); // Ushuaia
    expect(enAlguno([-58.38, -34.6], CONTINENTE)).toBe(true);
  });

  it('no incluye territorio de Chile', () => {
    expect(enAlguno([-70.65, -33.45], CONTINENTE)).toBe(false); // Santiago
    expect(enAlguno([-72.94, -41.47], CONTINENTE)).toBe(false); // Puerto Montt
  });

  it('el recuadro trae las Georgias del Sur y el sector antártico en su cuña', () => {
    expect(enAlguno([-36.5, -54.3], ATLANTICO_SUR)).toBe(true);
    expect(ANTARTIDA.length).toBeGreaterThan(0);
    for (const [lon, lat] of puntos(ANTARTIDA)) {
      expect(lon).toBeGreaterThanOrEqual(-74.01);
      expect(lon).toBeLessThanOrEqual(-24.99);
      expect(lat).toBeLessThanOrEqual(-59.99);
    }
  });

  it('queda liviano para la portada', () => {
    expect(puntos(CONTINENTE).length).toBeLessThan(1400);
    expect(puntos(ANTARTIDA).length).toBeLessThan(1200);
  });
});
