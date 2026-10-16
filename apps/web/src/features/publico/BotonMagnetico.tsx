import { m, useReducedMotion, useSpring } from 'motion/react';
import { type ReactNode, useEffect, useRef } from 'react';
import { atraccion } from '@/lib/animacion';
import { usePunteroFino } from './useMedia';

/**
 * Envuelve un llamado a la acción para que se corra unos píxeles hacia el mouse cuando se acerca
 * (landing-3d D6). Sólo con mouse y sin "reducir movimiento"; el enlace o botón de adentro no cambia.
 */
export function BotonMagnetico({
  children,
  max = 6,
  className = 'inline-flex',
}: {
  children: ReactNode;
  max?: number;
  className?: string;
}) {
  const fino = usePunteroFino();
  const reducido = useReducedMotion();
  const activo = fino && !reducido;
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 18 });
  const y = useSpring(0, { stiffness: 220, damping: 18 });

  useEffect(() => {
    if (!activo) return;
    const mover = (e: PointerEvent) => {
      const caja = ref.current?.getBoundingClientRect();
      if (!caja) return;
      const d = atraccion(e.clientX, e.clientY, caja, 80, max);
      x.set(d.x);
      y.set(d.y);
    };
    window.addEventListener('pointermove', mover, { passive: true });
    return () => window.removeEventListener('pointermove', mover);
  }, [activo, max, x, y]);

  if (!activo) return <span className={className}>{children}</span>;
  return (
    <m.span ref={ref} className={className} style={{ x, y }}>
      {children}
    </m.span>
  );
}
