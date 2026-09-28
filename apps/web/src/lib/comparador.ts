import type { ComparacionProducto, ResumenComparador } from '@inventariosmart/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ALERTAS_KEY } from './alertas';
import { api, desenvolver } from './api';
import { DASHBOARD_KEY } from './dashboard';
import { PRODUCTOS_KEY } from './productos';
import { RENTABILIDAD_KEY } from './rentabilidad';

// Las funciones de texto viven aparte para poder probarlas sin cargar la sesión de Firebase.
export * from './comparador-formato';

export const COMPARADOR_KEY = ['comparador'] as const;

export interface FiltrosComparador {
  soloOportunidades: boolean;
  q?: string;
}

/** Insumos con dos o más proveedores, por ahorro estimado (HU-12). Plan PREMIUM, sólo DUENIO. */
export function useComparador(filtros: FiltrosComparador, enabled = true, limit = 25) {
  return useInfiniteQuery({
    queryKey: [...COMPARADOR_KEY, 'resumen', filtros, limit],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ResumenComparador> =>
      desenvolver(
        await api.GET('/api/v1/supplier-comparison', {
          params: {
            query: {
              soloOportunidades: filtros.soloOportunidades ? 'true' : 'false',
              q: filtros.q || undefined,
              cursor: pageParam,
              limit,
            },
          },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
    staleTime: 15_000,
    placeholderData: (anterior) => anterior,
  });
}

/** Proveedores de un insumo, puntuados de mayor a menor. */
export function useComparacionProducto(productoId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...COMPARADOR_KEY, 'producto', productoId],
    enabled: enabled && !!productoId,
    queryFn: async (): Promise<ComparacionProducto> =>
      desenvolver(
        await api.GET('/api/v1/products/{id}/supplier-comparison', {
          params: { path: { id: productoId! } },
        }),
      ),
    staleTime: 15_000,
  });
}

/**
 * "Usar como principal": edita el producto (RN-08 cambia su costo de reposición), así que se
 * refresca todo lo que muestra costos o depende del proveedor.
 */
export function useUsarComoPrincipal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productoId, proveedorId }: { productoId: string; proveedorId: string }) =>
      desenvolver(
        await api.PATCH('/api/v1/products/{id}', {
          params: { path: { id: productoId } },
          body: { proveedorPrincipalId: proveedorId },
        }),
      ),
    onSuccess: () =>
      void Promise.all(
        [COMPARADOR_KEY, PRODUCTOS_KEY, DASHBOARD_KEY, RENTABILIDAD_KEY, ALERTAS_KEY].map(
          (queryKey) => qc.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
