import { validacion } from './errors';

/**
 * Cursor opaco de paginación: base64url de una tupla de strings (convención de los listados).
 * Cada listado decide qué columnas van en la tupla y cómo se comparan.
 */
export function codificarCursor(partes: string[]): string {
  return Buffer.from(JSON.stringify(partes), 'utf8').toString('base64url');
}

export function decodificarCursor(cursor: string, cantidad: number): string[] {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      parsed.length === cantidad &&
      parsed.every((p) => typeof p === 'string')
    ) {
      return parsed as string[];
    }
  } catch {
    // cae al error de abajo
  }
  throw validacion('El cursor de paginación no es válido.', { cursor: 'Cursor inválido.' });
}
