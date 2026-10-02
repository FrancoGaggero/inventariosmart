import { m, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { useEffect } from 'react';
import { usePunteroFino } from './useMedia';

/**
 * Fondo de las pantallas públicas (landing-motion D2): manchas ámbar, terracota y ciruela que
 * derivan lento (CSS), una cuadrícula de puntos tenue y, con mouse, un foco de luz que lo sigue.
 * Decorativo y detrás de todo; con "reducir movimiento" queda quieto.
 */
export function FondoAnimado() {
  const fino = usePunteroFino();
  const reducido = useReducedMotion();
  const sigue = fino && !reducido;
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  const sx = useSpring(x, { stiffness: 120, damping: 22 });
  const sy = useSpring(y, { stiffness: 120, damping: 22 });
  const foco = useMotionTemplate`radial-gradient(520px circle at ${sx}px ${sy}px, color-mix(in srgb, var(--color-brand) 14%, transparent), transparent 70%)`;

  useEffect(() => {
    if (!sigue) return;
    const mover = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener('pointermove', mover, { passive: true });
    return () => window.removeEventListener('pointermove', mover);
  }, [sigue, x, y]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="mancha mancha-1" />
      <div className="mancha mancha-2" />
      <div className="mancha mancha-3" />
      <div className="puntos absolute inset-0" />
      {sigue && <m.div className="absolute inset-0" style={{ background: foco }} />}
    </div>
  );
}
