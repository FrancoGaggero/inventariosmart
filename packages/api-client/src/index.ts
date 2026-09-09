import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './generated/schema';

export type { paths } from './generated/schema';

/** Función que devuelve el ID token de Firebase del usuario actual, o null si no hay sesión. */
export type ObtenerToken = () => Promise<string | null>;

/**
 * Cliente tipado de la API. Cada llamada valida ruta, parámetros y respuesta
 * contra el contrato OpenAPI exportado por la API (docs/openapi.json).
 */
export function crearClienteApi(baseUrl: string, obtenerToken: ObtenerToken) {
  const client = createClient<paths>({ baseUrl });

  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await obtenerToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
  };
  client.use(auth);

  return client;
}

export type ClienteApi = ReturnType<typeof crearClienteApi>;
