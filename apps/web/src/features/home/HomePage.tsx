import {
  Activity,
  ArrowLeftRight,
  Package,
  Receipt,
  Settings,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { api, desenvolver, mensajeDe } from '@/lib/api';
import { NOMBRE_ROL, useMe } from '@/lib/me';
import { useProductos } from '@/lib/productos';

/**
 * Inicio: el panel financiero (HU-04) para DUENIO y CONTADOR; el EMPLEADO ve su inicio
 * operativo (Inventario y Movimientos) porque no accede al panel (Propuesta §2.4).
 */
export function HomePage() {
  const me = useMe();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => desenvolver(await api.GET('/api/v1/health')),
    refetchInterval: 60_000,
  });

  const rolActual = me.data?.rol;
  const esEmpleado = rolActual === 'EMPLEADO';
  // El EMPLEADO no ve el panel: su inicio resume el stock con dos consultas al listado.
  const bajos = useProductos({ estado: 'BAJO', activo: true }, 100, esEmpleado);
  const sinStock = useProductos({ estado: 'SIN_STOCK', activo: true }, 100, esEmpleado);
  const conteo = (r: typeof bajos): string | null => {
    const pagina = r.data?.pages[0];
    if (!pagina) return null;
    return pagina.siguienteCursor ? 'más de 100' : String(pagina.items.length);
  };

  if (!me.data) return null;
  const { comercio, usuario, rol, plan } = me.data;
  const esDuenio = rol === 'DUENIO';
  const veInventario = rol === 'DUENIO' || rol === 'EMPLEADO';
  const vePanel = rol === 'DUENIO' || rol === 'CONTADOR';

  const acceso = (to: string, Icono: typeof Package, titulo: string, texto: string) => (
    <Link to={to} className="card p-4 hover:border-brand-2/50 transition">
      <Icono className="w-4 h-4 text-brand-3 mb-2" aria-hidden />
      <h2 className="font-bold text-sm">{titulo}</h2>
      <p className="text-t2 text-xs">{texto}</p>
    </Link>
  );

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

      {vePanel && <Dashboard puedeOperar={esDuenio} />}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-t2 uppercase tracking-wider">Accesos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {veInventario && (
            <Link to="/productos" className="card p-4 hover:border-brand-2/50 transition">
              <Package className="w-4 h-4 text-brand-3 mb-2" aria-hidden />
              <h2 className="font-bold text-sm">Inventario</h2>
              <p className="text-t2 text-xs">Productos, precios y stock con su estado.</p>
              {esEmpleado && bajos.isSuccess && sinStock.isSuccess && (
                <p className="text-xs mt-2">
                  <span className="text-warn font-semibold">{conteo(bajos)} con stock bajo</span>
                  <span className="text-t3"> · </span>
                  <span className="text-crit font-semibold">{conteo(sinStock)} sin stock</span>
                </p>
              )}
            </Link>
          )}
          {acceso(
            '/movimientos',
            ArrowLeftRight,
            'Movimientos',
            veInventario
              ? 'Registrá ventas, ingresos y ajustes; el stock se actualiza solo.'
              : 'Historial de ventas, ingresos y ajustes del comercio.',
          )}
          {vePanel &&
            acceso(
              '/rentabilidad',
              TrendingUp,
              'Rentabilidad',
              'Margen bruto y neto por producto y del mes.',
            )}
          {vePanel &&
            acceso('/gastos', Receipt, 'Gastos', 'Fijos y variables del mes, prorrateados.')}
          {esDuenio && (
            <>
              {acceso(
                '/proveedores',
                Truck,
                'Proveedores',
                'Contactos, plazos y listas de precios.',
              )}
              {acceso('/configuracion/usuarios', Users, 'Usuarios', 'Tu equipo y sus roles.')}
              {acceso('/configuracion/comercio', Settings, 'Comercio', 'Nombre, CUIT e IVA.')}
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
        </div>
      </section>
    </div>
  );
}
