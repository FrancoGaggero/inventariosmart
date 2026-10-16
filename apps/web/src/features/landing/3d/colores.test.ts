// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { tokensClaro, tokensOscuro } from '@/test/tokens-css';
import { RESPALDO, TOKEN, leerPaleta, type PaletaEscena } from './colores';

describe('paleta de las escenas 3D (landing-3d D2)', () => {
  it.each([
    ['dark', tokensOscuro],
    ['light', tokensClaro],
  ] as const)('el respaldo del tema %s es igual a index.css', (tema, tokens) => {
    for (const clave of Object.keys(TOKEN) as (keyof PaletaEscena)[]) {
      expect(RESPALDO[tema][clave], clave).toBe(tokens[TOKEN[clave]]?.toLowerCase());
    }
  });

  it('sin documento devuelve el respaldo', () => {
    expect(leerPaleta('light')).toEqual(RESPALDO.light);
  });
});
