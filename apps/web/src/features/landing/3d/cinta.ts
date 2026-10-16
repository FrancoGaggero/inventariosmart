// Geometría de la cinta de "inflación frente a tus precios" (landing-3d D5): una tira que sigue una
// serie de valores, con ancho en profundidad. Pura, para poder probarla sin WebGL.

export interface OpcionesCinta {
  /** Largo total en x. */
  largo: number;
  /** Alto que corresponde al rango de valores [minimo, maximo]. */
  alto: number;
  minimo: number;
  maximo: number;
  /** Ancho de la tira en z. */
  ancho: number;
  /** Profundidad en la que se dibuja la tira. */
  z?: number;
}

export interface Tira {
  posiciones: Float32Array;
  indices: Uint16Array;
  /** Índices por tramo entre dos meses: para dibujar hasta un avance con `setDrawRange`. */
  indicesPorTramo: number;
}

/** Altura de un valor de la serie dentro de la cinta. */
export function alturaDe(
  valor: number,
  o: Pick<OpcionesCinta, 'alto' | 'minimo' | 'maximo'>,
): number {
  const rango = o.maximo - o.minimo || 1;
  return ((valor - o.minimo) / rango) * o.alto;
}

export function tira(valores: number[], o: OpcionesCinta): Tira {
  const n = valores.length;
  const z = o.z ?? 0;
  const posiciones = new Float32Array(n * 2 * 3);
  valores.forEach((v, i) => {
    const x = n > 1 ? (i / (n - 1)) * o.largo - o.largo / 2 : 0;
    const y = alturaDe(v, o);
    posiciones.set([x, y, z - o.ancho / 2, x, y, z + o.ancho / 2], i * 6);
  });
  const indices = new Uint16Array(Math.max(0, n - 1) * 6);
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
  }
  return { posiciones, indices, indicesPorTramo: 6 };
}

/**
 * Franja vertical entre dos series del mismo largo (por ejemplo, entre tus precios y el IPC): marca
 * cuánto quedaste atrasado. Mismo orden de índices que `tira`, así se dibuja hasta el mismo avance.
 */
export function relleno(abajo: number[], arriba: number[], o: OpcionesCinta): Tira {
  const n = Math.min(abajo.length, arriba.length);
  const z = o.z ?? 0;
  const posiciones = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const x = n > 1 ? (i / (n - 1)) * o.largo - o.largo / 2 : 0;
    posiciones.set([x, alturaDe(abajo[i]!, o), z, x, alturaDe(arriba[i]!, o), z], i * 6);
  }
  const indices = new Uint16Array(Math.max(0, n - 1) * 6);
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    indices.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6);
  }
  return { posiciones, indices, indicesPorTramo: 6 };
}

/** Cuántos índices dibujar para mostrar la cinta hasta `avance` (0 a 1). */
export function indicesHasta(avance: number, tramos: number, porTramo = 6): number {
  const t = Math.min(1, Math.max(0, avance));
  return Math.round(t * tramos) * porTramo;
}
