import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Animaciones de las pantallas públicas (landing-motion D1, ADR 0023). `LazyMotion` con `strict`
 * obliga a usar `m` (unos 5 KB) en lugar de `motion`, que arrastra el bundle completo, y
 * `MotionConfig` apaga todo lo que se mueve si el sistema pide reducir el movimiento.
 */
export function Animado({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
