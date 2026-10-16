// Colores de las escenas 3D desde los tokens del tema (ADR 0022, landing-3d D2). Tailwind v4 sólo
// emite las variables que usa alguna clase, así que cada token tiene un respaldo igual al de
// index.css; colores.test.ts verifica que no se desincronicen.

export type TemaEscena = 'dark' | 'light';

export interface PaletaEscena {
  bg: string;
  card: string;
  card2: string;
  t1: string;
  t3: string;
  brand: string;
  brand2: string;
  brand3: string;
  ok: string;
  warn: string;
  crit: string;
  whatsapp: string;
}

/** Nombre del token `--color-*` de cada color de la paleta. */
export const TOKEN: Record<keyof PaletaEscena, string> = {
  bg: 'bg',
  card: 'card',
  card2: 'card-2',
  t1: 't1',
  t3: 't3',
  brand: 'brand',
  brand2: 'brand-2',
  brand3: 'brand-3',
  ok: 'ok',
  warn: 'warn',
  crit: 'crit',
  whatsapp: 'whatsapp',
};

export const RESPALDO: Record<TemaEscena, PaletaEscena> = {
  dark: {
    bg: '#14110d',
    card: '#1e1a15',
    card2: '#231e18',
    t1: '#f3ece1',
    t3: '#857a69',
    brand: '#e0a54a',
    brand2: '#ebb866',
    brand3: '#f0c07a',
    ok: '#5bb585',
    warn: '#e5824a',
    crit: '#e5574f',
    whatsapp: '#25d366',
  },
  light: {
    bg: '#f4efe6',
    card: '#fffcf7',
    card2: '#faf6ef',
    t1: '#1f1a14',
    t3: '#8a7f6f',
    brand: '#b87a22',
    brand2: '#a66c1a',
    brand3: '#8a5a12',
    ok: '#2f7d55',
    warn: '#b4561f',
    crit: '#bf3a30',
    whatsapp: '#25d366',
  },
};

/** La paleta del tema actual leída del documento, con el respaldo para lo que no se emitió. */
export function leerPaleta(tema: TemaEscena): PaletaEscena {
  const estilos =
    typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const paleta = { ...RESPALDO[tema] };
  for (const clave of Object.keys(TOKEN) as (keyof PaletaEscena)[]) {
    const valor = estilos?.getPropertyValue(`--color-${TOKEN[clave]}`).trim();
    if (valor && /^#[0-9a-f]{6}$/i.test(valor)) paleta[clave] = valor;
  }
  return paleta;
}
