import { LIMITE_FILAS_IMPORTACION } from '@inventariosmart/shared';
import { validacion } from '../common/errors';

/** Fila cruda de la planilla: código y costo como texto, más su número de fila de datos. */
export interface FilaPlanilla {
  fila: number;
  codigo: string;
  costoTexto: string;
}

const ENCABEZADOS_CODIGO = new Set([
  'codigo',
  'cod',
  'sku',
  'codigo de producto',
  'codigo producto',
]);
const ENCABEZADOS_COSTO = new Set([
  'costo',
  'costo neto',
  'costo_neto',
  'costoneto',
  'precio',
  'precio neto',
  'precio_neto',
  'costo sin iva',
  'precio sin iva',
]);

function normalizarEncabezado(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_ ]/g, ' ')
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

/**
 * Lee una planilla de precios (.xlsx o .csv) y devuelve código y costo como texto por fila.
 * Detecta las columnas por encabezado; si no hay encabezados reconocibles usa las dos primeras.
 */
export async function parsearPlanilla(buffer: Buffer, nombre: string): Promise<FilaPlanilla[]> {
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

  const primera = matriz[0]!;
  const encabezados = primera.map(normalizarEncabezado);
  let colCodigo = encabezados.findIndex((h) => ENCABEZADOS_CODIGO.has(h));
  let colCosto = encabezados.findIndex((h) => ENCABEZADOS_COSTO.has(h));
  let inicio = 1;
  if (colCodigo < 0 || colCosto < 0) {
    if (primera.length < 2) {
      throw validacion(
        'No encontramos las columnas de código y costo. La planilla necesita al menos dos columnas: código de producto y costo neto.',
        { archivo: 'Faltan las columnas de código y costo.' },
      );
    }
    colCodigo = 0;
    colCosto = 1;
    // Sin encabezados reconocibles: la primera fila es dato salvo que su costo no sea un número.
    inicio = parsearMonto(primera[1] ?? '') === null ? 1 : 0;
  }

  const datos = matriz.slice(inicio);
  if (datos.length > LIMITE_FILAS_IMPORTACION) {
    throw validacion(
      `La planilla tiene ${datos.length} filas y el máximo es ${LIMITE_FILAS_IMPORTACION}. Dividila en varias.`,
      { archivo: `Máximo ${LIMITE_FILAS_IMPORTACION} filas.` },
    );
  }
  return datos.map((celdas, i) => ({
    fila: i + 1,
    codigo: (celdas[colCodigo] ?? '').trim(),
    costoTexto: (celdas[colCosto] ?? '').trim(),
  }));
}
