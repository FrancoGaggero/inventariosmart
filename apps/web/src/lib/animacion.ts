// Cálculos de las animaciones de las pantallas públicas (landing-motion D2): puros, sin React.

/** Palabras de un texto para animarlas una por una; la puntuación queda pegada a su palabra. */
export function palabras(texto: string): string[] {
  return texto.trim().split(/\s+/).filter(Boolean);
}

export interface Token {
  texto: string;
  /** Índice de la parte de la que viene (para su clase, p. ej. la serif). */
  parte: number;
  /** Puntuación que va pegada a la palabra anterior, sin espacio. */
  pegado: boolean;
}

/** Las palabras de varias partes de un título, con la puntuación inicial pegada a lo anterior. */
export function tokens(partes: string[]): Token[] {
  return partes.flatMap((texto, parte) =>
    palabras(texto).map((t) => ({ texto: t, parte, pegado: /^[,.;:!?)]/.test(t) })),
  );
}

/** El texto completo de esos tokens, como se lee. */
export function unirTokens(lista: Token[]): string {
  return lista.reduce(
    (acc, t, i) => (i === 0 ? t.texto : acc + (t.pegado ? '' : ' ') + t.texto),
    '',
  );
}

export interface Rectangulo {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Inclinación 3D de una tarjeta según dónde está el puntero: 0 en el centro y ±`max` grados en los
 * bordes. Mover el puntero hacia arriba inclina la tarjeta hacia atrás (rotateX positivo).
 */
export function inclinacion(
  px: number,
  py: number,
  rect: Rectangulo,
  max = 8,
): { rotateX: number; rotateY: number } {
  if (rect.width <= 0 || rect.height <= 0) return { rotateX: 0, rotateY: 0 };
  const acotar = (v: number) => Math.min(1, Math.max(-1, v));
  // -1 a 1 desde el centro.
  const dx = acotar(((px - rect.left) / rect.width) * 2 - 1);
  const dy = acotar(((py - rect.top) / rect.height) * 2 - 1);
  const redondear = (v: number) => Math.round(v * 100) / 100 + 0;
  return { rotateX: redondear(-dy * max), rotateY: redondear(dx * max) };
}

/** Posición del puntero en la tarjeta, en porcentaje, para el brillo que lo sigue. */
export function posicionRelativa(
  px: number,
  py: number,
  rect: Rectangulo,
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 50, y: 50 };
  const pct = (v: number) => Math.round(Math.min(100, Math.max(0, v * 100)));
  return { x: pct((px - rect.left) / rect.width), y: pct((py - rect.top) / rect.height) };
}

/**
 * Puntos del scroll (de 0 a 1) en los que el paso `i` de `total` se enciende y se apaga, para
 * `useTransform`. La animación nativa del navegador exige valores en [0, 1] y crecientes.
 */
export function tramoDePaso(
  i: number,
  total: number,
  margen = 0.08,
): [number, number, number, number] {
  const acotar = (v: number) => Math.min(1, Math.max(0, v));
  const desde = i / total;
  const hasta = (i + 1) / total;
  const a = acotar(desde - margen);
  const b = Math.max(acotar(desde + margen / 2), a + 0.001);
  const d = acotar(hasta + margen / 2);
  const c = Math.min(Math.max(acotar(hasta - margen / 2), b + 0.001), d - 0.001);
  return [a, b, c, Math.max(d, c + 0.001)].map((v) => Math.round(v * 1000) / 1000) as [
    number,
    number,
    number,
    number,
  ];
}
