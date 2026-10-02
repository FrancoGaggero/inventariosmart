/* global console, process */
// Verifica, después de `vite build`, que Motion no llegue al paquete de la app con sesión
// (landing-motion D1, ADR 0023): debe viajar sólo en los chunks de las pantallas públicas.
// Uso: node scripts/verificar-chunks.mjs  (desde apps/web, con dist/ ya generado)
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const carpeta = join(import.meta.dirname, '..', 'dist', 'assets');
const FIRMA = /MotionConfig|motionValue/;

const chunks = readdirSync(carpeta).filter((f) => f.endsWith('.js'));
const principal = chunks.filter((f) => /^index-.*\.js$/.test(f));
const conMotion = chunks.filter((f) => FIRMA.test(readFileSync(join(carpeta, f), 'utf8')));
const kb = (f) => (readFileSync(join(carpeta, f)).length / 1024).toFixed(1);

const errores = [];
if (principal.length === 0) errores.push('No encontré el chunk principal (index-*.js).');
for (const f of principal) {
  if (conMotion.includes(f)) errores.push(`Motion está en el chunk principal ${f}.`);
}
if (conMotion.length === 0) errores.push('No encontré Motion en ningún chunk: ¿cambió la firma?');

for (const f of principal) console.log(`principal  ${f}  ${kb(f)} KB`);
for (const f of conMotion) console.log(`con Motion ${f}  ${kb(f)} KB`);

if (errores.length > 0) {
  for (const e of errores) console.error(`✗ ${e}`);
  process.exit(1);
}
console.log('✓ Motion queda fuera del paquete de la app.');
