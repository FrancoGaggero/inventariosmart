import { m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

export const SECCIONES = [
  { id: 'diferencia', texto: 'Antes y después' },
  { id: 'servicios', texto: 'Servicios' },
  { id: 'como', texto: 'Cómo funciona' },
  { id: 'argentina', texto: 'Argentina' },
  { id: 'planes', texto: 'Planes' },
];

const ENLACE = 'relative z-10 px-3 py-2 rounded-lg text-t2 hover:text-t1 transition-colors';

/**
 * Navegación de la portada con una píldora que sigue a la sección visible (landing-3d D6). Se
 * mueve con `x` y `scaleX` (sin `layoutId`, que pediría las funciones completas de Motion).
 */
export function NavSecciones() {
  const [activa, setActiva] = useState<string | null>(null);
  const [caja, setCaja] = useState<{ x: number; ancho: number } | null>(null);
  const nav = useRef<HTMLElement>(null);
  const reducido = useReducedMotion();

  useEffect(() => {
    const visibles = new Map<string, number>();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas)
          visibles.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        const mejor = [...visibles.entries()].sort((a, b) => b[1] - a[1])[0];
        setActiva(mejor && mejor[1] > 0 ? mejor[0] : null);
      },
      { rootMargin: '-35% 0px -50% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    for (const s of SECCIONES) {
      const el = document.getElementById(s.id);
      if (el) observador.observe(el);
    }
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const enlace = activa ? nav.current?.querySelector<HTMLElement>(`a[href="#${activa}"]`) : null;
    setCaja(enlace ? { x: enlace.offsetLeft, ancho: enlace.offsetWidth } : null);
  }, [activa]);

  return (
    <nav
      ref={nav}
      className="relative hidden md:flex items-center gap-1 ml-4 text-sm"
      aria-label="Secciones"
    >
      <m.span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[100px] rounded-lg bg-fill origin-left"
        initial={false}
        animate={
          caja
            ? { opacity: 1, x: caja.x, scaleX: caja.ancho / 100 }
            : { opacity: 0, x: 0, scaleX: 1 }
        }
        transition={reducido ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }}
      />
      {SECCIONES.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`${ENLACE} ${activa === s.id ? 'text-t1' : ''}`}
          aria-current={activa === s.id ? 'location' : undefined}
        >
          {s.texto}
        </a>
      ))}
    </nav>
  );
}
