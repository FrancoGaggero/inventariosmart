import { useEffect, useState } from 'react';

/** Si una media query se cumple, y se actualiza cuando cambia (p. ej. `(pointer: fine)`). */
export function useMedia(consulta: string): boolean {
  const [cumple, setCumple] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(consulta).matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(consulta);
    const alCambiar = () => setCumple(mq.matches);
    alCambiar();
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, [consulta]);
  return cumple;
}

/** Puntero preciso (mouse o trackpad): sólo ahí hay inclinación 3D y foco que sigue al cursor. */
export const usePunteroFino = () => useMedia('(pointer: fine)');
