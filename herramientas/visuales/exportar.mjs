/* global console, process */
// Exportador de animaciones de la app (ADR 0025, design D3 de app-animations).
//
// Para cada pieza y tema: render a secuencia PNG con alfa (HyperFrames o Remotion), WebP animado
// con ffmpeg, PNG fijo del último cuadro, control de peso y copia a la web y al celular.
//
//   node exportar.mjs                       todas las piezas
//   node exportar.mjs vacio-cajas bienvenida sólo esas
//   node exportar.mjs --revisar             sólo lint y check de HyperFrames, sin renderizar
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../..');
const OUT = join(AQUI, 'out');
const DESTINOS = [
  join(RAIZ, 'apps/web/public/animaciones'),
  join(RAIZ, 'apps/mobile/assets/animaciones'),
];
const TEMAS = ['claro', 'oscuro'];
const FPS = 30;
const KB = 1024;
const tokens = JSON.parse(readFileSync(join(AQUI, 'tokens.json'), 'utf8'));

/** Piezas: framework, tope de peso del WebP y, para Remotion, el id de la composición. */
const PIEZAS = {
  'vacio-cajas': { con: 'hyperframes', tope: 150 * KB },
  'vacio-campana': { con: 'hyperframes', tope: 150 * KB },
  'vacio-carrito': { con: 'hyperframes', tope: 150 * KB },
  'vacio-camion': { con: 'hyperframes', tope: 150 * KB },
  'vacio-recibo': { con: 'hyperframes', tope: 150 * KB },
  'vacio-flechas': { con: 'hyperframes', tope: 150 * KB },
  bienvenida: { con: 'remotion', tope: 600 * KB, composicion: 'Bienvenida' },
};

