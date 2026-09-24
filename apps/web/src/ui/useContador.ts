import { useEffect, useRef, useState } from 'react';

const DURACION_DEFAULT = 600;

function prefiereMenosMovimiento(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Anima un número desde el valor anterior hasta `valor` con requestAnimationFrame
 * (design D4). Con `prefers-reduced-motion`, sin `requestAnimationFrame` (tests) o con
 * `valor` nulo devuelve el valor final de inmediato.
 */
export function useContador(valor: number | null, duracion = DURACION_DEFAULT): number | null {
  const [actual, setActual] = useState<number | null>(valor);
  const anterior = useRef<number | null>(valor);

  useEffect(() => {
    const desde = anterior.current ?? 0;
    anterior.current = valor;
    if (
      valor === null ||
      desde === valor ||
      duracion <= 0 ||
      prefiereMenosMovimiento() ||
      typeof requestAnimationFrame !== 'function'
    ) {
      setActual(valor);
      return;
    }
    let cuadro = 0;
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      setActual(desde + (valor - desde) * easeOutCubic(t));
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor, duracion]);

  return actual;
}
