/* global console, process */
// Verifica, después de `vite build`, que las librerías de las pantallas públicas no lleguen al
// paquete de la app con sesión:
// - Motion viaja sólo en los chunks de las pantallas públicas (landing-motion D1, ADR 0023);
// - three viaja en un único chunk diferido de la portada, dentro de sus topes (landing-3d D1,
//   ADR 0026), separado de Motion y de las escenas.
// Uso: node scripts/verificar-chunks.mjs  (desde apps/web, con dist/ ya generado)
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const carpeta = join(import.meta.dirname, '..', 'dist', 'assets');
const FIRMA_MOTION = /MotionConfig|motionValue/;
// Los nombres de clase se minifican; estos textos de three sobreviven.
const FIRMA_TRES = /__THREE__|THREE\.WebGLRenderer/;
const ESCENA = /^(deposito|comoFunciona|argentina)-.*\.js$/;
const TOPE_TRES = 160 * 1024;
const TOPE_ESCENA = 45 * 1024;

const chunks = readdirSync(carpeta).filter((f) => f.endsWith('.js'));
const leer = (f) => readFileSync(join(carpeta, f));
const principal = chunks.filter((f) => /^index-.*\.js$/.test(f));
const portada = chunks.filter((f) => /^LandingPage-.*\.js$/.test(f));
const conMotion = chunks.filter((f) => FIRMA_MOTION.test(leer(f).toString('utf8')));
const conTres = chunks.filter((f) => FIRMA_TRES.test(leer(f).toString('utf8')));
const escenas = chunks.filter((f) => ESCENA.test(f));
const kb = (n) => (n / 1024).toFixed(1);
const gz = (f) => gzipSync(leer(f), { level: 9 }).length;

const errores = [];
if (principal.length === 0) errores.push('No encontré el chunk principal (index-*.js).');
for (const f of principal) {
  if (conMotion.includes(f)) errores.push(`Motion está en el chunk principal ${f}.`);
  if (conTres.includes(f)) errores.push(`three está en el chunk principal ${f}.`);
}
if (conMotion.length === 0) errores.push('No encontré Motion en ningún chunk: ¿cambió la firma?');
// Importaciones estáticas de un chunk (`import … from "./x.js"` o `import "./x.js"`); las dinámicas,
// `import("./x.js")`, no cuentan: son las que se bajan cuando hacen falta.
const estaticas = (f) =>
  [
    ...leer(f)
      .toString('utf8')
      .matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g),
  ].map((m) => m[1]);
function alcanzables(desde) {
  const vistos = new Set();
  const pendientes = [...desde];
  while (pendientes.length) {
    const f = pendientes.pop();
    if (vistos.has(f) || !chunks.includes(f)) continue;
    vistos.add(f);
    pendientes.push(...estaticas(f));
  }
  return vistos;
}
for (const f of alcanzables([...principal, ...portada])) {
  if (conTres.includes(f))
    errores.push(
      `three (${f}) se carga junto con la app o la portada: tiene que bajarse diferido.`,
    );
}
if (conTres.length === 0) errores.push('No encontré three en ningún chunk: ¿cambió la firma?');
if (conTres.length > 1) errores.push(`three está repetido en ${conTres.join(', ')}.`);
for (const f of conTres) {
  if (conMotion.includes(f)) errores.push(`Motion entró en el chunk de three ${f}.`);
  if (gz(f) > TOPE_TRES)
    errores.push(`${f} pesa ${kb(gz(f))} KB comprimido (tope ${kb(TOPE_TRES)}).`);
}
if (escenas.length < 3) errores.push(`Esperaba 3 chunks de escena y encontré ${escenas.length}.`);
for (const f of escenas) {
  if (gz(f) > TOPE_ESCENA)
    errores.push(`${f} pesa ${kb(gz(f))} KB comprimido (tope ${kb(TOPE_ESCENA)}).`);
}

const fila = (tipo, f) =>
  console.log(
    `${tipo.padEnd(10)} ${f.padEnd(34)} ${kb(leer(f).length).padStart(7)} KB  ${kb(gz(f)).padStart(6)} KB gz`,
  );
for (const f of principal) fila('principal', f);
for (const f of portada) fila('portada', f);
for (const f of conMotion) fila('Motion', f);
for (const f of conTres) fila('three', f);
for (const f of escenas) fila('escena', f);

if (errores.length > 0) {
  for (const e of errores) console.error(`✗ ${e}`);
  process.exit(1);
}
console.log(
  '✓ Motion y three quedan fuera del paquete de la app y three, diferido y dentro del tope.',
);
