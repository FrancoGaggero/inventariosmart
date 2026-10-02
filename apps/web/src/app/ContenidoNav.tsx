import { NOMBRE_PLAN, type Plan } from '@inventariosmart/shared';
import { LogOut, Moon, Sparkles, Sun } from 'lucide-react';
import { type Ref } from 'react';
import { NavLink } from 'react-router';
import { type SeccionNav, nombreAccesible } from '@/lib/navegacion';
import { RUTA_PLAN } from '@/lib/plan-formato';
import type { Tema } from '@/lib/tema';
import { ICONO_NAV } from './iconos-nav';

export interface Alertas {
  activas: number;
  criticas: number;
}

function Badge({ n, critico, punto }: { n: number; critico: boolean; punto: boolean }) {
  if (n <= 0) return null;
  const tono = critico ? 'bg-crit/20 text-crit pulso' : 'bg-warn/20 text-warn';
  if (punto) {
    return (
      <span
        className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${critico ? 'bg-crit pulso' : 'bg-warn'}`}
        aria-hidden
      />
    );
  }
  return (
    <span
      className={`ml-auto min-w-5 px-1.5 py-0.5 rounded-full text-[11px] font-bold text-center tabular-nums ${tono}`}
      aria-hidden
    >
      {n}
    </span>
  );
}

/** Las secciones de la navegación (design D4). En el riel quedan sólo los íconos. */
export function SeccionesNav({
  secciones,
  alertas,
  colapsada = false,
  primerEnlace,
}: {
  secciones: SeccionNav[];
  alertas: Alertas;
  colapsada?: boolean;
  primerEnlace?: Ref<HTMLAnchorElement>;
}) {
  return (
    <div className="space-y-4">
      {secciones.map((s, i) => (
        <div key={s.clave}>
          {colapsada ? (
            i > 0 && <hr className="mx-3 mb-3 border-line" />
          ) : (
            <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-t3">
              {s.titulo}
            </p>
          )}
          <ul className="space-y-0.5">
            {s.items.map((item, j) => {
              const Icono = ICONO_NAV[item.icono];
              const n = item.alerta ? alertas.activas : 0;
              const nombre = nombreAccesible(item, n);
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.fin}
                    ref={i === 0 && j === 0 ? primerEnlace : undefined}
                    aria-label={nombre}
                    title={colapsada ? nombre : undefined}
                    className={`nav-item relative ${colapsada ? 'justify-center !px-0' : ''}`}
                  >
                    <Icono className="w-[18px] h-[18px] shrink-0" aria-hidden />
                    {!colapsada && <span className="truncate">{item.etiqueta}</span>}
                    <Badge n={n} critico={alertas.criticas > 0} punto={colapsada} />
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

const SUMA_DEL_PLAN: Record<Exclude<Plan, 'PREMIUM'>, string> = {
  FREE: 'Alertas de reposición, órdenes de compra, reportes y análisis de stock.',
  PRO: 'Comparador de proveedores y asistente con IA.',
};

/** Tarjeta del plan al pie de la barra (design D4); en PREMIUM no hay nada que mejorar. */
export function TarjetaPlan({ plan }: { plan: Plan }) {
  if (plan === 'PREMIUM') return null;
  return (
    <div className="card card-inversa p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-full bg-brand text-on-brand grid place-items-center shrink-0">
          <Sparkles className="w-4 h-4" aria-hidden />
        </span>
        <div className="leading-tight min-w-0">
          <p className="text-sm font-bold">Plan {NOMBRE_PLAN[plan]}</p>
          <p className="text-[11px] opacity-70">{SUMA_DEL_PLAN[plan]}</p>
        </div>
      </div>
      <NavLink to={RUTA_PLAN} className="btn btn-primary w-full !py-2 !min-h-0 text-sm">
        Mejorar plan
      </NavLink>
    </div>
  );
}

/** Usuario, tema y salida (design D4). En el riel se apilan los botones. */
export function PieCuenta({
  email,
  tema,
  alternarTema,
  salir,
  colapsada = false,
}: {
  email: string;
  tema: Tema;
  alternarTema: () => void;
  salir: () => void;
  colapsada?: boolean;
}) {
  const textoTema = tema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  const IconoTema = tema === 'dark' ? Sun : Moon;
  const inicial = (email.trim()[0] ?? '?').toUpperCase();
  return (
    <div className={`flex items-center gap-2 ${colapsada ? 'flex-col' : ''}`}>
      <span
        className="w-9 h-9 rounded-full bg-fill border border-line grid place-items-center text-sm font-bold shrink-0"
        title={colapsada ? email : undefined}
        aria-hidden
      >
        {inicial}
      </span>
      {!colapsada && (
        <span className="flex-1 min-w-0 text-xs text-t2 truncate" title={email}>
          {email}
        </span>
      )}
      <button
        type="button"
        className="btn btn-texto !p-0 w-9 h-9 !min-h-0 !text-t2"
        onClick={alternarTema}
        aria-label={textoTema}
        title={textoTema}
      >
        <IconoTema className="w-4 h-4" aria-hidden />
      </button>
      <button
        type="button"
        className="btn btn-texto !p-0 w-9 h-9 !min-h-0 !text-t2"
        onClick={salir}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
