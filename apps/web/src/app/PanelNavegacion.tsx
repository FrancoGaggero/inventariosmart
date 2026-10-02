import { X } from 'lucide-react';
import { type RefObject, useRef } from 'react';
import { Logo } from '@/ui/Logo';
import type { DatosNav } from './BarraLateral';
import { PieCuenta, SeccionesNav, TarjetaPlan } from './ContenidoNav';
import { useAtraparFoco } from './useAtraparFoco';

/**
 * Menú completo en el celular (design D4): hoja modal desde la izquierda, con el foco atrapado.
 * La cierran Escape, el fondo, la X o un cambio de ruta (AppShell).
 */
export function PanelNavegacion({
  datos,
  cerrar,
  volverA,
}: {
  datos: DatosNav;
  cerrar: () => void;
  volverA: RefObject<HTMLElement | null>;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useAtraparFoco(panel, true, cerrar, volverA);
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-bg)_70%,transparent)] backdrop-blur-[2px]"
        aria-label="Cerrar menú"
        onClick={cerrar}
      />
      <div
        ref={panel}
        id="panel-navegacion"
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        className="desliza absolute left-0 top-0 h-full w-80 max-w-[88vw] bg-bg-2 border-r border-line shadow-3 flex flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <Logo />
          <button
            type="button"
            className="btn btn-texto !p-0 w-10 h-10 !min-h-0 !text-t2"
            aria-label="Cerrar menú"
            onClick={cerrar}
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>
        <div className="card !rounded-2xl px-3 py-2.5 leading-tight !shadow-none">
          <p className="text-sm font-bold truncate">{datos.comercio}</p>
          <p className="text-[11px] text-t2">{datos.rol}</p>
        </div>
        <nav
          aria-label="Principal"
          className="flex-1 overflow-y-auto -mx-1 px-1 [scrollbar-width:thin]"
        >
          <SeccionesNav secciones={datos.secciones} alertas={datos.alertas} />
        </nav>
        {datos.puedeMejorarPlan && <TarjetaPlan plan={datos.plan} />}
        <div className="border-t border-line pt-3">
          <PieCuenta
            email={datos.email}
            tema={datos.tema}
            alternarTema={datos.alternarTema}
            salir={datos.salir}
          />
        </div>
      </div>
    </div>
  );
}
