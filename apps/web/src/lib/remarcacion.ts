import type {
  ListaLotes,
  LoteRemarcacionDetalle,
  RemarcacionApply,
  RemarcacionPreview,
  ResultadoReversion,
  VistaPreviaRemarcacion,
} from '@inventariosmart/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, desenvolver } from './api';
import { DASHBOARD_KEY } from './dashboard';
import { INFLACION_KEY } from './inflacion';
import { PRODUCTOS_KEY } from './productos';
import { RENTABILIDAD_KEY } from './rentabilidad';

// Las funciones de texto viven aparte para poder probarlas sin cargar la sesión de Firebase.
export * from './remarcacion-formato';

export const REMARCACION_KEY = ['remarcacion'] as const;

/** Vista previa de una remarcación (HU-17). Es un POST pero no modifica nada. */
export function useVistaPrevia(pedido: RemarcacionPreview | null, enabled = true) {
  return useQuery({
    queryKey: [...REMARCACION_KEY, 'previa', pedido],
    enabled: enabled && pedido !== null,
    queryFn: async (): Promise<VistaPreviaRemarcacion> =>
      desenvolver(await api.POST('/api/v1/repricing/preview', { body: pedido! })),
    staleTime: 30_000,
    placeholderData: (anterior) => anterior,
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  // Remarcar cambia precios: se refresca todo lo que los muestra o calcula con ellos.
  return () =>
    Promise.all(
      [REMARCACION_KEY, PRODUCTOS_KEY, INFLACION_KEY, RENTABILIDAD_KEY, DASHBOARD_KEY].map(
        (queryKey) => qc.invalidateQueries({ queryKey }),
      ),
    );
}

export function useAplicarRemarcacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (body: RemarcacionApply): Promise<LoteRemarcacionDetalle> =>
      desenvolver(await api.POST('/api/v1/repricing/apply', { body })),
    onSuccess: () => void invalidar(),
  });
}

/** Remarcaciones del comercio, de la más reciente a la más antigua. */
export function useLotes(enabled = true, limit = 25) {
  return useInfiniteQuery({
    queryKey: [...REMARCACION_KEY, 'lotes', limit],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ListaLotes> =>
      desenvolver(
        await api.GET('/api/v1/repricing/batches', {
          params: { query: { cursor: pageParam, limit } },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useLote(id: string | null) {
  return useQuery({
    queryKey: [...REMARCACION_KEY, 'lote', id],
    enabled: id !== null,
    queryFn: async (): Promise<LoteRemarcacionDetalle> =>
      desenvolver(
        await api.GET('/api/v1/repricing/batches/{id}', { params: { path: { id: id! } } }),
      ),
  });
}

export function useDeshacerRemarcacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (id: string): Promise<ResultadoReversion> =>
      desenvolver(
        await api.POST('/api/v1/repricing/batches/{id}/revert', { params: { path: { id } } }),
      ),
    onSuccess: () => void invalidar(),
  });
}
