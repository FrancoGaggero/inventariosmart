import type { HistorialPlan, Plan, PlanDetalle } from '@inventariosmart/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, desenvolver } from './api';

// Las funciones de texto viven aparte para poder probarlas sin cargar la sesión de Firebase.
export * from './plan-formato';

export const PLAN_KEY = ['plan'] as const;

/** Plan vigente, funcionalidades y uso (HU-14). Todos los roles y planes. */
export function usePlan(enabled = true) {
  return useQuery({
    queryKey: [...PLAN_KEY, 'detalle'],
    enabled,
    queryFn: async (): Promise<PlanDetalle> => desenvolver(await api.GET('/api/v1/plan')),
    staleTime: 15_000,
  });
}

/** Cambios de plan del comercio. Sólo DUENIO. */
export function useHistorialPlan(enabled = true, limit = 10) {
  return useInfiniteQuery({
    queryKey: [...PLAN_KEY, 'historial', limit],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<HistorialPlan> =>
      desenvolver(
        await api.GET('/api/v1/plan/history', {
          params: { query: { cursor: pageParam, limit } },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useCambiarPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Plan): Promise<PlanDetalle> =>
      desenvolver(await api.POST('/api/v1/plan/change', { body: { plan } })),
    onSuccess: (detalle) => {
      qc.setQueryData([...PLAN_KEY, 'detalle'], detalle);
      // Cualquier consulta puede pasar de 402 a 200 o al revés: se refresca todo, sesión incluida.
      void qc.invalidateQueries();
    },
  });
}
