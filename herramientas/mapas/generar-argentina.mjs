/* global Buffer, console, fetch, process */
// Genera el contorno de Argentina de la portada (landing-3d D5, ADR 0026) desde Natural Earth.
//
// - Fuente: Natural Earth 1:10m, vista de país de Argentina (ne_10m_admin_0_countries_arg), tag
//   v5.1.2, dominio público. En esa vista Malvinas, Georgias del Sur y Sandwich del Sur son
//   territorio argentino. El sector antártico (74° O a 25° O, al sur de 60° S) se recorta de la
//   Antártida, como en el mapa bicontinental (Ley 26.651).
// - Salida: apps/web/src/features/landing/3d/datos/argentina.ts, en lon/lat redondeados a 0,01°.
//
// Uso: npm install && node generar-argentina.mjs   (desde herramientas/mapas)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import polygonClipping from 'polygon-clipping';

const aqui = import.meta.dirname;
const raiz = resolve(aqui, '../..');
const FUENTE = join(aqui, 'fuente', 'ne_10m_admin_0_countries_arg.geojson');
const URL_FUENTE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries_arg.geojson';
const SHA256 = '5de5c83114945be5c328295abf31d29641ffe7f0280c0f8f746777648fae5803';
const SALIDA = join(raiz, 'apps/web/src/features/landing/3d/datos/argentina.ts');

async function fuente() {
  if (!existsSync(FUENTE)) {
    mkdirSync(join(aqui, 'fuente'), { recursive: true });
    console.log(`Bajando ${URL_FUENTE}`);
    const r = await fetch(URL_FUENTE);
    if (!r.ok) throw new Error(`No pude bajar la fuente: ${r.status}`);
    writeFileSync(FUENTE, Buffer.from(await r.arrayBuffer()));
  }
  const datos = readFileSync(FUENTE);
  const hash = createHash('sha256').update(datos).digest('hex');
  if (hash !== SHA256) throw new Error(`La fuente no coincide con el SHA-256 esperado (${hash}).`);
  return JSON.parse(datos.toString('utf8'));
}

// --- geometría en lon/lat -------------------------------------------------------------------

const poligonos = (geom) => (geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates]);

function areaAnillo(anillo) {
  let a = 0;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    a += (anillo[j][0] + anillo[i][0]) * (anillo[j][1] - anillo[i][1]);
  }
  return Math.abs(a / 2);
}

function centro(anillo) {
  const [sx, sy] = anillo.reduce(([x, y], p) => [x + p[0], y + p[1]], [0, 0]);
  return [sx / anillo.length, sy / anillo.length];
}

/** Douglas-Peucker sobre un anillo cerrado; conserva al menos cuatro puntos. */
function simplificar(anillo, tolerancia) {
  const puntos = anillo.slice(0, -1);
  if (puntos.length <= 4) return anillo;
  const distancia = (p, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const largo = dx * dx + dy * dy;
    if (largo === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / largo));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const marcar = (desde, hasta, quedan) => {
    let max = 0;
    let indice = -1;
    for (let i = desde + 1; i < hasta; i++) {
      const d = distancia(puntos[i], puntos[desde], puntos[hasta]);
      if (d > max) {
        max = d;
        indice = i;
      }
    }
    if (max > tolerancia) {
      quedan.add(indice);
      marcar(desde, indice, quedan);
      marcar(indice, hasta, quedan);
    }
  };
  // Se parte el anillo en dos mitades para que Douglas-Peucker tenga extremos distintos.
  const medio = Math.floor(puntos.length / 2);
  const quedan = new Set([0, medio, puntos.length - 1]);
  marcar(0, medio, quedan);
  marcar(medio, puntos.length - 1, quedan);
  const resultado = [...quedan].sort((a, b) => a - b).map((i) => puntos[i]);
  if (resultado.length < 4) return anillo;
  return [...resultado, resultado[0]];
}

const redondear = (anillo) => {
  const salida = [];
  for (const [x, y] of anillo) {
    const p = [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
    const ultimo = salida[salida.length - 1];
    if (!ultimo || ultimo[0] !== p[0] || ultimo[1] !== p[1]) salida.push(p);
  }
  return salida;
};

function dentro([x, y], anillo) {
  let adentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro;
  }
  return adentro;
}
const enAlguno = (p, lista) =>
  lista.some((pol) => dentro(p, pol[0]) && !pol.slice(1).some((h) => dentro(p, h)));

/**
 * Prepara los polígonos: descarta los diminutos (salvo la lista blanca) y simplifica. Las islas
 * usan una tolerancia más fina: sus costas recortadas se cruzarían con la del continente.
 */
function preparar(lista, { tolerancia, areaMinima, siempre = () => false }) {
  return lista
    .filter((pol) => areaAnillo(pol[0]) >= areaMinima || siempre(centro(pol[0])))
    .map((pol) =>
      pol
        .map((anillo, i) => (i === 0 || areaAnillo(anillo) >= areaMinima ? anillo : null))
        .filter(Boolean)
        .map((anillo) =>
          redondear(simplificar(anillo, areaAnillo(pol[0]) < 5 ? tolerancia / 4 : tolerancia)),
        )
        .filter((anillo) => anillo.length >= 4),
    )
    .filter((pol) => pol.length > 0);
}

