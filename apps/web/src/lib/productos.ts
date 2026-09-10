import type { EstadoStock, Producto, ProductoCreate, ProductoPatch } from '@inventariosmart/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, desenvolver } from './api';

export const PRODUCTOS_KEY = ['productos'] as const;

export interface FiltrosProductos {
  q?: string;
  estado?: EstadoStock;
  /** false = dados de baja */
  activo: boolean;
}

/** Listado paginado por cursor; cada página trae `siguienteCursor` (convención de la API). */
export function useProductos(filtros: FiltrosProductos, limit = 25) {
  return useInfiniteQuery({
    queryKey: [...PRODUCTOS_KEY, filtros, limit],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      desenvolver(
        await api.GET('/api/v1/products', {
          params: {
            query: {
              q: filtros.q || undefined,
              estado: filtros.estado,
              activo: filtros.activo ? 'true' : 'false',
              cursor: pageParam,
              limit,
            },
          },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useProducto(id: string | undefined) {
  return useQuery({
    queryKey: [...PRODUCTOS_KEY, 'detalle', id],
    enabled: !!id,
    queryFn: async () =>
      desenvolver(await api.GET('/api/v1/products/{id}', { params: { path: { id: id! } } })),
  });
}

function useInvalidarProductos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PRODUCTOS_KEY });
}

export function useCrearProducto() {
  const invalidar = useInvalidarProductos();
  return useMutation({
    mutationFn: async (body: ProductoCreate) =>
      desenvolver(await api.POST('/api/v1/products', { body })),
    onSuccess: () => void invalidar(),
  });
}

export function useActualizarProducto() {
  const invalidar = useInvalidarProductos();
  return useMutation({
    mutationFn: async ({ id, ...body }: ProductoPatch & { id: string }) =>
      desenvolver(await api.PATCH('/api/v1/products/{id}', { params: { path: { id } }, body })),
    onSuccess: () => void invalidar(),
  });
}

export function useDarDeBajaProducto() {
  const invalidar = useInvalidarProductos();
  return useMutation({
    mutationFn: async (id: string) =>
      desenvolver(await api.DELETE('/api/v1/products/{id}', { params: { path: { id } } })),
    onSuccess: () => void invalidar(),
  });
}

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

/** "3900.00" → "$ 3.900,00" */
export function formatearPesos(monto: string | number | undefined): string {
  if (monto === undefined || monto === '') return '—';
  return pesos.format(Number(monto));
}

export const ETIQUETA_ESTADO: Record<EstadoStock, { texto: string; clase: string }> = {
  OK: { texto: 'OK', clase: 'bg-ok/15 text-ok' },
  BAJO: { texto: 'Bajo', clase: 'bg-warn/15 text-warn' },
  SIN_STOCK: { texto: 'Sin stock', clase: 'bg-crit/15 text-crit' },
};

export type { Producto };
