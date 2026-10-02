import { m, type Variants } from 'motion/react';
import { Fragment } from 'react';
import { tokens, unirTokens } from '@/lib/animacion';

export interface ParteTexto {
  texto: string;
  /** Clase para ese fragmento, p. ej. `acento-serif`. */
  className?: string;
}

const CONTENEDOR: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const PALABRA: Variants = {
  oculto: { opacity: 0, y: '0.6em', rotateX: 40 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { type: 'spring', stiffness: 260, damping: 24 },
  },
};

/**
 * Título que se arma palabra por palabra al cargar (landing-motion D2). El texto completo queda en
 * el `aria-label`: los lectores de pantalla no leen palabras sueltas.
 */
export function TextoQueSeArma({
  partes,
  como: Etiqueta = 'h1',
  className = '',
}: {
  partes: ParteTexto[];
  como?: 'h1' | 'h2';
  className?: string;
}) {
  const lista = tokens(partes.map((p) => p.texto));
  return (
    <Etiqueta aria-label={unirTokens(lista)} className={className}>
      <m.span
        className="inline [perspective:800px]"
        variants={CONTENEDOR}
        initial="oculto"
        animate="visible"
      >
        {lista.map((t, i) => (
          <Fragment key={i}>
            {i > 0 && !t.pegado && ' '}
            <m.span
              aria-hidden
              variants={PALABRA}
              className={`inline-block origin-bottom ${partes[t.parte]?.className ?? ''}`}
            >
              {t.texto}
            </m.span>
          </Fragment>
        ))}
      </m.span>
    </Etiqueta>
  );
}