const caja = ([x, y], [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
// Islas que la simplificación no puede borrar aunque sean chicas.
const MALVINAS = [-61.6, -52.6, -57.6, -50.9];
const ESTADOS = [-64.9, -55.0, -63.7, -54.6];

// --- generación -----------------------------------------------------------------------------

const geo = await fuente();
const arg = geo.features.find((f) => f.properties.ADM0_A3 === 'ARG');
const ata = geo.features.find((f) => f.properties.ADM0_A3 === 'ATA');
if (!arg || !ata) throw new Error('No encontré Argentina o la Antártida en la fuente.');

const todos = poligonos(arg.geometry);
// Continente, Tierra del Fuego, Isla de los Estados y Malvinas van al mapa principal; Georgias y
// Sandwich del Sur, que quedan muy al este, al recuadro con el sector antártico.
const principal = todos.filter((pol) => centro(pol[0])[0] < -55);
const atlanticoSur = todos.filter((pol) => centro(pol[0])[0] >= -55);

const continente = preparar(principal, {
  tolerancia: 0.06,
  areaMinima: 0.02,
  siempre: (c) => caja(c, MALVINAS) || caja(c, ESTADOS),
});
const islas = preparar(atlanticoSur, { tolerancia: 0.03, areaMinima: 0.005 });
const sector = polygonClipping.intersection(poligonos(ata.geometry), [
  [
    [-74, -90],
    [-25, -90],
    [-25, -60],
    [-74, -60],
    [-74, -90],
  ],
]);
const antartida = preparar(sector, { tolerancia: 0.12, areaMinima: 0.05 });

// --- validaciones ---------------------------------------------------------------------------

const errores = [];
const verificar = (ok, mensaje) => ok || errores.push(mensaje);
verificar(enAlguno([-59, -51.7], continente), 'Malvinas (Soledad) quedó afuera del mapa.');
verificar(enAlguno([-59.8, -51.8], continente), 'Malvinas (Gran Malvina) quedó afuera del mapa.');
verificar(!enAlguno([-70.65, -33.45], continente), 'Santiago de Chile quedó adentro del mapa.');
verificar(enAlguno([-68.3, -54.75], continente), 'Ushuaia quedó afuera del mapa.');
verificar(enAlguno([-58.38, -34.6], continente), 'Buenos Aires quedó afuera del mapa.');
verificar(enAlguno([-36.5, -54.3], islas), 'Georgias del Sur quedaron afuera del recuadro.');
for (const pol of antartida) {
  for (const [x, y] of pol[0]) {
    if (x < -74.01 || x > -24.99 || y > -59.99)
      errores.push(`Punto antártico fuera del sector: ${x}, ${y}.`);
  }
}
const contar = (lista) => lista.reduce((n, pol) => n + pol.reduce((m, a) => m + a.length, 0), 0);
console.log(
  `Puntos: continente ${contar(continente)} (${continente.length} polígonos), islas ${contar(islas)}, antártida ${contar(antartida)}.`,
);
verificar(contar(continente) <= 1400, 'El contorno continental quedó con demasiados puntos.');
if (errores.length) {
  for (const e of errores) console.error(`✗ ${e}`);
  process.exit(1);
}

// --- salida ---------------------------------------------------------------------------------

const ts = (lista) => JSON.stringify(lista);
const contenido = `// GENERADO por herramientas/mapas/generar-argentina.mjs (no editar a mano).
// Fuente: Natural Earth 1:10m, vista de país de Argentina (ne_10m_admin_0_countries_arg), v5.1.2,
// dominio público (https://www.naturalearthdata.com/about/terms-of-use/). Malvinas, Georgias del
// Sur, Sandwich del Sur y el sector antártico (74° O a 25° O) como territorio argentino, según la
// Ley 26.651. Coordenadas [longitud, latitud] en grados, redondeadas a 0,01°.

/** Un polígono: el primer anillo es el borde y los siguientes, huecos. */
export type Poligono = [number, number][][];

/** Continente, Tierra del Fuego, Isla de los Estados e Islas Malvinas. */
export const CONTINENTE: Poligono[] = ${ts(continente)};

/** Georgias del Sur y Sandwich del Sur, para el recuadro. */
export const ATLANTICO_SUR: Poligono[] = ${ts(islas)};

/** Sector antártico argentino, para el recuadro. */
export const ANTARTIDA: Poligono[] = ${ts(antartida)};
`;
mkdirSync(join(SALIDA, '..'), { recursive: true });
writeFileSync(SALIDA, contenido);
execFileSync('npx', ['prettier', '--write', SALIDA], { cwd: raiz, stdio: 'inherit', shell: true });
console.log(`✓ ${SALIDA.replace(raiz, '.')} (${Math.round(contenido.length / 1024)} KB)`);
