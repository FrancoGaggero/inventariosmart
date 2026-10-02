// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Contraste de la paleta (ADR 0022, design D8): lee los tokens de index.css en los dos temas y
 * exige WCAG AA. Si alguien cambia un color y queda ilegible, este test lo frena.
 */
const css = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

function tokensDe(bloque: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [, nombre, valor] of bloque.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) {
    tokens[nombre!] = valor!.trim();
  }
  return tokens;
}

function bloque(selector: RegExp): string {
  const inicio = css.search(selector);
  if (inicio < 0) throw new Error(`No encontré ${selector}`);
  return css.slice(inicio, css.indexOf('\n}', inicio));
}

const oscuro = tokensDe(bloque(/@theme \{/));
const claro = { ...oscuro, ...tokensDe(bloque(/:root\[data-theme='light'\] \{/)) };

type Rgba = [number, number, number, number];

function color(valor: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(valor);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(valor);
  if (rgba) {
    const [r, g, b, a = '1'] = rgba[1]!.split(',').map((x) => x.trim());
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  throw new Error(`Color no soportado: ${valor}`);
}

/** Un color con transparencia, compuesto sobre su fondo. */
const sobre = ([r, g, b, a]: Rgba, [fr, fg, fb]: Rgba): Rgba => [
  r * a + fr * (1 - a),
  g * a + fg * (1 - a),
  b * a + fb * (1 - a),
  1,
];

function luminancia([r, g, b]: Rgba): number {
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function relacion(tokens: Record<string, string>, frente: string, fondo: string): number {
  const f = color(tokens[fondo]!);
  const t = sobre(color(tokens[frente]!), f);
  const [a, b] = [luminancia(t), luminancia(f)].sort((x, y) => y - x) as [number, number];
  return (a + 0.05) / (b + 0.05);
}

/** [frente, fondo, mínimo]: 4,5 para texto, 3 para texto grande e indicadores de interfaz. */
const PARES: [string, string, number][] = [
  ['t1', 'bg', 4.5],
  ['t1', 'card', 4.5],
  ['t1', 'bg-2', 4.5],
  ['t2', 'bg', 4.5],
  ['t2', 'card', 4.5],
  ['t2', 'bg-2', 4.5],
  ['on-brand', 'brand', 4.5],
  ['brand-3', 'bg', 4.5],
  ['brand-3', 'card', 4.5],
  ['on-inverso', 'inverso', 4.5],
  ['acento-inverso', 'inverso', 4.5],
  ['on-whatsapp', 'whatsapp', 4.5],
  ['t3', 'card', 3],
  ['ok', 'card', 3],
  ['warn', 'card', 3],
  ['crit', 'card', 3],
  ['brand', 'bg', 3],
  ['brand', 'card', 3],
];

describe('contraste de la paleta (WCAG AA)', () => {
  for (const [tema, tokens] of [
    ['oscuro', oscuro],
    ['claro', claro],
  ] as const) {
    it.each(PARES)(`tema ${tema}: %s sobre %s llega a %s:1`, (frente, fondo, minimo) => {
      expect(relacion(tokens, frente, fondo)).toBeGreaterThanOrEqual(minimo);
    });
  }

  it('lee los dos temas completos', () => {
    for (const nombre of ['brand', 'brand-3', 'on-brand', 'inverso', 'on-inverso', 'card']) {
      expect(oscuro[nombre]).toBeDefined();
      expect(claro[nombre]).not.toBe(undefined);
    }
    expect(claro['bg']).not.toBe(oscuro['bg']);
    expect(oscuro).not.toHaveProperty('navy');
  });
});
