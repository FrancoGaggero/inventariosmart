import { BarChart3, Home, LogOut, Settings, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '@/lib/auth';
import { NOMBRE_ROL, useMe } from '@/lib/me';

/** Armazón de las pantallas privadas: cabecera con comercio, rol y plan, y navegación por rol. */
export function AppShell() {
  const { logout } = useAuth();
  const me = useMe();
  const rol = me.data?.rol;
  const esDuenio = rol === 'DUENIO';

  const enlace = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${
      isActive ? 'bg-brand/15 text-brand-3' : 'text-t2 hover:text-t1 hover:bg-white/5'
    }`;

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-white/8 bg-bg-2/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center gap-4">
          <NavLink to="/" className="flex items-center gap-2 font-extrabold">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-violet grid place-items-center">
              <BarChart3 className="w-4 h-4 text-white" aria-hidden />
            </span>
            <span className="hidden sm:inline">InventarioSmart</span>
          </NavLink>

          <nav className="flex items-center gap-1 ml-2" aria-label="Principal">
            <NavLink to="/" end className={enlace}>
              <Home className="w-4 h-4" aria-hidden />
              Inicio
            </NavLink>
            {esDuenio && (
              <>
                <NavLink to="/configuracion/usuarios" className={enlace}>
                  <Users className="w-4 h-4" aria-hidden />
                  Usuarios
                </NavLink>
                <NavLink to="/configuracion/comercio" className={enlace}>
                  <Settings className="w-4 h-4" aria-hidden />
                  Comercio
                </NavLink>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {me.data && (
              <div className="hidden md:flex flex-col items-end leading-tight">
                <span className="text-sm font-bold">{me.data.comercio.nombre}</span>
                <span className="text-[11px] text-t2">
                  {NOMBRE_ROL[me.data.rol]} · plan{' '}
                  <span className="font-mono text-brand-3">{me.data.plan}</span>
                </span>
              </div>
            )}
            <button
              type="button"
              className="btn btn-ghost !py-2 !px-3"
              onClick={() => void logout()}
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
