import { Activity, Package, Settings, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api, desenvolver, mensajeDe } from '@/lib/api';
import { NOMBRE_ROL, useMe } from '@/lib/me';

/** Inicio mínimo hasta HU-04: comercio, rol, plan y accesos según rol. */
export function HomePage() {
  const me = useMe();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => desenvolver(await api.GET('/api/v1/health')),
    refetchInterval: 60_000,
  });

  if (!me.data) return null;
  const { comercio, usuario, rol, plan } = me.data;
  const esDuenio = rol === 'DUENIO';
  const veInventario = rol === 'DUENIO' || rol === 'EMPLEADO';

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs text-t2">Buen día,</p>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {usuario.nombre ?? usuario.email}
        </h1>
        <p className="text-t2 text-sm mt-1">
          {NOMBRE_ROL[rol]} de <b className="text-t1">{comercio.nombre}</b> · plan{' '}
          <span className="font-mono text-brand-3">{plan}</span>
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {veInventario && (
          <Link to="/productos" className="card p-5 hover:border-brand-2/50 transition">
            <Package className="w-5 h-5 text-brand-3 mb-3" aria-hidden />
            <h2 className="font-bold">Inventario</h2>
            <p className="text-t2 text-sm">Productos, precios y stock con su estado.</p>
          </Link>
        )}
        {esDuenio && (
          <>
            <Link
              to="/configuracion/usuarios"
              className="card p-5 hover:border-brand-2/50 transition"
            >
              <Users className="w-5 h-5 text-brand-3 mb-3" aria-hidden />
              <h2 className="font-bold">Usuarios</h2>
              <p className="text-t2 text-sm">Invitá a tu equipo y definí quién ve qué.</p>
            </Link>
            <Link
              to="/configuracion/comercio"
              className="card p-5 hover:border-brand-2/50 transition"
            >
              <Settings className="w-5 h-5 text-brand-3 mb-3" aria-hidden />
              <h2 className="font-bold">Comercio</h2>
              <p className="text-t2 text-sm">Nombre, CUIT y alícuota de IVA por defecto.</p>
            </Link>
          </>
        )}
        <article className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-ok" aria-hidden />
            <h2 className="font-bold">Estado del servicio</h2>
          </div>
          {health.isError ? (
            <p className="text-sm text-crit">{mensajeDe(health.error)}</p>
          ) : (
            <dl className="text-sm space-y-1">
              <div className="flex justify-between">
                <dt className="text-t2">API</dt>
                <dd className="font-semibold text-ok">{health.data?.status ?? '…'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-t2">Base de datos</dt>
                <dd
                  className={`font-semibold ${health.data?.db === 'ok' ? 'text-ok' : 'text-crit'}`}
                >
                  {health.data?.db ?? '…'}
                </dd>
              </div>
            </dl>
          )}
        </article>
      </section>

      <p className="text-xs text-t3">
        Los movimientos de stock y el dashboard financiero llegan con las próximas historias (HU-10,
        HU-04).
      </p>
    </div>
  );
}
