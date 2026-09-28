import type {
  ConversacionDetalle,
  ListaConversaciones,
  MensajeCreate,
  RespuestaAsistente,
} from '@inventariosmart/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ALERTAS_KEY } from './alertas';
import { api, desenvolver } from './api';
import { ORDENES_KEY } from './ordenes';

// Las funciones de texto viven aparte para poder probarlas sin cargar la sesión de Firebase.
export * from './asistente-formato';

export const ASISTENTE_KEY = ['asistente'] as const;

/** Conversaciones del usuario con el asistente (HU-08). Plan PREMIUM, sólo DUENIO. */
export function useConversaciones(enabled = true, limit = 25) {
  return useInfiniteQuery({
    queryKey: [...ASISTENTE_KEY, 'conversaciones', limit],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ListaConversaciones> =>
      desenvolver(
        await api.GET('/api/v1/assistant/conversations', {
          params: { query: { cursor: pageParam, limit } },
        }),
      ),
    getNextPageParam: (ultima) => ultima.siguienteCursor ?? undefined,
    staleTime: 15_000,
  });
}

/**
 * Mensajes de una conversación. No se vuelve a pedir mientras se conversa: la página suma los
 * mensajes nuevos a los que ya trajo.
 */
export function useConversacion(id: string | null, enabled = true) {
  return useQuery({
    queryKey: [...ASISTENTE_KEY, 'conversacion', id],
    enabled: enabled && id !== null,
    queryFn: async (): Promise<ConversacionDetalle> =>
      desenvolver(
        await api.GET('/api/v1/assistant/conversations/{id}', { params: { path: { id: id! } } }),
      ),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  });
}

export function useEnviarMensaje() {
  const qc = useQueryClient();
  return useMutation({
    // La respuesta puede tardar: no se reintenta sola, para no repetir la consulta.
    retry: false,
    mutationFn: async (body: MensajeCreate): Promise<RespuestaAsistente> =>
      desenvolver(await api.POST('/api/v1/assistant/messages', { body })),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: [...ASISTENTE_KEY, 'conversaciones'] });
      // Un borrador nuevo aparece en Órdenes y puede atender alertas al confirmarse.
      if (r.mensaje.acciones.length > 0) {
        void qc.invalidateQueries({ queryKey: ORDENES_KEY });
        void qc.invalidateQueries({ queryKey: ALERTAS_KEY });
      }
    },
  });
}
