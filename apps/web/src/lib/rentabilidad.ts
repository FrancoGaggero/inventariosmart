import type { ListaRentabilidad, Mes, ResumenRentabilidad } from '@inventariosmart/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, desenvolver } from './api';

export const RENTABILIDAD_KEY = ['rentabilidad'] as const;

/** Rentabilidad por producto del mes, paginada por cursor. */
export function useRentabilidad(periodo: Mes, q: string, limit = 25) {
  return useInfiniteQuery({
    queryKey: [...RENTABILIDAD_KEY, 'productos', periodo, q, limit],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ListaRentabilidad> =>
      desenvolver(
        await api.GET('/api/v1/profitability/products', {
          params: { query: { periodo, q: q || undefined, cursor: pageParam, limit } },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
    staleTime: 15_000,
  });
}

/** Consolidado del mes. */
export function useResumenRentabilidad(periodo: Mes) {
  return useQuery({
    queryKey: [...RENTABILIDAD_KEY, 'resumen', periodo],
    queryFn: async (): Promise<ResumenRentabilidad> =>
      desenvolver(
        await api.GET('/api/v1/profitability/summary', { params: { query: { periodo } } }),
      ),
    staleTime: 15_000,
  });
}

/** "40.00" → "40,00 %"; null → "—". */
export function formatearPct(pct: string | null): string {
  if (pct === null) return '—';
  return `${Number(pct).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

/** Clase de color según el signo de un monto. */
export function claseSigno(monto: string | null): string {
  if (monto === null) return 'text-t2';
  return Number(monto) < 0 ? 'text-crit' : 'text-ok';
}
