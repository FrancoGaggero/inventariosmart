import type {
  Gasto,
  GastoCreate,
  GastoPatch,
  ListaGastosMes,
  Mes,
  ResumenGastos,
  TipoGasto,
} from '@inventariosmart/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, desenvolver } from './api';
import { DASHBOARD_KEY } from './dashboard';

export const GASTOS_KEY = ['gastos'] as const;

/** Gastos que aplican a un mes, con totales. */
export function useGastosMes(periodo: Mes, tipo?: TipoGasto) {
  return useQuery({
    queryKey: [...GASTOS_KEY, 'mes', periodo, tipo ?? null],
    queryFn: async (): Promise<ListaGastosMes> =>
      desenvolver(await api.GET('/api/v1/expenses', { params: { query: { periodo, tipo } } })),
    staleTime: 15_000,
  });
}

/** Total del mes, unidades vendidas y gasto por unidad (RN-02). */
export function useResumenGastos(periodo: Mes) {
  return useQuery({
    queryKey: [...GASTOS_KEY, 'resumen', periodo],
    queryFn: async (): Promise<ResumenGastos> =>
      desenvolver(await api.GET('/api/v1/expenses/summary', { params: { query: { periodo } } })),
    staleTime: 15_000,
  });
}

export function useGasto(id: string | undefined) {
  return useQuery({
    queryKey: [...GASTOS_KEY, 'detalle', id],
    enabled: !!id,
    queryFn: async (): Promise<Gasto> =>
      desenvolver(await api.GET('/api/v1/expenses/{id}', { params: { path: { id: id! } } })),
  });
}

function useInvalidarGastos() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: GASTOS_KEY }),
      qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
    ]);
}

export function useCrearGasto() {
  const invalidar = useInvalidarGastos();
  return useMutation({
    mutationFn: async (body: GastoCreate): Promise<Gasto> =>
      desenvolver(await api.POST('/api/v1/expenses', { body })),
    onSuccess: () => void invalidar(),
  });
}

export function useActualizarGasto() {
  const invalidar = useInvalidarGastos();
  return useMutation({
    mutationFn: async ({ id, ...body }: GastoPatch & { id: string }): Promise<Gasto> =>
      desenvolver(await api.PATCH('/api/v1/expenses/{id}', { params: { path: { id } }, body })),
    onSuccess: () => void invalidar(),
  });
}

export function useEliminarGasto() {
  const invalidar = useInvalidarGastos();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      desenvolver(await api.DELETE('/api/v1/expenses/{id}', { params: { path: { id } } }));
    },
    onSuccess: () => void invalidar(),
  });
}

const nombreMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });

/** "2026-09" → "septiembre de 2026" */
export function formatearMes(mes: Mes): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return nombreMes.format(new Date(a, m - 1, 1));
}

export const CLASE_TIPO_GASTO: Record<TipoGasto, string> = {
  FIJO: 'bg-brand/15 text-brand-3',
  VARIABLE: 'bg-violet/15 text-violet',
};
