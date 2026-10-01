import type { DiasStockParado, ListaStockParado } from '@inventariosmart/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, desenvolver } from './api';

// Las funciones de texto viven aparte para poder probarlas sin cargar la sesión de Firebase.
export * from './stock-parado-formato';

export const STOCK_PARADO_KEY = ['stock-parado'] as const;

/** Productos con stock y sin ventas en el período (HU-19). Plan PRO; DUENIO y CONTADOR. */
export function useStockParado(dias: DiasStockParado, enabled = true, limit = 25) {
  return useInfiniteQuery({
    queryKey: [...STOCK_PARADO_KEY, dias, limit],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ListaStockParado> =>
      desenvolver(
        await api.GET('/api/v1/dead-stock', {
          params: { query: { dias, cursor: pageParam, limit } },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
    staleTime: 30_000,
    placeholderData: (anterior) => anterior,
  });
}
