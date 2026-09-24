import {
  ArrowLeftRight,
  BarChart3,
  BellRing,
  FileBarChart,
  Home,
  LogOut,
  type LucideIcon,
  Menu,
  Moon,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Sun,
  TrendingUp,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { planCumple } from '@inventariosmart/shared';
import { useResumenAlertas } from '@/lib/alertas';
import { useAuth } from '@/lib/auth';
import { NOMBRE_ROL, useMe } from '@/lib/me';
import { useTema } from '@/lib/tema';
import { Confirmar } from '@/ui/Confirmar';

interface Enlace {
  to: string;
  etiqueta: string;
  Icono: LucideIcon;
  fin?: boolean;
  badge?: number;
  critico?: boolean;
}

function Badge({
  n,
  critico,
  className = '',
}: {
  n: number;
  critico: boolean;
  className?: string;
}) {
  if (n <= 0) return null;
  return (
    <span
      className={`min-w-5 px-1.5 py-0.5 rounded-full text-[11px] font-bold text-center tabular-nums ${
        critico ? 'bg-crit/20 text-crit pulso' : 'bg-warn/20 text-warn'
      } ${className}`}
      aria-label={`${n} alertas activas`}
    >
      {n}
    </span>
  );
}

/**
 * Armazón de las pantallas privadas (design D1): cabecera con logo, enlaces a partir de `lg`
 * y panel lateral por debajo, con comercio, rol, plan, tema y cierre de sesión.
 */
export function AppShell() {
  const { logout } = useAuth();
  const me = useMe();
  const { tema, alternar } = useTema();
  const rol = me.data?.rol;
  const esDuenio = rol === 'DUENIO';
  const veInventario = rol === 'DUENIO' || rol === 'EMPLEADO';
  const veGastos = rol === 'DUENIO' || rol === 'CONTADOR';
  // Contador de alertas de reposición (HU-06): sólo con plan PRO y para quienes las ven.
  const veAlertas = veGastos;
  const conAlertas = veAlertas && !!me.data && planCumple(me.data.plan, 'PRO');
  const alertas = useResumenAlertas(conAlertas);
  const activas = conAlertas ? (alertas.data?.activas ?? 0) : 0;
  const criticas = conAlertas ? (alertas.data?.criticas ?? 0) : 0;

  const enlaces: Enlace[] = [
    { to: '/', etiqueta: 'Inicio', Icono: Home, fin: true },
    ...(veInventario ? [{ to: '/productos', etiqueta: 'Inventario', Icono: Package }] : []),
    { to: '/movimientos', etiqueta: 'Movimientos', Icono: ArrowLeftRight },
    ...(veGastos
      ? [
          { to: '/rentabilidad', etiqueta: 'Rentabilidad', Icono: TrendingUp },
          { to: '/gastos', etiqueta: 'Gastos', Icono: Receipt },
        ]
      : []),
    ...(veAlertas
      ? [
          {
            to: '/alertas',
            etiqueta: 'Alertas',
            Icono: BellRing,
            badge: activas,
            critico: criticas > 0,
          },
        ]
      : []),
    ...(conAlertas
      ? [
          { to: '/ordenes', etiqueta: 'Órdenes', Icono: ShoppingCart },
          { to: '/reportes', etiqueta: 'Reportes', Icono: FileBarChart },
        ]
      : []),
    ...(esDuenio
      ? [
          { to: '/proveedores', etiqueta: 'Proveedores', Icono: Truck },
          { to: '/configuracion/usuarios', etiqueta: 'Usuarios', Icono: Users },
          { to: '/configuracion/comercio', etiqueta: 'Comercio', Icono: Settings },
        ]
      : []),
  ];

  const [abierto, setAbierto] = useState(false);
  // Cerrar sesión pide confirmación: un clic sin querer no debe echar al usuario.
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const primerEnlace = useRef<HTMLAnchorElement>(null);
  const location = useLocation();

  // El panel se cierra al navegar y con Escape; el foco vuelve al botón (D1).
  useEffect(() => {
    setAbierto(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', alTeclear);
    document.body.style.overflow = 'hidden';
    primerEnlace.current?.focus();
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = '';
      botonMenu.current?.focus();
    };
  }, [abierto]);

  // Entre lg y xl los enlaces van sólo con icono (tooltip); las etiquetas entran desde xl (D1).
  const enlace = ({ isActive }: { isActive: boolean }) =>
    `subrayado-activo flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-semibold transition ${
      isActive ? 'text-brand-3' : 'text-t2 hover:text-t1 hover:bg-fill'
    }`;

  const botonTema = (conTexto: boolean) => (
    <button
      type="button"
      className={`btn btn-ghost !py-2 !px-3 ${conTexto ? 'w-full justify-start' : ''}`}
      onClick={alternar}
      aria-label={tema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={tema === 'dark' ? 'Tema claro' : 'Tema oscuro'}
    >
      {tema === 'dark' ? (
        <Sun className="w-4 h-4" aria-hidden />
      ) : (
        <Moon className="w-4 h-4" aria-hidden />
      )}
      {conTexto && (tema === 'dark' ? 'Tema claro' : 'Tema oscuro')}
    </button>
  );

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-line bg-bg-2/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
          <button
            ref={botonMenu}
            type="button"
            className="btn btn-ghost !py-2 !px-2.5 relative lg:hidden"
            aria-label="Abrir menú"
            aria-expanded={abierto}
            aria-controls="menu-lateral"
            onClick={() => setAbierto(true)}
          >
            <Menu className="w-5 h-5" aria-hidden />
            <Badge n={activas} critico={criticas > 0} className="absolute -top-1.5 -right-1.5" />
          </button>

          <NavLink to="/" className="flex items-center gap-2 font-extrabold shrink-0">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-violet grid place-items-center shadow-[0_6px_16px_-8px_var(--color-glow)]">
              <BarChart3 className="w-4 h-4 text-on-brand" aria-hidden />
            </span>
            <span className="hidden sm:inline">InventarioSmart</span>
          </NavLink>

          <nav className="hidden lg:flex items-center gap-0.5 ml-2 min-w-0" aria-label="Principal">
            {enlaces.map((e) => (
              <NavLink
                key={e.to}
                to={e.to}
                end={e.fin}
                className={enlace}
                title={e.etiqueta}
                aria-label={e.etiqueta}
              >
                <e.Icono className="w-4 h-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap hidden xl:inline">{e.etiqueta}</span>
                {e.badge !== undefined && (
                  <Badge n={e.badge} critico={!!e.critico} className="ml-1" />
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 min-w-0">
            {me.data && (
              <div className="hidden md:flex lg:hidden 2xl:flex flex-col items-end leading-tight min-w-0">
                <span className="text-sm font-bold truncate max-w-48">
                  {me.data.comercio.nombre}
                </span>
                <span className="text-[11px] text-t2 whitespace-nowrap">
                  {NOMBRE_ROL[me.data.rol]} · plan{' '}
                  <span className="font-mono text-brand-3">{me.data.plan}</span>
                </span>
              </div>
            )}
            <span className="hidden lg:inline-flex">{botonTema(false)}</span>
            <span className="hidden lg:inline-flex">
              <button
                type="button"
                className="btn btn-ghost !py-2 !px-3"
                onClick={() => setConfirmarSalida(true)}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" aria-hidden />
              </button>
            </span>
          </div>
        </div>
      </header>

      {abierto && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
          />
          <aside
            id="menu-lateral"
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className="entra absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-bg-2 border-r border-line shadow-2xl flex flex-col"
          >
            <div className="h-14 px-4 flex items-center justify-between border-b border-line">
              <span className="font-extrabold">Menú</span>
              <button
                type="button"
                className="btn btn-ghost !py-2 !px-2.5"
                aria-label="Cerrar menú"
                onClick={() => setAbierto(false)}
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            {me.data && (
              <div className="px-4 py-3 border-b border-line leading-tight">
                <div className="text-sm font-bold truncate">{me.data.comercio.nombre}</div>
                <div className="text-[11px] text-t2">
                  {NOMBRE_ROL[me.data.rol]} · plan{' '}
                  <span className="font-mono text-brand-3">{me.data.plan}</span>
                </div>
              </div>
            )}
            <nav className="flex-1 overflow-y-auto p-2" aria-label="Principal">
              {enlaces.map((e, i) => (
                <NavLink
                  key={e.to}
                  to={e.to}
                  end={e.fin}
                  ref={i === 0 ? primerEnlace : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                      isActive ? 'bg-brand/15 text-brand-3' : 'text-t2 hover:text-t1 hover:bg-fill'
                    }`
                  }
                >
                  <e.Icono className="w-4 h-4 shrink-0" aria-hidden />
                  <span className="flex-1">{e.etiqueta}</span>
                  {e.badge !== undefined && <Badge n={e.badge} critico={!!e.critico} />}
                </NavLink>
              ))}
            </nav>
            <div className="p-2 border-t border-line space-y-1">
              {botonTema(true)}
              <button
                type="button"
                className="btn btn-ghost !py-2 !px-3 w-full justify-start"
                onClick={() => setConfirmarSalida(true)}
              >
                <LogOut className="w-4 h-4" aria-hidden />
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      <Confirmar
        abierto={confirmarSalida}
        titulo="¿Cerrar sesión?"
        textoConfirmar="Cerrar sesión"
        textoCancelar="Seguir acá"
        peligroso
        onConfirmar={() => {
          setConfirmarSalida(false);
          void logout();
        }}
        onCancelar={() => setConfirmarSalida(false)}
      >
        Vas a salir de {me.data?.comercio.nombre ?? 'InventarioSmart'}. Podés volver a entrar cuando
        quieras.
      </Confirmar>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
