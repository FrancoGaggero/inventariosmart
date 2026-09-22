import type {
  ImportacionConfirm,
  ListaPrecios,
  PreciosCreate,
  Proveedor,
  ProveedorCreate,
  ProveedorPatch,
  ResultadoImportacion,
  VistaPrevia,
} from '@inventariosmart/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, ErrorApi, api, comoApiError, desenvolver } from './api';
import { obtenerIdToken } from './auth';
import { PRODUCTOS_KEY } from './productos';

export const PROVEEDORES_KEY = ['proveedores'] as const;
export const PRECIOS_KEY = ['precios'] as const;

export interface FiltrosProveedores {
  q?: string;
  /** false = dados de baja */
  activo: boolean;
}

export function useProveedores(filtros: FiltrosProveedores, limit = 25, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...PROVEEDORES_KEY, filtros, limit],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      desenvolver(
        await api.GET('/api/v1/suppliers', {
          params: {
            query: {
              q: filtros.q || undefined,
              activo: filtros.activo ? 'true' : 'false',
              cursor: pageParam,
              limit,
            },
          },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useProveedor(id: string | undefined) {
  return useQuery({
    queryKey: [...PROVEEDORES_KEY, 'detalle', id],
    enabled: !!id,
    queryFn: async () =>
      desenvolver(await api.GET('/api/v1/suppliers/{id}', { params: { path: { id: id! } } })),
  });
}

function useInvalidarProveedores() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PROVEEDORES_KEY });
}

/** Un costo nuevo puede cambiar el costo vigente del producto: se refrescan precios y productos. */
function useInvalidarCostos() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: PRECIOS_KEY }),
      qc.invalidateQueries({ queryKey: PRODUCTOS_KEY }),
    ]);
}

export function useCrearProveedor() {
  const invalidar = useInvalidarProveedores();
  return useMutation({
    mutationFn: async (body: ProveedorCreate): Promise<Proveedor> =>
      desenvolver(await api.POST('/api/v1/suppliers', { body })),
    onSuccess: () => void invalidar(),
  });
}

export function useActualizarProveedor() {
  const invalidar = useInvalidarProveedores();
  return useMutation({
    mutationFn: async ({ id, ...body }: ProveedorPatch & { id: string }): Promise<Proveedor> =>
      desenvolver(await api.PATCH('/api/v1/suppliers/{id}', { params: { path: { id } }, body })),
    onSuccess: () => void invalidar(),
  });
}

export function useDarDeBajaProveedor() {
  const invalidar = useInvalidarProveedores();
  return useMutation({
    mutationFn: async (id: string): Promise<Proveedor> =>
      desenvolver(await api.DELETE('/api/v1/suppliers/{id}', { params: { path: { id } } })),
    onSuccess: () => void invalidar(),
  });
}

/** Lista vigente del proveedor: último costo por producto. */
export function usePreciosProveedor(proveedorId: string | undefined, limit = 25) {
  return useInfiniteQuery({
    queryKey: [...PRECIOS_KEY, 'proveedor', proveedorId, limit],
    enabled: !!proveedorId,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ListaPrecios> =>
      desenvolver(
        await api.GET('/api/v1/suppliers/{id}/prices', {
          params: { path: { id: proveedorId! }, query: { cursor: pageParam, limit } },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
  });
}

/** Historial de costos de un producto, de todos los proveedores. */
export function useHistorialCostos(productoId: string | undefined, limit = 10) {
  return useInfiniteQuery({
    queryKey: [...PRECIOS_KEY, 'producto', productoId, limit],
    enabled: !!productoId,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ListaPrecios> =>
      desenvolver(
        await api.GET('/api/v1/products/{id}/prices', {
          params: { path: { id: productoId! }, query: { cursor: pageParam, limit } },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
  });
}

export function useCargarPrecios(proveedorId: string) {
  const invalidar = useInvalidarCostos();
  return useMutation({
    mutationFn: async (body: PreciosCreate) =>
      desenvolver(
        await api.POST('/api/v1/suppliers/{id}/prices', {
          params: { path: { id: proveedorId } },
          body,
        }),
      ),
    onSuccess: () => void invalidar(),
  });
}

/**
 * Vista previa de una planilla: multipart con `fetch` directo (el cliente tipado no serializa
 * FormData); el token se adjunta igual que en el resto de las llamadas.
 */
export function useVistaPrevia(proveedorId: string) {
  return useMutation({
    mutationFn: async (archivo: File): Promise<VistaPrevia> => {
      const form = new FormData();
      form.append('archivo', archivo, archivo.name);
      const token = await obtenerIdToken();
      const res = await fetch(`${API_URL}/api/v1/suppliers/${proveedorId}/price-list/preview`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const cuerpo: unknown = await res.json().catch(() => undefined);
      if (!res.ok) throw new ErrorApi(res.status, comoApiError(cuerpo));
      return cuerpo as VistaPrevia;
    },
  });
}

export function useConfirmarImportacion(proveedorId: string) {
  const invalidar = useInvalidarCostos();
  return useMutation({
    mutationFn: async (body: ImportacionConfirm): Promise<ResultadoImportacion> =>
      desenvolver(
        await api.POST('/api/v1/suppliers/{id}/price-list', {
          params: { path: { id: proveedorId } },
          body,
        }),
      ),
    onSuccess: () => void invalidar(),
  });
}

const fecha = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatearFecha(iso: string): string {
  return fecha.format(new Date(iso));
}

/** "★★★★☆" para la confiabilidad de 1 a 5. */
export function estrellas(confiabilidad: number): string {
  return '★'.repeat(confiabilidad) + '☆'.repeat(Math.max(0, 5 - confiabilidad));
}

export type { Proveedor };
