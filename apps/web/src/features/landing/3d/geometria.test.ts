// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { indicesHasta, tira } from './cinta';
import { fraseDeEjemplo, IPC_EJEMPLO, PRECIOS_EJEMPLO } from './datos/inflacionEjemplo';
import { proyectar, proyectarPolar } from './proyeccion';

describe('proyección del mapa (landing-3d D5)', () => {
  it('deja el norte arriba y el este a la derecha', () => {
    const jujuy = proyectar([-65.3, -24.2]);
    const ushuaia = proyectar([-68.3, -54.8]);
    const amba = proyectar([-58.38, -34.6]);
    const mendoza = proyectar([-68.83, -32.89]);
    expect(jujuy[1]).toBeGreaterThan(ushuaia[1]);
    expect(amba[0]).toBeGreaterThan(mendoza[0]);
  });

  it('el recuadro polar tiene el polo en el centro y el sector hacia arriba', () => {
    const polo = proyectarPolar([-49.5, -90]);
    expect(Math.hypot(polo[0], polo[1])).toBeCloseTo(0);
    const centro = proyectarPolar([-49.5, -65]);
    expect(centro[0]).toBeCloseTo(0);
    expect(centro[1]).toBeGreaterThan(0);
    // La península (más al oeste) queda a la izquierda.
    expect(proyectarPolar([-62, -65])[0]).toBeLessThan(0);
  });
});

describe('cinta de inflación (landing-3d D5)', () => {
  it('arma dos vértices por mes y dos triángulos por tramo', () => {
    const t = tira([100, 102, 105], { largo: 2, alto: 1, minimo: 100, maximo: 105, ancho: 0.2 });
    expect(t.posiciones.length).toBe(3 * 2 * 3);
    expect(t.indices.length).toBe(2 * 6);
    expect(t.posiciones[0]).toBeCloseTo(-1);
    expect(t.posiciones[t.posiciones.length - 2]).toBeCloseTo(1);
    expect(t.posiciones[t.posiciones.length - 2 - 0]).toBeCloseTo(1);
    expect(t.posiciones[13]).toBeCloseTo(1); // y del último mes = alto
  });

  it('dibuja hasta el avance pedido', () => {
    expect(indicesHasta(0, 11)).toBe(0);
    expect(indicesHasta(0.5, 10)).toBe(30);
    expect(indicesHasta(2, 11)).toBe(66);
  });

  it('los datos de ejemplo dan precios atrasados frente a la inflación (RN-11)', () => {
    expect(IPC_EJEMPLO).toHaveLength(12);
    expect(IPC_EJEMPLO[0]).toBe(100);
    expect(PRECIOS_EJEMPLO.at(-1)!).toBeLessThan(IPC_EJEMPLO.at(-1)!);
    const frase = fraseDeEjemplo();
    expect(frase).toMatch(
      /^En este ejemplo de 12 meses la inflación fue 25,2 % y tus precios subieron 13,6 %/,
    );
    expect(frase).toContain('quedaste 9,2 % atrasado');
  });
});
