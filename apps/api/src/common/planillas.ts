import { LIMITE_FILAS_IMPORTACION } from '@inventariosmart/shared';
import { validacion } from './errors';

/**
 * Lector común de planillas (.xlsx con exceljs diferido, .csv propio): lo comparten la
 * importación de listas de precios (HU-02) y la de productos (HU-05).
 */

export { LIMITE_FILAS_IMPORTACION };

/** Encabezado normalizado: sin tildes, minúsculas, sólo letras, números, guion bajo y espacios. */
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * "2.340,50" → "2340.50"; "2340,5" → "2340.50"; "2,340.50" → "2340.50"; "$ 1.200" → "1200.00".
 * Devuelve null si no se puede interpretar como monto no negativo.
 */
export function parsearMonto(texto: string): string | null {
  let t = texto.replace(/[$\s]/g, '').replace(/^ARS/i, '');
  if (t === '') return null;
  const tieneComa = t.includes(',');
  const tienePunto = t.includes('.');
  if (tieneComa && tienePunto) {
    // El último separador es el decimal; el otro es de miles.
    t =
      t.lastIndexOf(',') > t.lastIndexOf('.')
        ? t.replace(/\./g, '').replace(',', '.')
        : t.replace(/,/g, '');
  } else if (tieneComa) {
    t =
      /^\d{1,3}(,\d{3})+$/.test(t) && t.split(',').length > 2
        ? t.replace(/,/g, '')
        : t.replace(',', '.');
  } else if (tienePunto) {
    // "2.340" (miles, estilo argentino) vs "2.5" (decimal): sólo grupos de 3 tras el punto son miles.
    if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(2);
}

/** Entero no negativo desde texto ("10", "10,0", "1.000"); null si no lo es. */
export function parsearEntero(texto: string): number | null {
  const t = texto.replace(/\s/g, '');
  if (t === '') return null;
  const monto = parsearMonto(t);
  if (monto === null) return null;
  const n = Number(monto);
  return Number.isInteger(n) ? n : null;
}

function parsearLineaCsv(linea: string, separador: string): string[] {
  const celdas: string[] = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i]!;
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (c === separador && !entreComillas) {
      celdas.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  celdas.push(actual);
  return celdas.map((x) => x.trim());
}

function detectarSeparador(linea: string): string {
  const cuenta = (s: string) => linea.split(s).length - 1;
  const candidatos: [string, number][] = [
    [';', cuenta(';')],
    ['\t', cuenta('\t')],
    [',', cuenta(',')],
  ];
  candidatos.sort((a, b) => b[1] - a[1]);
  return candidatos[0]![1] > 0 ? candidatos[0]![0] : ';';
}

function leerCsv(buffer: Buffer): string[][] {
  const texto = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lineas.length === 0) return [];
  const separador = detectarSeparador(lineas[0]!);
  return lineas.map((l) => parsearLineaCsv(l, separador));
}

function textoDeCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return String(valor);
  if (typeof valor === 'string') return valor.trim();
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object') {
    const v = valor as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(v.richText))
      return v.richText
        .map((r) => r.text)
        .join('')
        .trim();
    if (v.result !== undefined) return textoDeCelda(v.result);
    if (v.text !== undefined) return textoDeCelda(v.text);
  }
  return String(valor).trim();
}

async function leerXlsx(buffer: Buffer): Promise<string[][]> {
  // Carga diferida: exceljs es pesado y sólo hace falta al importar.
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw validacion('No pudimos leer el archivo. Verificá que sea un .xlsx válido.');
  }
  const hoja = workbook.worksheets[0];
  if (!hoja) return [];
  const filas: string[][] = [];
  hoja.eachRow((row) => {
    const celdas: string[] = [];
    const valores = row.values as unknown[];
    // exceljs indexa las celdas desde 1.
    for (let i = 1; i < valores.length; i += 1) celdas.push(textoDeCelda(valores[i]));
    if (celdas.some((c) => c !== '')) filas.push(celdas);
  });
  return filas;
}

function esXlsx(buffer: Buffer, nombre: string): boolean {
  return /\.xlsx$/i.test(nombre) || (buffer[0] === 0x50 && buffer[1] === 0x4b);
}

/** Lee la planilla como matriz de textos (primera hoja). 400 si el formato no se admite o está vacía. */
export async function leerMatriz(buffer: Buffer, nombre: string): Promise<string[][]> {
  let matriz: string[][];
  if (esXlsx(buffer, nombre)) {
    matriz = await leerXlsx(buffer);
  } else if (/\.(csv|txt)$/i.test(nombre)) {
    matriz = leerCsv(buffer);
  } else {
    throw validacion('El archivo debe ser .xlsx o .csv.', {
      archivo: 'Formato no admitido: usá .xlsx o .csv.',
    });
  }
  if (matriz.length === 0) {
    throw validacion('La planilla está vacía.', { archivo: 'La planilla no tiene filas.' });
  }
  return matriz;
}

/** Definición de columnas: campo → alias de encabezado admitidos (ya normalizados). */
export type DefinicionColumnas<C extends string> = Record<C, readonly string[]>;

/**
 * Resuelve el índice de cada columna a partir de la primera fila. Devuelve null en las que
 * no aparecen; el que llama decide cuáles son obligatorias.
 */
export function resolverColumnas<C extends string>(
  primeraFila: string[],
  definicion: DefinicionColumnas<C>,
): Record<C, number | null> {
  const encabezados = primeraFila.map(normalizarEncabezado);
  const resultado = {} as Record<C, number | null>;
  for (const campo of Object.keys(definicion) as C[]) {
    const alias = definicion[campo].map(normalizarEncabezado);
    const indice = encabezados.findIndex((h) => alias.includes(h));
    resultado[campo] = indice < 0 ? null : indice;
  }
  return resultado;
}

/** Rechaza planillas por encima del tope de filas de datos. */
export function verificarTope(cantidadFilas: number): void {
  if (cantidadFilas > LIMITE_FILAS_IMPORTACION) {
    throw validacion(
      `La planilla tiene ${cantidadFilas} filas y el máximo es ${LIMITE_FILAS_IMPORTACION}. Dividila en varias.`,
      { archivo: `Máximo ${LIMITE_FILAS_IMPORTACION} filas.` },
    );
  }
}