const entorno = { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', REMOTION_DISABLE_TELEMETRY: '1' };
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

function correr(comando, args, cwd = AQUI, intentos = 2) {
  for (let i = 1; i <= intentos; i++) {
    const r = spawnSync(comando, args, {
      cwd,
      env: entorno,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (r.status === 0) return r.stdout;
    // ffmpeg en Windows a veces falla con EBUSY (issue #4058 de HyperFrames): se reintenta una vez.
    if (i === intentos) {
      console.error(r.stdout?.slice(-2000), r.stderr?.slice(-2000));
      throw new Error(`Falló: ${comando} ${args.join(' ')}`);
    }
  }
  return '';
}

/** Arma un proyecto HyperFrames por pieza: lint y check piden un index.html en la raíz. */
function prepararHyperframes(pieza) {
  const dir = join(OUT, 'proyectos', pieza);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'vendor'), { recursive: true });
  copyFileSync(join(AQUI, 'hyperframes', `${pieza}.html`), join(dir, 'index.html'));
  copyFileSync(join(AQUI, 'hyperframes', 'comun.css'), join(dir, 'comun.css'));
  copyFileSync(
    join(AQUI, 'hyperframes', 'vendor', 'gsap.min.js'),
    join(dir, 'vendor', 'gsap.min.js'),
  );
  return dir;
}

function revisarHyperframes(pieza, dir) {
  const lint = JSON.parse(correr('npx', ['hyperframes', 'lint', dir, '--json'], AQUI, 1) || '{}');
  if (lint.errorCount > 0) throw new Error(`${pieza}: lint con ${lint.errorCount} error(es)`);
  console.log(`  ${pieza}: lint ok (${lint.warningCount ?? 0} aviso(s))`);
}

function renderHyperframes(dir, tema, salida) {
  const variables = join(OUT, `variables-${tema}.json`);
  writeFileSync(
    variables,
    JSON.stringify({ trazo: tokens[tema].trazo, suave: tokens[tema].suave }),
  );
  correr('npx', [
    'hyperframes',
    'render',
    dir,
    '--format',
    'png-sequence',
    '--fps',
    String(FPS),
    '--output',
    salida,
    '--variables-file',
    variables,
    '--quiet',
  ]);
}

function renderRemotion(composicion, tema, salida) {
  const props = join(OUT, `props-${tema}.json`);
  writeFileSync(props, JSON.stringify({ tema, colores: tokens[tema] }));
  correr(
    'npx',
    [
      'remotion',
      'render',
      composicion,
      salida,
      '--sequence',
      '--image-format=png',
      `--props=${props}`,
      '--log=error',
    ],
    join(AQUI, 'remotion'),
  );
}

function cuadros(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .sort();
}

function aWebp(dirCuadros, destino) {
  const lista = cuadros(dirCuadros);
  if (lista.length === 0) throw new Error(`No hay cuadros en ${dirCuadros}`);
  // Las secuencias de los dos frameworks numeran con ceros a la izquierda: se pasan como lista concat.
  const concat = join(dirCuadros, 'lista.txt');
  writeFileSync(concat, lista.map((f) => `file '${f}'\nduration ${1 / FPS}`).join('\n') + '\n');
  correr(FFMPEG, [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concat,
    '-r',
    String(FPS),
    '-c:v',
    'libwebp_anim',
    '-lossless',
    '0',
    '-quality',
    '80',
    '-compression_level',
    '6',
    '-loop',
    '0',
    '-pix_fmt',
    'yuva420p',
    destino,
  ]);
  return join(dirCuadros, lista.at(-1));
}

function main() {
  const args = process.argv.slice(2);
  const soloRevisar = args.includes('--revisar');
  const pedidas = args.filter((a) => !a.startsWith('--'));
  const nombres = pedidas.length > 0 ? pedidas : Object.keys(PIEZAS);
  for (const n of nombres) if (!PIEZAS[n]) throw new Error(`Pieza desconocida: ${n}`);
  mkdirSync(OUT, { recursive: true });

  const generados = [];
  for (const pieza of nombres) {
    const p = PIEZAS[pieza];
    const proyecto = p.con === 'hyperframes' ? prepararHyperframes(pieza) : null;
    if (proyecto) revisarHyperframes(pieza, proyecto);
    if (soloRevisar) continue;
    for (const tema of TEMAS) {
      const dirCuadros = join(OUT, 'cuadros', `${pieza}-${tema}`);
      rmSync(dirCuadros, { recursive: true, force: true });
      if (p.con === 'hyperframes') renderHyperframes(proyecto, tema, dirCuadros);
      else renderRemotion(p.composicion, tema, dirCuadros);
      const webp = join(OUT, `${pieza}-${tema}.webp`);
      const ultimo = aWebp(dirCuadros, webp);
      const png = join(OUT, `${pieza}-${tema}.png`);
      copyFileSync(ultimo, png);
      const bytes = statSync(webp).size;
      if (bytes > p.tope) {
        throw new Error(
          `${pieza}-${tema}.webp pesa ${Math.round(bytes / KB)} KB y el tope es ${p.tope / KB} KB: no se copia nada.`,
        );
      }
      console.log(
        `  ${pieza}-${tema}: ${Math.round(bytes / KB)} KB (tope ${p.tope / KB} KB), ${cuadros(dirCuadros).length} cuadros`,
      );
      generados.push({ pieza, tema, webp, png, bytes, png_bytes: statSync(png).size });
    }
  }
  if (soloRevisar) return;

  // Sólo se copia si todas las piezas pasaron su tope.
  for (const destino of DESTINOS) {
    mkdirSync(destino, { recursive: true });
    for (const g of generados) {
      copyFileSync(g.webp, join(destino, `${g.pieza}-${g.tema}.webp`));
      copyFileSync(g.png, join(destino, `${g.pieza}-${g.tema}.png`));
    }
    const ruta = join(destino, 'manifiesto.json');
    const previo = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : {};
    for (const g of generados) {
      previo[`${g.pieza}-${g.tema}`] = {
        framework: PIEZAS[g.pieza].con,
        webp: g.bytes,
        png: g.png_bytes,
      };
    }
    writeFileSync(ruta, JSON.stringify(previo, null, 2) + '\n');
  }
  console.log(`Listo: ${generados.length} archivo(s) en ${DESTINOS.length} destinos.`);
}

try {
  main();
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
