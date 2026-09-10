import { crearClienteApi } from '@inventariosmart/api-client';
import { ApiErrorSchema, type ApiError, type CodigoError } from '@inventariosmart/shared';
import { obtenerIdToken } from './auth';

export const API_URL =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3000';

/** Cliente tipado contra docs/openapi.json; adjunta el ID token de Firebase en cada llamada. */
export const api = crearClienteApi(API_URL, obtenerIdToken);

/** Error de la API con el status HTTP, para decidir en la UI (402 plan, 403 permiso, 409…). */
export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly error: ApiError,
  ) {
    super(error.message);
    this.name = 'ErrorApi';
  }

  es(code: CodigoError): boolean {
    return this.error.code === code;
  }
}

/** Convierte un `{ data, error, response }` de openapi-fetch en dato o lanza ErrorApi. */
export function desenvolver<T>(r: { data?: T; error?: unknown; response: Response }): T {
  if (r.error !== undefined || !r.response.ok) {
    throw new ErrorApi(r.response.status, comoApiError(r.error));
  }
  return r.data as T;
}

/** Convierte cualquier error en un ApiError usable por la UI. */
export function comoApiError(error: unknown): ApiError {
  if (error instanceof ErrorApi) return error.error;
  const parsed = ApiErrorSchema.safeParse(error);
  if (parsed.success) return parsed.data;
  return {
    code: 'ERROR_INTERNO',
    message: 'No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.',
  };
}

export function mensajeDe(error: unknown): string {
  return comoApiError(error).message;
}
