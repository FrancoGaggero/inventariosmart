import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Tokens `--color-*` de index.css en los dos temas, para los tests que comparan colores con la
 * hoja de estilos (contraste de ADR 0022 y la paleta de las escenas 3D de landing-3d).
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

export const tokensOscuro = tokensDe(bloque(/@theme \{/));
export const tokensClaro = {
  ...tokensOscuro,
  ...tokensDe(bloque(/:root\[data-theme='light'\] \{/)),
};
