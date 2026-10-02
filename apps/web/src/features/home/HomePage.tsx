import { NOMBRE_PLAN, planCumple } from '@inventariosmart/shared';
import { Activity, ArrowLeftRight, BellRing, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { Contexto } from '@/features/inflacion/Contexto';
import { useResumenAlertas } from '@/lib/alertas';
import { api, desenvolver, mensajeDe } from '@/lib/api';
import { saludo } from '@/lib/inicio-formato';
import { useMe } from '@/lib/me';
import { RUTA_PLAN } from '@/lib/plan-formato';
import { useProductos } from '@/lib/productos';

/**
 * Inicio: saludo con el comercio y el panel financiero (HU-04) para DUENIO y CONTADOR; el
 * EMPLEADO ve su inicio operativo porque no accede al panel (Propuesta §2.4). Los accesos a cada
 * sección están en la navegación (web-redesign, design D5).
 */
export function HomePage() {
  const me = useMe();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => desenvolver(await api.GET('/api/v1/health')),
    refetchInterval: 60_000,
  });

  const rol = me.data?.rol;
  const esEmpleado = rol === 'EMPLEADO';
  const vePanel = rol === 'DUENIO' || rol === 'CONTADOR';
  const conAlertas = vePanel && planCumple(me.data?.plan ?? 'FREE', 'PRO');
  const alertas = useResumenAlertas(conAlertas);
  // El EMPLEADO no ve el panel: su inicio resume el stock con dos consultas al listado.
  const bajos = useProductos({ estado: 'BAJO', activo: true }, 100, esEmpleado);
  const sinStock = useProductos({ estado: 'SIN_STOCK', activo: true }, 100, esEmpleado);
  const conteo = (r: typeof bajos): string | null => {
    const pagina = r.data?.pages[0];
    if (!pagina) return null;
    return pagina.siguienteCursor ? 'más de 100' : String(pagina.items.length);
  };

  if (!me.data) return null;
  const { comercio, plan } = me.data;
  const activas = alertas.data?.activas ?? 0;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          {saludo()}, <span className="acento-serif">{comercio.nombre}</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link to={RUTA_PLAN} className="etiqueta etiqueta-acento capa">
            Plan {NOMBRE_PLAN[plan]}
          </Link>
          {conAlertas && alertas.isSuccess && (
            <Link to="/alertas" className="etiqueta capa">
              <BellRing className="w-3.5 h-3.5" aria-hidden />
              {activas === 0
                ? 'Sin alertas de reposición'
                : `${activas} ${activas === 1 ? 'alerta activa' : 'alertas activas'}`}
            </Link>
          )}
        </div>
      </header>

      {vePanel && <Dashboard puedeOperar={rol === 'DUENIO'} />}

      <Contexto conStock={vePanel} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Más información">
        {esEmpleado && (
          <>
            <Link to="/productos" className="card card-hover p-4">
              <Package className="w-4 h-4 text-brand-3 mb-2" aria-hidden />
              <h2 className="font-bold text-sm">Inventario</h2>
              <p className="text-t2 text-xs">Productos, precios y stock con su estado.</p>
              {bajos.isSuccess && sinStock.isSuccess && (
                <p className="text-xs mt-2">
                  <span className="text-warn font-semibold">{conteo(bajos)} con stock bajo</span>
                  <span className="text-t3"> · </span>
                  <span className="text-crit font-semibold">{conteo(sinStock)} sin stock</span>
                </p>
              )}
            </Link>
            <Link to="/movimientos/nuevo" className="card card-hover p-4">
              <ArrowLeftRight className="w-4 h-4 text-brand-3 mb-2" aria-hidden />
              <h2 className="font-bold text-sm">Registrar un movimiento</h2>
              <p className="text-t2 text-xs">
                Ventas, ingresos y ajustes; el stock se actualiza solo.
              </p>
            </Link>
          </>
        )}
        <article className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-ok" aria-hidden />
            <h2 className="font-bold text-sm">Estado del servicio</h2>
          </div>
          {health.isError ? (
            <p className="text-xs text-crit">{mensajeDe(health.error)}</p>
          ) : (
            <dl className="text-xs space-y-1">
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
    </div>
  );
}
