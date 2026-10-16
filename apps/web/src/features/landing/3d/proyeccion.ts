// Proyecciones del mapa de "Hecho para Argentina" (landing-3d D5): pasan [longitud, latitud] a
// coordenadas planas de la escena, con el norte hacia arriba (+y) y el este a la derecha (+x).

export type LonLat = [number, number];
export type Punto = [number, number];

/** Centro y escala del mapa principal: el continente mide unas 4 unidades de alto. */
const LON0 = -64;
const LAT0 = -38;
const ESCALA = 4 / 33;
const COS0 = Math.cos((LAT0 * Math.PI) / 180);

/** Equirrectangular corregida por la latitud media: buena para el alto de Argentina. */
export function proyectar([lon, lat]: LonLat): Punto {
  return [(lon - LON0) * COS0 * ESCALA, (lat - LAT0) * ESCALA];
}

/** Meridiano central del sector antártico (74° O a 25° O). */
const LON_SECTOR = -49.5;
const ESCALA_POLAR = 1.6 / 36;

/**
 * Azimutal equidistante centrada en el polo sur, para el recuadro: el polo queda en el origen y
 * los paralelos son círculos. El meridiano central apunta hacia arriba, así el norte sigue arriba.
 */
export function proyectarPolar([lon, lat]: LonLat): Punto {
  const r = (90 + lat) * ESCALA_POLAR;
  const angulo = ((lon - LON_SECTOR) * Math.PI) / 180;
  return [r * Math.sin(angulo), r * Math.cos(angulo)];
}

/** Rectángulo que ocupan unos puntos ya proyectados. */
export function limites(puntos: Punto[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of puntos) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}
