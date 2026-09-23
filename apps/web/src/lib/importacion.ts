import type {
  ImportacionProductosConfirm,
  ResultadoImportacionProductos,
  VistaPreviaImportacion,
} from '@inventariosmart/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL, ErrorApi, api, comoApiError, desenvolver } from './api';
import { obtenerIdToken } from './auth';
import { DASHBOARD_KEY } from './dashboard';
import { MOVIMIENTOS_KEY } from './movimientos';
import { PRODUCTOS_KEY } from './productos';

/** Vista previa de una planilla de productos (multipart con fetch directo, como las listas de precios). */
export function useVistaPreviaProductos() {
  return useMutation({
    mutationFn: async (archivo: File): Promise<VistaPreviaImportacion> => {
      const form = new FormData();
      form.append('archivo', archivo, archivo.name);
      const token = await obtenerIdToken();
      const res = await fetch(`${API_URL}/api/v1/import/preview`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const cuerpo: unknown = await res.json().catch(() => undefined);
      if (!res.ok) throw new ErrorApi(res.status, comoApiError(cuerpo));
      return cuerpo as VistaPreviaImportacion;
    },
  });
}

/** Confirmación: crea y actualiza productos; refresca inventario, movimientos y panel. */
export function useConfirmarImportacionProductos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ImportacionProductosConfirm): Promise<ResultadoImportacionProductos> =>
      desenvolver(await api.POST('/api/v1/import/commit', { body })),
    onSuccess: () =>
      void Promise.all([
        qc.invalidateQueries({ queryKey: PRODUCTOS_KEY }),
        qc.invalidateQueries({ queryKey: MOVIMIENTOS_KEY }),
        qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
      ]),
  });
}
