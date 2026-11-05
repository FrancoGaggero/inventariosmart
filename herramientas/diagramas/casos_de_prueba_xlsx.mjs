/* global console, process */
// Arma docs/entrega/casos-de-prueba.xlsx desde casos-de-prueba.csv: una sola planilla con una
// pestaña por grupo de historias, para subir a Drive como un único archivo.
// Uso, desde la raíz: python herramientas/diagramas/casos_de_prueba.py && node herramientas/diagramas/casos_de_prueba_xlsx.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '../..');
const require = createRequire(join(raiz, 'apps/api/package.json'));
const ExcelJS = require('exceljs');

/** Parser de CSV con comillas (RFC 4180). */
function leerCsv(texto) {
  const filas = [];
  let fila = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else celda += c;
  }
  if (celda || fila.length) filas.push([...fila, celda]);
  return filas;
}

const [encabezado, ...casos] = leerCsv(
  readFileSync(join(raiz, 'docs/entrega/casos-de-prueba.csv'), 'utf8'),
);
const historia = (cp) => (/^CP-(\d+)\./.exec(cp) ? Number(/^CP-(\d+)\./.exec(cp)[1]) : null);
const GRUPOS = [
  { nombre: 'CP-01 a CP-06', filtro: (n) => n !== null && n <= 6 },
  { nombre: 'CP-07 a CP-11', filtro: (n) => n !== null && n >= 7 && n <= 11 },
  { nombre: 'CP-12 a CP-19', filtro: (n) => n !== null && n >= 12 },
  { nombre: 'App Android (CP-M)', filtro: (n) => n === null },
];
const ANCHOS = [11, 22, 18, 34, 40, 50, 50, 60, 24, 40, 24];

const libro = new ExcelJS.Workbook();
libro.creator = 'InventarioSmart';
const resumen = libro.addWorksheet('Resumen');
resumen.addRows([
  ['Casos de prueba · InventarioSmart'],
  [
    'Cada caso sale de un escenario GIVEN / WHEN / THEN de las especificaciones (openspec/specs) y lleva el test automatizado que lo verifica en la integración continua.',
  ],
  [],
  ['Pestaña', 'Casos', 'Automatizados', 'Manuales'],
]);
let total = 0;
for (const g of GRUPOS) {
  const filas = casos.filter((f) => f[0] && g.filtro(historia(f[0])));
  total += filas.length;
  const auto = filas.filter((f) => f[8]?.startsWith('Automatizada')).length;
  resumen.addRow([g.nombre, filas.length, auto, filas.length - auto]);
  const hoja = libro.addWorksheet(g.nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.addRow(encabezado);
  hoja.addRows(filas);
  hoja.getRow(1).font = { bold: true };
  ANCHOS.forEach((w, i) => {
    hoja.getColumn(i + 1).width = w;
    hoja.getColumn(i + 1).alignment = { wrapText: true, vertical: 'top' };
  });
}
resumen.addRow(['Total', total]);
resumen.getRow(1).font = { bold: true, size: 14 };
resumen.getRow(4).font = { bold: true };
resumen.getColumn(1).width = 22;
await libro.xlsx.writeFile(join(raiz, 'docs/entrega/casos-de-prueba.xlsx'));
if (total !== casos.filter((f) => f[0]).length) {
  console.error('✗ Algún caso no entró en ninguna pestaña.');
  process.exit(1);
}
console.log(`✓ docs/entrega/casos-de-prueba.xlsx: ${total} casos en ${GRUPOS.length} pestañas.`);
