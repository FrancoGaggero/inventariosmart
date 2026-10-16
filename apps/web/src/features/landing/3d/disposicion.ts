// Dónde va cada caja del "depósito vivo" (landing-3d D3): en las estanterías, en el gráfico de
// barras del panel y sobre la curva de margen. Puro: posiciones, escalas y giros, sin three.

/** Alturas del gráfico del panel del hero (`ui/GraficaBarras`). */
export const ALTURAS_PANEL = [38, 52, 46, 64, 58, 76, 70, 88];

export const LADO_CAJA = 0.22;
const SEPARACION = 0.235;

export interface Disposicion {
  /** x, y, z del centro de cada caja. */
  pos: Float32Array;
  /** Escala uniforme de cada caja. */
  escala: Float32Array;
  /** Giro en z de cada caja, en radianes. */
  giro: Float32Array;
}

function vacia(n: number): Disposicion {
  return {
    pos: new Float32Array(n * 3),
    escala: new Float32Array(n).fill(1),
    giro: new Float32Array(n),
  };
}

/**
 * Reparte `total` en partes proporcionales a `pesos`, con el método del mayor resto: la suma da
 * exactamente `total` y ninguna parte se aleja más de una unidad de su proporción.
 */
export function repartir(total: number, pesos: number[]): number[] {
  const suma = pesos.reduce((a, b) => a + b, 0);
  if (suma <= 0) return pesos.map(() => 0);
  const exactos = pesos.map((p) => (p / suma) * total);
  const partes = exactos.map(Math.floor);
  let faltan = total - partes.reduce((a, b) => a + b, 0);
  const orden = exactos.map((e, i) => [e - Math.floor(e), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of orden) {
    if (faltan <= 0) break;
    partes[i]! += 1;
    faltan -= 1;
  }
  return partes;
}

export interface Estanterias {
  /** Estanterías una al lado de la otra. */
  muebles: number;
  /** Estantes por mueble. */
  niveles: number;
}

export const ESTANTERIAS: Record<'completa' | 'liviana', Estanterias> = {
  completa: { muebles: 4, niveles: 4 },
  liviana: { muebles: 2, niveles: 4 },
};

export const ALTO_NIVEL = 0.42;
export const ANCHO_MUEBLE = 1.18;

/**
 * Cajas sobre los estantes, ordenadas de izquierda a derecha: así cada una viaja poco hasta su
 * columna del gráfico.
 */
export function estanterias(n: number, e: Estanterias): Disposicion {
  const d = vacia(n);
  const porNivel = Math.ceil(n / (e.muebles * e.niveles));
  const porMueble = porNivel * e.niveles;
  for (let i = 0; i < n; i++) {
    const mueble = Math.floor(i / porMueble);
    const dentro = i % porMueble;
    const columna = Math.floor(dentro / e.niveles);
    const nivel = dentro % e.niveles;
    const x0 = (mueble - (e.muebles - 1) / 2) * (ANCHO_MUEBLE + 0.25);
    const x = x0 + (columna - (porNivel - 1) / 2) * (ANCHO_MUEBLE / porNivel);
    d.pos.set([x, 0.03 + LADO_CAJA / 2 + nivel * ALTO_NIVEL, 0], i * 3);
  }
  return d;
}

export const ANCHO_BARRA = 0.52;

/** Centro en x de cada columna del gráfico. */
export const xDeColumna = (i: number, columnas: number) =>
  (i - (columnas - 1) / 2) * ANCHO_BARRA * 1.18;

/** Cajas apiladas en columnas de 2 × 2 por capa, con las alturas del panel. */
export function barras(n: number, alturas: number[] = ALTURAS_PANEL): Disposicion {
  const d = vacia(n);
  const cantidades = repartir(n, alturas);
  let i = 0;
  cantidades.forEach((cantidad, columna) => {
    const cx = xDeColumna(columna, alturas.length);
    for (let k = 0; k < cantidad; k++, i++) {
      const capa = Math.floor(k / 4);
      const lugar = k % 4;
      const x = cx + (lugar % 2 === 0 ? -1 : 1) * (SEPARACION / 2);
      const z = (lugar < 2 ? -1 : 1) * (SEPARACION / 2);
      d.pos.set([x, LADO_CAJA / 2 + capa * SEPARACION, z], i * 3);
    }
  });
  return d;
}

/** Altura de la cima de cada barra, para que la curva pase por encima del gráfico. */
export function cimas(n: number, alturas: number[] = ALTURAS_PANEL): number[] {
  return repartir(n, alturas).map((c) => Math.ceil(c / 4) * SEPARACION + 0.25);
}

/** Catmull-Rom uniforme entre p1 y p2. */
function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/** Punto de la curva de margen para u en [0, 1], pasando por la cima de cada barra. */
export function puntoDeCurva(
  u: number,
  n: number,
  alturas: number[] = ALTURAS_PANEL,
): [number, number] {
  const ys = cimas(n, alturas);
  const columnas = alturas.length;
  const s = Math.min(Math.max(u, 0), 1) * (columnas - 1);
  const i = Math.min(Math.floor(s), columnas - 2);
  const t = s - i;
  const y = (k: number) => ys[Math.min(Math.max(k, 0), columnas - 1)]!;
  const x = xDeColumna(0, columnas) + s * ANCHO_BARRA * 1.18;
  return [x, catmull(y(i - 1), y(i), y(i + 1), y(i + 2), t)];
}

/** Cajas chicas en fila sobre la curva, giradas según su pendiente. */
export function curva(n: number, alturas: number[] = ALTURAS_PANEL): Disposicion {
  const d = vacia(n);
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0;
    const [x, y] = puntoDeCurva(u, n, alturas);
    const [x2, y2] = puntoDeCurva(Math.min(1, u + 0.01), n, alturas);
    const [x1, y1] = puntoDeCurva(Math.max(0, u - 0.01), n, alturas);
    d.pos.set([x, y, 0.32], i * 3);
    d.escala[i] = 0.38;
    d.giro[i] = Math.atan2(y2 - y1, x2 - x1);
  }
  return d;
}

export const suavizar = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Avance propio de la caja `i` de `n` cuando el tramo va en `t`: arrancan escalonadas de
 * izquierda a derecha y todas llegan al final.
 */
export function escalonar(t: number, i: number, n: number, demora = 0.35): number {
  const retraso = n > 1 ? (i / (n - 1)) * demora : 0;
  const local = Math.min(1, Math.max(0, (t - retraso) / (1 - demora)));
  return suavizar(local);
}

/** Avance (0 a 1) dentro del tramo [desde, hasta] del scroll. */
export const tramo = (p: number, desde: number, hasta: number) =>
  Math.min(1, Math.max(0, (p - desde) / (hasta - desde)));
