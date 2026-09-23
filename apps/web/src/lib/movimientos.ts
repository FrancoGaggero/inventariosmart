import type {
  Anulacion,
  Movimiento,
  MovimientoCreate,
  TipoMovimiento,
} from '@inventariosmart/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { api, desenvolver } from './api';
import { DASHBOARD_KEY } from './dashboard';
import { PRODUCTOS_KEY } from './productos';

export const MOVIMIENTOS_KEY = ['movimientos'] as const;

export interface FiltrosMovimientos {
  productoId?: string;
  tipo?: TipoMovimiento;
  /** ISO 8601 */
  desde?: string;
  /** ISO 8601 */
  hasta?: string;
}

/** Historial paginado por cursor, del más reciente al más antiguo. */
export function useMovimientos(filtros: FiltrosMovimientos, limit = 25) {
  return useInfiniteQuery({
    queryKey: [...MOVIMIENTOS_KEY, filtros, limit],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      desenvolver(
        await api.GET('/api/v1/movements', {
          params: {
            query: {
              productoId: filtros.productoId,
              tipo: filtros.tipo,
              desde: filtros.desde,
              hasta: filtros.hasta,
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

export function useMovimiento(id: string | undefined) {
  return useQuery({
    queryKey: [...MOVIMIENTOS_KEY, 'detalle', id],
    enabled: !!id,
    queryFn: async () =>
      desenvolver(await api.GET('/api/v1/movements/{id}', { params: { path: { id: id! } } })),
  });
}

/** Un movimiento cambia el stock: se refrescan movimientos y productos. */
function useInvalidarStock() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: MOVIMIENTOS_KEY }),
      qc.invalidateQueries({ queryKey: PRODUCTOS_KEY }),
      qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
    ]);
}

function nuevaClave(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Registra un movimiento con una Idempotency-Key por intento: si la red falla después de
 * que la API lo guardó, el reintento devuelve el mismo movimiento en lugar de duplicar la venta.
 * La clave se renueva recién cuando el registro fue exitoso.
 */
export function useRegistrarMovimiento() {
  const invalidar = useInvalidarStock();
  const clave = useRef(nuevaClave());
  return useMutation({
    mutationFn: async (body: MovimientoCreate): Promise<Movimiento> =>
      desenvolver(
        await api.POST('/api/v1/movements', {
          body,
          params: { header: { 'Idempotency-Key': clave.current } },
        }),
      ),
    onSuccess: () => {
      clave.current = nuevaClave();
      void invalidar();
    },
  });
}

export function useAnularMovimiento() {
  const invalidar = useInvalidarStock();
  return useMutation({
    mutationFn: async ({ id, ...body }: Anulacion & { id: string }): Promise<Movimiento> =>
      desenvolver(
        await api.POST('/api/v1/movements/{id}/anular', { params: { path: { id } }, body }),
      ),
    onSuccess: () => void invalidar(),
  });
}

const fechaHora = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "2026-09-22T15:04:05.000Z" → "22/09/2026, 12:04" (hora local). */
export function formatearFechaHora(iso: string): string {
  return fechaHora.format(new Date(iso));
}

/** "+30" / "−2" para la columna de cantidad del historial. */
export function formatearEfecto(efecto: number): string {
  return efecto > 0 ? `+${efecto}` : `−${Math.abs(efecto)}`;
}

/** Valor de un `<input type="datetime-local">` (hora local) → ISO 8601 en UTC. */
export function localAIso(valor: string): string | undefined {
  if (!valor) return undefined;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Ahora, en el formato que espera `<input type="datetime-local">`. */
export function ahoraLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Principio y fin del día local para un `<input type="date">` → ISO 8601. */
export function diaAIso(valor: string, borde: 'inicio' | 'fin'): string | undefined {
  if (!valor) return undefined;
  const d = new Date(`${valor}T${borde === 'inicio' ? '00:00:00.000' : '23:59:59.999'}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export const ETIQUETA_TIPO_CLASE: Record<TipoMovimiento, string> = {
  VENTA: 'bg-brand/15 text-brand-3',
  INGRESO: 'bg-ok/15 text-ok',
  AJUSTE: 'bg-warn/15 text-warn',
};

export type { Movimiento };
