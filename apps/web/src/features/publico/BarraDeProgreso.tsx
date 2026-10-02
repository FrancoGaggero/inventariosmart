import { m, useScroll, useSpring } from 'motion/react';

/** Progreso de lectura de la portada (landing-motion D2): una línea ámbar debajo de la cabecera. */
export function BarraDeProgreso() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  return (
    <m.div
      aria-hidden
      className="fixed inset-x-0 top-14 z-30 h-0.5 origin-left bg-brand"
      style={{ scaleX }}
    />
  );
}
