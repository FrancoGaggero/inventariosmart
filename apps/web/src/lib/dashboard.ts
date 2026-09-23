import type { Dashboard, Mes } from '@inventariosmart/shared';
import { useQuery } from '@tanstack/react-query';
import { api, desenvolver } from './api';

export const DASHBOARD_KEY = ['dashboard'] as const;

/**
 * Panel del mes. Se actualiza solo: cada 60 s mientras la pestaña está visible, al volver a
 * la pestaña y cuando una mutación de movimientos, gastos o costos invalida `DASHBOARD_KEY`.
 */
export function useDashboard(periodo: Mes, enabled = true) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, periodo],
    enabled,
    queryFn: async (): Promise<Dashboard> =>
      desenvolver(await api.GET('/api/v1/dashboard', { params: { query: { periodo } } })),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
