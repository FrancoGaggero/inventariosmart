import type { DiasQuiebres, ListaQuiebres } from '@inventariosmart/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, desenvolver } from './api';

// Las funciones de texto viven aparte para poder probarlas sin cargar la sesión de Firebase.
export * from './quiebres-formato';

export const QUIEBRES_KEY = ['quiebres'] as const;

/** Pérdidas por falta de stock del período (HU-18). Plan PRO; DUENIO y CONTADOR. */
export function useQuiebres(dias: DiasQuiebres, enabled = true, limit = 25) {
  return useInfiniteQuery({
    queryKey: [...QUIEBRES_KEY, dias, limit],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ListaQuiebres> =>
      desenvolver(
        await api.GET('/api/v1/stockouts', {
          params: { query: { dias, cursor: pageParam, limit } },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
    staleTime: 30_000,
    placeholderData: (anterior) => anterior,
  });
}
