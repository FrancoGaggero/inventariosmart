import { LogOut } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { ErrorApi, mensajeDe } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useMe } from '@/lib/me';

/**
 * Rutas privadas: exige sesión de Firebase, resuelve el usuario contra la API y
 * redirige al onboarding mientras falte el nombre del comercio (CP-11.2c).
 */
export function AuthGate() {
  const { user, cargando, logout } = useAuth();
  const location = useLocation();
  const me = useMe();

  if (cargando) return <Pantalla>Cargando tu sesión…</Pantalla>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (me.isPending) return <Pantalla>Buscando tu comercio…</Pantalla>;

  if (me.isError) {
    const err = me.error;
    const dadoDeBaja = err instanceof ErrorApi && err.status === 403;
    return (
      <Pantalla>
        <p className="text-crit font-semibold mb-2">
          {dadoDeBaja ? 'Tu acceso fue dado de baja' : 'No pudimos cargar tu comercio'}
        </p>
        <p className="text-t2 text-sm mb-6 max-w-sm text-center">{mensajeDe(err)}</p>
        <div className="flex gap-3">
          {!dadoDeBaja && (
            <button type="button" className="btn btn-primary" onClick={() => void me.refetch()}>
              Reintentar
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
            <LogOut className="w-4 h-4" aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </Pantalla>
    );
  }

  const enOnboarding = location.pathname === '/onboarding';
  if (me.data.onboardingPendiente && !enOnboarding && me.data.rol === 'DUENIO') {
    return <Navigate to="/onboarding" replace />;
  }
  if (!me.data.onboardingPendiente && enOnboarding) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full grid place-items-center p-6" aria-busy>
      <div className="flex flex-col items-center text-t2 text-sm">{children}</div>
    </div>
  );
}
