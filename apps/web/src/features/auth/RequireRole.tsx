import type { Rol } from '@inventariosmart/shared';
import { ShieldOff } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { useMe } from '@/lib/me';

/** Envuelve rutas restringidas por rol; sin permiso muestra un aviso en lugar de la página. */
export function RequireRole({ roles }: { roles: Rol[] }) {
  const me = useMe();
  if (!me.data) return null;
  if (!roles.includes(me.data.rol)) {
    return (
      <div className="min-h-full grid place-items-center p-6">
        <div className="card p-8 max-w-sm text-center">
          <ShieldOff className="w-8 h-8 text-warn mx-auto mb-3" aria-hidden />
          <h1 className="font-extrabold text-lg mb-1">No tenés permiso</h1>
          <p className="text-t2 text-sm mb-5">
            Esta sección es sólo para el dueño del comercio. Tu rol actual es{' '}
            <b className="text-t1">{me.data.rol.toLowerCase()}</b>.
          </p>
          <Link to="/" className="btn btn-ghost">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }
  return <Outlet />;
}
