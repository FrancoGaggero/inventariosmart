import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/**
 * Número que sube hasta su valor al entrar en pantalla (landing-motion D2). El `aria-label` lleva
 * el valor final, como `MontoAnimado` del panel; con "reducir movimiento" se muestra de entrada.
 */
export function Contador({
  valor,
  formato,
  className = '',
}: {
  valor: number;
  formato: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const visto = useInView(ref, { once: true, amount: 0.6 });
  const reducido = useReducedMotion();
  const [actual, setActual] = useState(reducido ? valor : 0);

  useEffect(() => {
    if (!visto) return;
    if (reducido) {
      setActual(valor);
      return;
    }
    const control = animate(0, valor, {
      duration: 1.4,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: setActual,
    });
    return () => control.stop();
  }, [visto, valor, reducido]);

  return (
    <span ref={ref} aria-label={formato(valor)} className={`tabular-nums ${className}`}>
      <span aria-hidden>{formato(actual)}</span>
    </span>
  );
}
