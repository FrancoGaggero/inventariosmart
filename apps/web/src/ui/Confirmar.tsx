import { type ReactNode, useEffect, useRef } from 'react';

/**
 * Diálogo de confirmación accesible: velo, Escape y clic afuera cancelan, el foco arranca en
 * "Cancelar" (la acción segura) y vuelve al elemento que lo abrió.
 */
export function Confirmar({
  abierto,
  titulo,
  children,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  peligroso = false,
  ocupado = false,
  onConfirmar,
  onCancelar,
}: {
  abierto: boolean;
  titulo: string;
  children?: ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  peligroso?: boolean;
  ocupado?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement as HTMLElement | null;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar();
    };
    document.addEventListener('keydown', alTeclear);
    cancelar.current?.focus();
    return () => {
      document.removeEventListener('keydown', alTeclear);
      previo?.focus();
    };
  }, [abierto, onCancelar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Cerrar"
        onClick={onCancelar}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-titulo"
        className="entra relative card p-5 w-full max-w-sm space-y-4 bg-bg-2"
      >
        <h2 id="confirmar-titulo" className="font-bold text-lg">
          {titulo}
        </h2>
        {children && <div className="text-sm text-t2">{children}</div>}
        <div className="flex justify-end gap-2">
          <button ref={cancelar} type="button" className="btn btn-ghost" onClick={onCancelar}>
            {textoCancelar}
          </button>
          <button
            type="button"
            className={`btn ${peligroso ? 'btn-ghost !border-crit/50 !text-crit' : 'btn-primary'}`}
            onClick={onConfirmar}
            disabled={ocupado}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
