import { useQuery } from '@tanstack/react-query';
import { Activity, LogOut, ShieldCheck } from 'lucide-react';
import { api, API_URL, comoApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Sprint 0: pantalla de prueba de humo. Muestra la identidad que devuelve la API
 * (GET /api/v1/me) y el estado del servicio (GET /api/v1/health).
 * El dashboard real llega con HU-04.
 */
export function MePage() {
  const { user, logout } = useAuth();

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/me');
      if (error) throw comoApiError(error);
      return data;
    },
  });

  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/health');
      if (error) throw comoApiError(error);
      return data;
    },
    refetchInterval: 30_000,
  });

  return (
    <main className="min-h-full p-6 md:p-10 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs text-t2">Buen día,</p>
          <h1 className="text-xl font-extrabold tracking-tight">
            {user?.displayName ?? user?.email ?? 'Usuario'}
          </h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
          <LogOut className="w-4 h-4" aria-hidden />
          Cerrar sesión
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="card p-5">
          <div className="flex items-center gap-2 text-sm font-bold mb-3">
            <ShieldCheck className="w-4 h-4 text-brand-3" aria-hidden />
            Identidad verificada por la API
          </div>
          {me.isPending && <p className="text-t2 text-sm">Consultando GET /api/v1/me…</p>}
          {me.isError && (
            <p role="alert" className="text-sm text-crit">
              {comoApiError(me.error).message}
            </p>
          )}
          {me.data && (
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-t2">Email</dt>
                <dd className="font-semibold text-right break-all">{me.data.email ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-t2">UID</dt>
                <dd className="font-mono text-xs text-right break-all">{me.data.uid}</dd>
              </div>
            </dl>
          )}
        </article>

        <article className="card p-5">
          <div className="flex items-center gap-2 text-sm font-bold mb-3">
            <Activity className="w-4 h-4 text-ok" aria-hidden />
            Estado del servicio
          </div>
          {health.isPending && <p className="text-t2 text-sm">Consultando GET /api/v1/health…</p>}
          {health.isError && (
            <p role="alert" className="text-sm text-crit">
              {comoApiError(health.error).message}
            </p>
          )}
          {health.data && (
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-t2">API</dt>
                <dd className="font-semibold text-ok">{health.data.status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-t2">Base de datos</dt>
                <dd
                  className={`font-semibold ${health.data.db === 'ok' ? 'text-ok' : 'text-crit'}`}
                >
                  {health.data.db}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-t2">Versión</dt>
                <dd className="font-mono text-xs">{health.data.version}</dd>
              </div>
            </dl>
          )}
          <p className="text-xs text-t3 mt-4 font-mono break-all">{API_URL}</p>
        </article>
      </section>

      <p className="text-xs text-t3 mt-8">
        Sprint 0 · esta pantalla se reemplaza por el dashboard financiero en HU-04.
      </p>
    </main>
  );
}
