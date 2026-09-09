import { crearClienteApi } from '@inventariosmart/api-client';
import { ApiErrorSchema, type ApiError } from '@inventariosmart/shared';
import { obtenerIdToken } from './auth';

export const API_URL =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3000';

/** Cliente tipado contra docs/openapi.json; adjunta el ID token de Firebase en cada llamada. */
export const api = crearClienteApi(API_URL, obtenerIdToken);

/** Convierte el cuerpo de error de la API en un ApiError usable por la UI. */
export function comoApiError(error: unknown): ApiError {
  const parsed = ApiErrorSchema.safeParse(error);
  if (parsed.success) return parsed.data;
  return {
    code: 'ERROR_INTERNO',
    message: 'No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.',
  };
}
