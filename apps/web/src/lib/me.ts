import type { Me, Rol } from '@inventariosmart/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, desenvolver } from './api';
import { useAuth } from './auth';

export const ME_KEY = ['me'] as const;

/** Usuario + comercio + rol + plan resueltos por la API (GET /api/v1/me). */
export function useMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...ME_KEY, user?.uid ?? null],
    queryFn: async (): Promise<Me> => desenvolver(await api.GET('/api/v1/me')),
    enabled: !!user,
    staleTime: 60_000,
    retry: (count, err) => {
      // 401/403 no se reintentan: la sesión no sirve o el usuario fue dado de baja.
      const status = (err as { status?: number }).status ?? 0;
      return status !== 401 && status !== 403 && count < 2;
    },
  });
}

export function useInvalidarMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ME_KEY });
}

export const NOMBRE_ROL: Record<Rol, string> = {
  DUENIO: 'Dueño',
  EMPLEADO: 'Empleado',
  CONTADOR: 'Contador',
};
