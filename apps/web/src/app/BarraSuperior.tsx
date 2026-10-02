import { Bell, Plus } from 'lucide-react';
import { NavLink } from 'react-router';
import { fechaLarga } from '@/lib/inicio-formato';
import { Logo } from '@/ui/Logo';
import type { Alertas } from './ContenidoNav';

/**
 * Banda fina sobre el contenido (design D4): la fecha (el logo en el celular), la campana de
 * alertas y la acción principal "Registrar movimiento".
 */
export function BarraSuperior({
  alertas,
  conAlertas,
  puedeRegistrar,
}: {
  alertas: Alertas;
  conAlertas: boolean;
  puedeRegistrar: boolean;
}) {
  const n = alertas.activas;
  const nombreCampana = n > 0 ? `Alertas, ${n} ${n === 1 ? 'activa' : 'activas'}` : 'Alertas';
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
      <div className="h-14 max-w-6xl mx-auto px-4 md:px-8 flex items-center gap-3">
        <NavLink to="/" aria-label="InventarioSmart, inicio" className="md:hidden rounded-lg">
          <Logo conTexto={false} />
        </NavLink>
        <p className="hidden md:block text-sm text-t2 first-letter:uppercase">{fechaLarga()}</p>
        <div className="ml-auto flex items-center gap-2">
          {conAlertas && (
            <NavLink
              to="/alertas"
              aria-label={nombreCampana}
              title={nombreCampana}
              className="btn btn-texto relative !p-0 w-10 h-10 !min-h-0 !text-t2"
            >
              <Bell className="w-[18px] h-[18px]" aria-hidden />
              {n > 0 && (
                <span
                  className={`absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] leading-4 font-bold text-center ${
                    alertas.criticas > 0 ? 'bg-crit/25 text-crit pulso' : 'bg-warn/25 text-warn'
                  }`}
                  aria-hidden
                >
                  {n > 99 ? '99+' : n}
                </span>
              )}
            </NavLink>
          )}
          {puedeRegistrar && (
            <NavLink
              to="/movimientos/nuevo"
              className="btn btn-primary !py-2 !min-h-0 h-10"
              aria-label="Registrar movimiento"
            >
              <Plus className="w-4 h-4" aria-hidden />
              <span className="hidden sm:inline">Registrar movimiento</span>
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
