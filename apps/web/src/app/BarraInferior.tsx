import { Menu } from 'lucide-react';
import type { Ref } from 'react';
import { NavLink } from 'react-router';
import { type ItemNav, nombreAccesible } from '@/lib/navegacion';
import type { Alertas } from './ContenidoNav';
import { ICONO_NAV } from './iconos-nav';

const destino =
  'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold';
const indicador = 'relative w-14 h-8 rounded-full grid place-items-center transition-colors';

/**
 * Barra de navegación inferior en el celular (navigation bar de Material, design D4): cuatro
 * destinos según el rol y "Más", que abre el menú completo.
 */
export function BarraInferior({
  accesos,
  alertas,
  abrirMas,
  masAbierto,
  botonMas,
}: {
  accesos: ItemNav[];
  alertas: Alertas;
  abrirMas: () => void;
  masAbierto: boolean;
  botonMas: Ref<HTMLButtonElement>;
}) {
  return (
    <nav
      aria-label="Accesos rápidos"
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg-2/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex h-16 px-1">
        {accesos.map((item) => {
          const Icono = ICONO_NAV[item.icono];
          const n = item.alerta ? alertas.activas : 0;
          return (
            <li key={item.to} className="flex-1 min-w-0 flex">
              <NavLink
                to={item.to}
                end={item.fin}
                aria-label={nombreAccesible(item, n)}
                className={({ isActive }) => `${destino} ${isActive ? 'text-t1' : 'text-t2'}`}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`${indicador} ${isActive ? 'bg-[color-mix(in_srgb,var(--color-brand)_22%,transparent)] text-brand-3' : ''}`}
                    >
                      <Icono className="w-5 h-5" aria-hidden />
                      {n > 0 && (
                        <span
                          className={`absolute -top-0.5 right-1 min-w-4 h-4 px-1 rounded-full text-[10px] leading-4 font-bold text-center ${
                            alertas.criticas > 0 ? 'bg-crit/25 text-crit' : 'bg-warn/25 text-warn'
                          }`}
                          aria-hidden
                        >
                          {n > 99 ? '99+' : n}
                        </span>
                      )}
                    </span>
                    <span className="truncate max-w-full">{item.etiqueta}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
        <li className="flex-1 min-w-0 flex">
          <button
            ref={botonMas}
            type="button"
            className={`${destino} text-t2`}
            onClick={abrirMas}
            aria-expanded={masAbierto}
            aria-controls="panel-navegacion"
            aria-haspopup="dialog"
          >
            <span className={indicador}>
              <Menu className="w-5 h-5" aria-hidden />
            </span>
            Más
          </button>
        </li>
      </ul>
    </nav>
  );
}
