import type {
  Alerta,
  AlertaAccion,
  EstadoAlerta,
  ResultadoRecalculo,
  ResumenAlertas,
} from '@inventariosmart/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, desenvolver } from './api';
import { DASHBOARD_KEY } from './dashboard';

export const ALERTAS_KEY = ['alertas'] as const;

export type FiltroEstadoAlerta = EstadoAlerta | 'TODAS';

/** Alertas de reposición paginadas por cursor, por días de cobertura (HU-06). */
export function useAlertas(estado: FiltroEstadoAlerta, enabled = true, limit = 25) {
  return useInfiniteQuery({
    queryKey: [...ALERTAS_KEY, 'lista', estado, limit],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      desenvolver(
        await api.GET('/api/v1/alerts', {
          params: { query: { estado, cursor: pageParam, limit } },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
    staleTime: 30_000,
  });
}

/** Contadores para la navegación y la cabecera; se refresca cada minuto. */
export function useResumenAlertas(enabled = true) {
  return useQuery({
    queryKey: [...ALERTAS_KEY, 'resumen'],
    enabled,
    queryFn: async (): Promise<ResumenAlertas> =>
      desenvolver(await api.GET('/api/v1/alerts/summary')),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

function useInvalidarAlertas() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ALERTAS_KEY }),
      qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
    ]);
}

export function useRecalcularAlertas() {
  const invalidar = useInvalidarAlertas();
  return useMutation({
    mutationFn: async (): Promise<ResultadoRecalculo> =>
      desenvolver(await api.POST('/api/v1/alerts/recalculate')),
    onSuccess: () => void invalidar(),
  });
}

export function useAccionAlerta() {
  const invalidar = useInvalidarAlertas();
  return useMutation({
    mutationFn: async ({ id, ...body }: AlertaAccion & { id: string }): Promise<Alerta> =>
      desenvolver(await api.PATCH('/api/v1/alerts/{id}', { params: { path: { id } }, body })),
    onSuccess: () => void invalidar(),
  });
}

/** Frase de cabecera en lenguaje claro (design D7). */
export function fraseAlertas(r: ResumenAlertas | undefined): string {
  if (!r) return 'Calculando con las ventas de los últimos 30 días…';
  if (r.activas === 0) {
    return r.pospuestas > 0
      ? `Sin alertas activas; ${r.pospuestas} pospuesta${r.pospuestas === 1 ? '' : 's'}.`
      : 'Ningún producto se va a quedar sin stock antes de que llegue la reposición.';
  }
  const productos = r.activas === 1 ? '1 producto va' : `${r.activas} productos van`;
  const criticas =
    r.criticas > 0
      ? ` ${r.criticas === 1 ? 'Uno ya está' : `${r.criticas} ya están`} por debajo del punto de reposición.`
      : '';
  return `${productos} a quedarse sin stock antes de que llegue la reposición.${criticas}`;
}

const fechaHora = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** "23/09, 14:05" en hora local; "—" si es null. */
export function formatearCalculo(iso: string | null): string {
  return iso ? fechaHora.format(new Date(iso)) : '—';
}

/** "9 días", "hoy" o "sin ventas". */
export function formatearCobertura(dias: number | null): string {
  if (dias === null) return 'sin ventas';
  if (dias === 0) return 'se agota hoy';
  return dias === 1 ? '1 día' : `${dias} días`;
}

export type { Alerta };
