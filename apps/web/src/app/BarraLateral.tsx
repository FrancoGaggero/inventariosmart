import type { Plan } from '@inventariosmart/shared';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router';
import type { SeccionNav } from '@/lib/navegacion';
import type { Tema } from '@/lib/tema';
import { Logo } from '@/ui/Logo';
import { type Alertas, PieCuenta, SeccionesNav, TarjetaPlan } from './ContenidoNav';

export interface DatosNav {
  secciones: SeccionNav[];
  alertas: Alertas;
  comercio: string;
  rol: string;
  plan: Plan;
  /** Sólo el dueño cambia el plan: a los demás no se les ofrece mejorarlo. */
  puedeMejorarPlan: boolean;
  email: string;
  tema: Tema;
  alternarTema: () => void;
  salir: () => void;
}

/**
 * Barra lateral fija desde `md` (design D4): expandida de 256 px o riel de íconos de 76 px
 * (navigation rail de Material), con el comercio, las secciones, el plan y la cuenta.
 */
export function BarraLateral({
  datos,
  colapsada,
  alternarColapso,
}: {
  datos: DatosNav;
  colapsada: boolean;
  alternarColapso: () => void;
}) {
  const textoColapso = colapsada ? 'Expandir el menú' : 'Contraer el menú';
  const IconoColapso = colapsada ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      id="barra-lateral"
      className={`hidden md:flex sticky top-0 h-dvh shrink-0 flex-col gap-4 border-r border-line bg-bg-2/70 backdrop-blur py-4 transition-[width] duration-200 ${
        colapsada ? 'w-[76px] px-2' : 'w-64 px-3'
      }`}
    >
      <div className={`flex items-center ${colapsada ? 'flex-col gap-3' : 'justify-between px-1'}`}>
        <NavLink to="/" aria-label="InventarioSmart, inicio" className="rounded-lg">
          <Logo conTexto={!colapsada} />
        </NavLink>
        <button
          type="button"
          className="btn btn-texto !p-0 w-9 h-9 !min-h-0 !text-t2"
          onClick={alternarColapso}
          aria-expanded={!colapsada}
          aria-controls="barra-lateral"
          aria-label={textoColapso}
          title={textoColapso}
        >
          <IconoColapso className="w-[18px] h-[18px]" aria-hidden />
        </button>
      </div>

      {!colapsada && (
        <div className="card !rounded-2xl px-3 py-2.5 leading-tight !shadow-none">
          <p className="text-sm font-bold truncate">{datos.comercio}</p>
          <p className="text-[11px] text-t2">{datos.rol}</p>
        </div>
      )}

      <nav
        aria-label="Principal"
        className={`flex-1 overflow-y-auto -mx-1 px-1 ${colapsada ? '[scrollbar-width:none]' : '[scrollbar-width:thin]'}`}
      >
        <SeccionesNav secciones={datos.secciones} alertas={datos.alertas} colapsada={colapsada} />
      </nav>

      {/* En pantallas bajas la tarjeta le come lugar al menú; "Plan" sigue en Cuenta. */}
      {!colapsada && datos.puedeMejorarPlan && (
        <div className="[@media(max-height:720px)]:hidden">
          <TarjetaPlan plan={datos.plan} />
        </div>
      )}

      <div className="border-t border-line pt-3 px-1">
        <PieCuenta
          email={datos.email}
          tema={datos.tema}
          alternarTema={datos.alternarTema}
          salir={datos.salir}
          colapsada={colapsada}
        />
      </div>
    </aside>
  );
}
