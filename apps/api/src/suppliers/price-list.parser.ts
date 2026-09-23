import { validacion } from '../common/errors';
import { leerMatriz, parsearMonto, resolverColumnas, verificarTope } from '../common/planillas';

export { parsearMonto } from '../common/planillas';

/** Fila cruda de la planilla: código y costo como texto, más su número de fila de datos. */
export interface FilaPlanilla {
  fila: number;
  codigo: string;
  costoTexto: string;
}

const COLUMNAS = {
  codigo: ['codigo', 'cod', 'sku', 'codigo de producto', 'codigo producto'],
  costo: [
    'costo',
    'costo neto',
    'costo_neto',
    'costoneto',
    'precio',
    'precio neto',
    'precio_neto',
    'costo sin iva',
    'precio sin iva',
  ],
} as const;

/**
 * Lee una planilla de precios (.xlsx o .csv) y devuelve código y costo como texto por fila.
 * Detecta las columnas por encabezado; si no hay encabezados reconocibles usa las dos primeras.
 */
export async function parsearPlanilla(buffer: Buffer, nombre: string): Promise<FilaPlanilla[]> {
  const matriz = await leerMatriz(buffer, nombre);
  const primera = matriz[0]!;
  const columnas = resolverColumnas(primera, COLUMNAS);
  let colCodigo = columnas.codigo;
  let colCosto = columnas.costo;
  let inicio = 1;
  if (colCodigo === null || colCosto === null) {
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
  verificarTope(datos.length);
  return datos.map((celdas, i) => ({
    fila: i + 1,
    codigo: (celdas[colCodigo] ?? '').trim(),
    costoTexto: (celdas[colCosto] ?? '').trim(),
  }));
}
