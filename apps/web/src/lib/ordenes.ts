import type {
  EstadoOrden,
  ListaOrdenes,
  OrdenCompra,
  OrdenCreate,
  OrdenPatch,
  SugerenciaOrdenes,
} from '@inventariosmart/shared';
import { ETIQUETA_ESTADO_ORDEN } from '@inventariosmart/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ALERTAS_KEY } from './alertas';
import { api, desenvolver } from './api';
import { DASHBOARD_KEY } from './dashboard';

export const ORDENES_KEY = ['ordenes'] as const;

export type FiltroEstadoOrden = EstadoOrden | 'TODAS';
export type SeveridadSugerencia = 'CRITICA' | 'TODAS';

/** Sugerencia agrupada por proveedor más conveniente (HU-07 criterio 1). Sólo lectura. */
export function useSugerencia(severidad: SeveridadSugerencia, enabled = true) {
  return useQuery({
    queryKey: [...ORDENES_KEY, 'sugerencia', severidad],
    enabled,
    queryFn: async (): Promise<SugerenciaOrdenes> =>
      desenvolver(
        await api.GET('/api/v1/purchase-orders/suggest', { params: { query: { severidad } } }),
      ),
    staleTime: 30_000,
  });
}

/** Órdenes paginadas por cursor, de la más reciente a la más antigua. */
export function useOrdenes(estado: FiltroEstadoOrden, enabled = true, limit = 25) {
  return useInfiniteQuery({
    queryKey: [...ORDENES_KEY, 'lista', estado, limit],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ListaOrdenes> =>
      desenvolver(
        await api.GET('/api/v1/purchase-orders', {
          params: { query: { estado, cursor: pageParam, limit } },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useOrden(id: string | undefined) {
  return useQuery({
    queryKey: [...ORDENES_KEY, 'detalle', id],
    enabled: !!id,
    queryFn: async (): Promise<OrdenCompra> =>
      desenvolver(await api.GET('/api/v1/purchase-orders/{id}', { params: { path: { id: id! } } })),
  });
}

function useInvalidarOrdenes() {
  const qc = useQueryClient();
  // Confirmar una orden atiende alertas (HU-07 criterio 3): se refrescan alertas y panel.
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ORDENES_KEY }),
      qc.invalidateQueries({ queryKey: ALERTAS_KEY }),
      qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
    ]);
}

export function useCrearOrden() {
  const invalidar = useInvalidarOrdenes();
  return useMutation({
    mutationFn: async (body: OrdenCreate): Promise<OrdenCompra> =>
      desenvolver(await api.POST('/api/v1/purchase-orders', { body })),
    onSuccess: () => void invalidar(),
  });
}

export function useEditarOrden() {
  const invalidar = useInvalidarOrdenes();
  return useMutation({
    mutationFn: async ({ id, ...body }: OrdenPatch & { id: string }): Promise<OrdenCompra> =>
      desenvolver(
        await api.PATCH('/api/v1/purchase-orders/{id}', { params: { path: { id } }, body }),
      ),
    onSuccess: () => void invalidar(),
  });
}

export function useConfirmarOrden() {
  const invalidar = useInvalidarOrdenes();
  return useMutation({
    mutationFn: async (id: string): Promise<OrdenCompra> =>
      desenvolver(
        await api.POST('/api/v1/purchase-orders/{id}/confirm', { params: { path: { id } } }),
      ),
    onSuccess: () => void invalidar(),
  });
}

export function useCancelarOrden() {
  const invalidar = useInvalidarOrdenes();
  return useMutation({
    mutationFn: async (id: string): Promise<OrdenCompra> =>
      desenvolver(
        await api.POST('/api/v1/purchase-orders/{id}/cancel', { params: { path: { id } } }),
      ),
    onSuccess: () => void invalidar(),
  });
}

export const CLASE_ESTADO_ORDEN: Record<EstadoOrden, string> = {
  BORRADOR: 'bg-fill text-t2',
  CONFIRMADA: 'bg-brand/15 text-brand-3',
  ENVIADA: 'bg-ok/15 text-ok',
  CANCELADA: 'bg-crit/15 text-crit',
};

export function etiquetaEstadoOrden(estado: EstadoOrden): string {
  return ETIQUETA_ESTADO_ORDEN[estado];
}

/** Frase de cabecera de la sugerencia en lenguaje claro (design D6). */
export function fraseSugerencia(s: SugerenciaOrdenes | undefined): string {
  if (!s) return 'Buscando qué conviene pedir…';
  const productos = s.grupos.reduce((n, g) => n + g.items.length, 0);
  if (productos === 0 && s.sinProveedor.length === 0) {
    return s.severidad === 'CRITICA'
      ? 'Ningún producto está por debajo de su punto de reposición.'
      : 'Ningún producto necesita reposición ahora.';
  }
  const proveedores = s.grupos.length;
  const base =
    productos === 1 ? 'Conviene pedir 1 producto' : `Conviene pedir ${productos} productos`;
  const a = proveedores === 1 ? ' a 1 proveedor' : ` a ${proveedores} proveedores`;
  const sin =
    s.sinProveedor.length > 0
      ? ` ${s.sinProveedor.length === 1 ? 'Uno no tiene' : `${s.sinProveedor.length} no tienen`} proveedor asignado.`
      : '';
  return `${base}${productos > 0 ? a : ''}.${sin}`;
}

/** Copia el texto de la orden al portapapeles; devuelve false si el navegador no lo permite. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

export type { OrdenCompra, SugerenciaOrdenes };
