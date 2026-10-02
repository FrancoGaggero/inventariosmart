import { type RefObject, useEffect } from 'react';

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal accesible (WAI-ARIA): mientras está abierto, Tab y Shift+Tab ciclan dentro del
 * contenedor, Escape lo cierra, el body no scrollea y al cerrar el foco vuelve a quien lo abrió.
 */
export function useAtraparFoco(
  contenedor: RefObject<HTMLElement | null>,
  abierto: boolean,
  cerrar: () => void,
  volverA: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!abierto) return;
    const raiz = contenedor.current;
    const enfocables = () =>
      raiz ? [...raiz.querySelectorAll<HTMLElement>(ENFOCABLES)] : ([] as HTMLElement[]);
    enfocables()[0]?.focus();
    const retorno = volverA.current;

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar();
        return;
      }
      if (e.key !== 'Tab') return;
      const lista = enfocables();
      if (lista.length === 0) return;
      const primero = lista[0]!;
      const ultimo = lista[lista.length - 1]!;
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primero || !raiz?.contains(activo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (activo === ultimo || !raiz?.contains(activo))) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflow;
      retorno?.focus();
    };
  }, [abierto, contenedor, cerrar, volverA]);
}
