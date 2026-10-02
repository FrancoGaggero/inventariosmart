import { m, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { type PointerEvent, type ReactNode, useRef } from 'react';
import { inclinacion, posicionRelativa } from '@/lib/animacion';
import { usePunteroFino } from './useMedia';

const RESORTE = { stiffness: 220, damping: 20 };

/**
 * Envoltorio que inclina su contenido en 3D siguiendo el mouse, con un brillo que acompaña al
 * cursor y una elevación al pasar por encima (landing-motion D2). El contenido conserva sus clases
 * (`.card`, `.card-inversa`); en pantallas táctiles o con "reducir movimiento" no hace nada.
 */
export function TarjetaInclinable({
  max = 8,
  elevacion = 6,
  redondeo = 'rounded-card',
  className = '',
  children,
}: {
  max?: number;
  elevacion?: number;
  /** Clase de redondeo del contenido, para que el brillo no se salga de las esquinas. */
  redondeo?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fino = usePunteroFino();
  const reducido = useReducedMotion();
  const activo = fino && !reducido;
  const rotateX = useSpring(0, RESORTE);
  const rotateY = useSpring(0, RESORTE);
  const bx = useMotionValue(50);
  const by = useMotionValue(50);
  const brillo = useMotionTemplate`radial-gradient(380px circle at ${bx}% ${by}%, color-mix(in srgb, var(--color-brand) 20%, transparent), transparent 60%)`;

  const mover = (e: PointerEvent<HTMLDivElement>) => {
    const caja = ref.current?.getBoundingClientRect();
    if (!activo || !caja) return;
    const giro = inclinacion(e.clientX, e.clientY, caja, max);
    rotateX.set(giro.rotateX);
    rotateY.set(giro.rotateY);
    const p = posicionRelativa(e.clientX, e.clientY, caja);
    bx.set(p.x);
    by.set(p.y);
  };
  const soltar = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  if (!activo) return <div className={className}>{children}</div>;
  return (
    <m.div
      ref={ref}
      className={`group relative ${className}`}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      whileHover={{ y: -elevacion }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      onPointerMove={mover}
      onPointerLeave={soltar}
    >
      {children}
      <m.div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${redondeo} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
        style={{ background: brillo }}
      />
    </m.div>
  );
}
