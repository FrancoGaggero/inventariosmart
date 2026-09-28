import type { ComparacionInflacion, Indicadores, Mes } from '@inventariosmart/shared';
import { useQuery } from '@tanstack/react-query';
import { api, desenvolver } from './api';
import { desdeDelPeriodo } from './inflacion-formato';

// Las funciones de formato viven aparte para poder probarlas sin cargar la sesión de Firebase.
export * from './inflacion-formato';

export const INFLACION_KEY = ['inflacion'] as const;

/** Indicadores oficiales (HU-15). La API los actualiza una vez por día: no hace falta insistir. */
export function useIndicadores(enabled = true) {
  return useQuery({
    queryKey: [...INFLACION_KEY, 'indicadores'],
    enabled,
    queryFn: async (): Promise<Indicadores> => desenvolver(await api.GET('/api/v1/indicators')),
    staleTime: 10 * 60_000,
  });
}

/** Mis precios y costos frente a la inflación en los últimos `meses` (HU-15). */
export function useComparacionInflacion(
  meses: number,
  ultimoIpc: Mes | null | undefined,
  enabled = true,
) {
  const desde = desdeDelPeriodo(meses, ultimoIpc);
  return useQuery({
    queryKey: [...INFLACION_KEY, 'comparacion', desde],
    enabled,
    queryFn: async (): Promise<ComparacionInflacion> =>
      desenvolver(await api.GET('/api/v1/insights/inflation', { params: { query: { desde } } })),
    staleTime: 60_000,
    placeholderData: (anterior) => anterior,
  });
}
