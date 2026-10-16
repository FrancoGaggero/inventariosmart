/* global console, fetch, process, setTimeout, window */
// Exportador de animaciones de la app (ADR 0025, design D3 de app-animations).
//
// Para cada pieza y tema: render a secuencia PNG con alfa (HyperFrames o Remotion), WebP animado
// con ffmpeg, PNG fijo del último cuadro, control de peso y copia a la web y al celular.
// Las piezas `escena3d` (landing-3d D7) son la imagen fija de las escenas 3D de la portada: se
// dibujan con la misma escena de la web, en apps/web/captura.html, con Chrome sin ventana.
//
//   node exportar.mjs                       todas las piezas
//   node exportar.mjs vacio-cajas bienvenida sólo esas
//   node exportar.mjs --revisar             sólo lint y check de HyperFrames, sin renderizar
import { spawn, spawnSync } from 'node:child_process';
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
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

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
  // Imagen fija de las escenas 3D de la portada: sólo web, sin WebP.
  'escena-deposito': {
    con: 'escena3d',
    tope: 150 * KB,
    escena: 'deposito',
    progreso: 0.5,
    ancho: 640,
    alto: 520,
  },
  'escena-como': {
    con: 'escena3d',
    tope: 120 * KB,
    escena: 'como',
    progreso: 0.9,
    ancho: 640,
    alto: 480,
  },
  'escena-argentina': {
    con: 'escena3d',
    tope: 120 * KB,
    escena: 'argentina',
    progreso: 1,
    ancho: 640,
    alto: 512,
  },
};
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PUERTO_CAPTURA = 5174;

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

/** Levanta Vite de la web en un puerto propio para la página de captura. */
async function servidorDeCaptura() {
  const vite = spawn(
    'pnpm',
    [
      '--filter',
      '@inventariosmart/web',
      'exec',
      'vite',
      '--port',
      String(PUERTO_CAPTURA),
      '--strictPort',
    ],
    {
      cwd: RAIZ,
      shell: process.platform === 'win32',
      stdio: 'ignore',
    },
  );
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${PUERTO_CAPTURA}/captura.html`);
      if (r.ok) return vite;
    } catch {
      // todavía arrancando
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  vite.kill();
  throw new Error('Vite no respondió en el puerto de captura.');
}

/** Dibuja una escena 3D con SwiftShader (render por CPU, igual en cualquier máquina) y la comprime. */
async function renderEscena(navegador, p, tema, salida) {
  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: p.ancho, height: p.alto, deviceScaleFactor: 2 });
  const url = `http://localhost:${PUERTO_CAPTURA}/captura.html?escena=${p.escena}&tema=${tema}&progreso=${p.progreso}&calidad=completa&ancho=${p.ancho}&alto=${p.alto}`;
  await pagina.goto(url);
  await pagina.waitForFunction('window.__escenaLista || window.__escenaError', { timeout: 120000 });
  const error = await pagina.evaluate(() => window.__escenaError);
  if (error) throw new Error(`${p.escena}-${tema}: ${error}`);
  const crudo = await (await pagina.$('#escena')).screenshot({ omitBackground: true });
  await pagina.close();
  await sharp(crudo).png({ palette: true, quality: 80, compressionLevel: 9 }).toFile(salida);
}

async function main() {
  const args = process.argv.slice(2);
  const soloRevisar = args.includes('--revisar');
  const pedidas = args.filter((a) => !a.startsWith('--'));
  const nombres = pedidas.length > 0 ? pedidas : Object.keys(PIEZAS);
  for (const n of nombres) if (!PIEZAS[n]) throw new Error(`Pieza desconocida: ${n}`);
  mkdirSync(OUT, { recursive: true });

  const generados = [];
  const escenas = nombres.filter((n) => PIEZAS[n].con === 'escena3d');
  if (escenas.length > 0 && !soloRevisar) {
    const vite = await servidorDeCaptura();
    const navegador = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      for (const pieza of escenas) {
        for (const tema of TEMAS) {
          const png = join(OUT, `${pieza}-${tema}.png`);
          await renderEscena(navegador, PIEZAS[pieza], tema, png);
          const bytes = statSync(png).size;
          if (bytes > PIEZAS[pieza].tope) {
            throw new Error(
              `${pieza}-${tema}.png pesa ${Math.round(bytes / KB)} KB y el tope es ${PIEZAS[pieza].tope / KB} KB: no se copia nada.`,
            );
          }
          console.log(
            `  ${pieza}-${tema}: ${Math.round(bytes / KB)} KB (tope ${PIEZAS[pieza].tope / KB} KB)`,
          );
          generados.push({ pieza, tema, webp: null, png, bytes: null, png_bytes: bytes });
        }
      }
    } finally {
      await navegador.close();
      vite.kill();
    }
  }
  for (const pieza of nombres.filter((n) => PIEZAS[n].con !== 'escena3d')) {
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
    // Las escenas 3D son de la portada web: no van al celular.
    const propios = generados.filter(
      (g) => PIEZAS[g.pieza].con !== 'escena3d' || destino === DESTINOS[0],
    );
    for (const g of propios) {
      if (g.webp) copyFileSync(g.webp, join(destino, `${g.pieza}-${g.tema}.webp`));
      copyFileSync(g.png, join(destino, `${g.pieza}-${g.tema}.png`));
    }
    const ruta = join(destino, 'manifiesto.json');
    const previo = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : {};
    for (const g of propios) {
      previo[`${g.pieza}-${g.tema}`] = {
        framework: PIEZAS[g.pieza].con === 'escena3d' ? 'three.js' : PIEZAS[g.pieza].con,
        webp: g.bytes,
        png: g.png_bytes,
      };
    }
    writeFileSync(ruta, JSON.stringify(previo, null, 2) + '\n');
  }
  console.log(`Listo: ${generados.length} archivo(s) en ${DESTINOS.length} destinos.`);
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
