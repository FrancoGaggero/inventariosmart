import { m, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

export type Desde = 'abajo' | 'izquierda' | 'derecha' | 'escala';

const DESPLAZAMIENTO: Record<Desde, Record<string, number>> = {
  abajo: { y: 32 },
  izquierda: { x: -48 },
  derecha: { x: 48 },
  escala: { scale: 0.85 },
};

const SUAVE = [0.2, 0.7, 0.2, 1] as const;

/** Aparición al entrar en pantalla (landing-motion D2): desplazamiento, opacidad y desenfoque. */
export function variantes(desde: Desde = 'abajo', retraso = 0): Variants {
  return {
    oculto: { opacity: 0, filter: 'blur(6px)', ...DESPLAZAMIENTO[desde] },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      x: 0,
      y: 0,
      scale: 1,
      transition: { duration: 0.65, ease: SUAVE, delay: retraso },
    },
  };
}

const VISTA = { once: true, amount: 0.2 } as const;

/** Un bloque que aparece al entrar en pantalla. */
export function Revelar({
  desde = 'abajo',
  retraso = 0,
  className = '',
  children,
}: {
  desde?: Desde;
  retraso?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <m.div
      className={className}
      variants={variantes(desde, retraso)}
      initial="oculto"
      whileInView="visible"
      viewport={VISTA}
    >
      {children}
    </m.div>
  );
}

const CONTENEDOR = (paso: number, inicio: number): Variants => ({
  oculto: {},
  visible: { transition: { staggerChildren: paso, delayChildren: inicio } },
});

/** Contenedor que hace aparecer a sus `Item` uno tras otro. */
export function Escalonado({
  como = 'div',
  paso = 0.08,
  inicio = 0,
  alMontar = false,
  className = '',
  children,
}: {
  como?: 'div' | 'ul' | 'ol';
  paso?: number;
  inicio?: number;
  /** Arriba de todo (hero, formularios): anima al montar en lugar de esperar el scroll. */
  alMontar?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const Componente = como === 'ul' ? m.ul : como === 'ol' ? m.ol : m.div;
  const disparo = alMontar
    ? { animate: 'visible' as const }
    : { whileInView: 'visible' as const, viewport: VISTA };
  return (
    <Componente
      className={className}
      variants={CONTENEDOR(paso, inicio)}
      initial="oculto"
      {...disparo}
    >
      {children}
    </Componente>
  );
}

/** Hijo de `Escalonado`: hereda el momento de aparecer. */
export function Item({
  como = 'div',
  desde = 'abajo',
  className = '',
  children,
}: {
  como?: 'div' | 'li' | 'article';
  desde?: Desde;
  className?: string;
  children: ReactNode;
}) {
  const Componente = como === 'li' ? m.li : como === 'article' ? m.article : m.div;
  return (
    <Componente className={className} variants={variantes(desde)}>
      {children}
    </Componente>
  );
}
