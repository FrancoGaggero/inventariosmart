/* global console, process */
// Renderiza cada docs/diagramas/*.mmd a .svg con Mermaid dentro de Chrome sin ventana, y cada .svg a .png.
// Uso: node herramientas/diagramas/renderizar.mjs [nombre | nombre.svg]
//   sin argumento, todos los .mmd; "nombre" un .mmd; "nombre.svg" sólo pasa a PNG un SVG ya dibujado
//   (por ejemplo casos-de-uso.svg, que genera casos_de_uso.py).
// Requiere Google Chrome instalado (o CHROME con la ruta al ejecutable) y conexión para bajar Mermaid del CDN.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = resolve(import.meta.dirname, '../..');
const carpeta = join(raiz, 'docs/diagramas');
const chrome = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js';
const temporal = mkdtempSync(join(tmpdir(), 'diagramas-'));

/** PNG con fondo blanco para Google Docs y Word, que no muestran SVG. */
function aPng(texto, png) {
  const [, ancho, alto] = texto.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/) ?? [];
  const lienzo = join(temporal, `${basename(png, '.png')}-png.html`);
  const svg = texto.replace(/^<\?xml[^>]*>\s*/, '');
  writeFileSync(
    lienzo,
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style>${svg}`,
  );
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${Math.ceil(Number(ancho))},${Math.ceil(Number(alto))}`,
      `--screenshot=${png}`,
      pathToFileURL(lienzo).href,
    ],
    { stdio: 'ignore' },
  );
}

const pedido = process.argv[2];
if (pedido?.endsWith('.svg')) {
  const origen = join(carpeta, pedido);
  aPng(readFileSync(origen, 'utf8'), origen.replace(/\.svg$/, '.png'));
  console.log(`${pedido} -> ${basename(pedido, '.svg')}.png`);
  process.exit();
}

const archivos = readdirSync(carpeta).filter(
  (f) => f.endsWith('.mmd') && (!pedido || basename(f, '.mmd') === pedido),
);

for (const archivo of archivos) {
  const fuente = readFileSync(join(carpeta, archivo), 'utf8');
  const pagina = join(temporal, `${basename(archivo, '.mmd')}.html`);
  writeFileSync(
    pagina,
    `<!doctype html><meta charset="utf-8"><body>
<pre id="fuente" style="display:none">${fuente.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>
<div id="salida"></div>
<script src="${MERMAID}"></script>
<script>
  mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'Arial, Helvetica, sans-serif',
    er: { useMaxWidth: false }, flowchart: { useMaxWidth: false, htmlLabels: false }, class: { useMaxWidth: false } });
  mermaid.render('d', document.getElementById('fuente').textContent)
    .then(({ svg }) => { document.getElementById('salida').textContent = svg; })
    .catch((e) => { document.getElementById('salida').textContent = 'ERROR ' + e.message; });
</script>`,
  );
  const dom = execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--virtual-time-budget=20000',
      '--dump-dom',
      pathToFileURL(pagina).href,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const m = dom.match(/<div id="salida">([\s\S]*?)<\/div>/);
  const texto = (m?.[1] ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
  if (!texto.startsWith('<svg')) {
    console.error(`${archivo}: ${texto.slice(0, 300) || 'sin salida'}`);
    process.exitCode = 1;
    continue;
  }
  const destino = join(carpeta, `${basename(archivo, '.mmd')}.svg`);
  writeFileSync(destino, `<?xml version="1.0" encoding="UTF-8"?>\n${texto}\n`);
  aPng(texto, destino.replace(/\.svg$/, '.png'));
  console.log(`${archivo} -> ${basename(destino)} y .png (${Math.round(texto.length / 1024)} KB)`);
}
