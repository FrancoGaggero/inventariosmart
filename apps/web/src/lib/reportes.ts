import type {
  AjustesReportes,
  AjustesReportesPatch,
  ListaReportes,
  ReporteSemanal,
} from '@inventariosmart/shared';
import { diasDeSemana } from '@inventariosmart/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, desenvolver } from './api';

export const REPORTES_KEY = ['reportes'] as const;

/** Reportes semanales, del más reciente al más antiguo (HU-09). */
export function useReportes(enabled = true, limit = 12) {
  return useInfiniteQuery({
    queryKey: [...REPORTES_KEY, 'lista', limit],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ListaReportes> =>
      desenvolver(
        await api.GET('/api/v1/reports/weekly', {
          params: { query: { cursor: pageParam, limit } },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
    staleTime: 60_000,
  });
}

export function useReporte(id: string | undefined) {
  return useQuery({
    queryKey: [...REPORTES_KEY, 'detalle', id],
    enabled: !!id,
    queryFn: async (): Promise<ReporteSemanal> =>
      desenvolver(await api.GET('/api/v1/reports/weekly/{id}', { params: { path: { id: id! } } })),
  });
}

export function useAjustesReportes(enabled = true) {
  return useQuery({
    queryKey: [...REPORTES_KEY, 'ajustes'],
    enabled,
    queryFn: async (): Promise<AjustesReportes> =>
      desenvolver(await api.GET('/api/v1/reports/settings')),
    staleTime: 60_000,
  });
}

function useInvalidarReportes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: REPORTES_KEY });
}

export function useGenerarReporte() {
  const invalidar = useInvalidarReportes();
  return useMutation({
    mutationFn: async (body: { semana?: string; enviar?: boolean }): Promise<ReporteSemanal> =>
      desenvolver(await api.POST('/api/v1/reports/weekly/generate', { body })),
    onSuccess: () => void invalidar(),
  });
}

export function useReenviarReporte() {
  const invalidar = useInvalidarReportes();
  return useMutation({
    mutationFn: async (id: string): Promise<ReporteSemanal> =>
      desenvolver(
        await api.POST('/api/v1/reports/weekly/{id}/resend', { params: { path: { id } } }),
      ),
    onSuccess: () => void invalidar(),
  });
}

export function useActualizarAjustesReportes() {
  const invalidar = useInvalidarReportes();
  return useMutation({
    mutationFn: async (body: AjustesReportesPatch): Promise<AjustesReportes> =>
      desenvolver(await api.PATCH('/api/v1/reports/settings', { body })),
    onSuccess: () => void invalidar(),
  });
}

const dia = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const diaConAnio = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "14 al 20 de sept. de 2026" a partir de `2026-W38`. */
export function formatearSemana(semana: string): string {
  const { lunes, domingo } = diasDeSemana(semana as `${number}-W${string}`);
  return `${dia.format(new Date(`${lunes}T00:00:00Z`))} al ${diaConAnio.format(new Date(`${domingo}T00:00:00Z`))}`;
}

/** Frase de cabecera con el último reporte (design D7). */
export function fraseReportes(ultimo: ListaReportes['items'][number] | undefined): string {
  if (!ultimo) return 'Cada lunes te llega por correo cómo te fue la semana anterior.';
  if (ultimo.unidadesVendidas === 0) {
    return `Semana del ${formatearSemana(ultimo.semana)}: sin ventas registradas.`;
  }
  const pct =
    ultimo.margenBrutoPct === null
      ? ''
      : ` con un margen bruto del ${Number(ultimo.margenBrutoPct).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;
  return `Semana del ${formatearSemana(ultimo.semana)}: vendiste ${ultimo.unidadesVendidas} unidades${pct}.`;
}

export type { ReporteSemanal };
