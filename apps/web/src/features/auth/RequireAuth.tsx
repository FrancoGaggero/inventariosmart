import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/lib/auth';

/** Envuelve las rutas privadas: sin sesión redirige a /login recordando el destino. */
export function RequireAuth() {
  const { user, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return (
      <div className="min-h-full grid place-items-center text-t2 text-sm" aria-busy>
        Cargando tu sesión…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
