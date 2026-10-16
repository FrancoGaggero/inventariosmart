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

const TRAZO: Variants = {
  oculto: { pathLength: 0, opacity: 0 },
  visible: { pathLength: 1, opacity: 1, transition: { duration: 0.9, ease: [0.2, 0.7, 0.2, 1] } },
};

/**
 * Título que se arma palabra por palabra al cargar (landing-motion D2). El texto completo queda en
 * el `aria-label`: los lectores de pantalla no leen palabras sueltas. Con `subrayado`, esa parte
 * lleva un trazo que se dibuja debajo cuando terminan de llegar las palabras (landing-3d D6).
 */
export function TextoQueSeArma({
  partes,
  como: Etiqueta = 'h1',
  className = '',
  subrayado,
}: {
  partes: ParteTexto[];
  como?: 'h1' | 'h2';
  className?: string;
  subrayado?: number;
}) {
  const lista = tokens(partes.map((p) => p.texto));
  const grupos: { parte: number; desde: number; tokens: typeof lista }[] = [];
  lista.forEach((t, i) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.parte === t.parte) ultimo.tokens.push(t);
    else grupos.push({ parte: t.parte, desde: i, tokens: [t] });
  });
  const palabra = (t: (typeof lista)[number], i: number) => (
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
  );
  return (
    <Etiqueta aria-label={unirTokens(lista)} className={className}>
      <m.span
        className="inline [perspective:800px]"
        variants={CONTENEDOR}
        initial="oculto"
        animate="visible"
      >
        {grupos.map((g) =>
          g.parte === subrayado ? (
            <Fragment key={g.desde}>
              {g.desde > 0 && !g.tokens[0]!.pegado && ' '}
              <span className="relative inline-block whitespace-nowrap">
                {g.tokens.map((t, k) => palabra(t, k === 0 ? 0 : g.desde + k))}
                <svg
                  aria-hidden
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                  className="absolute left-0 -bottom-1.5 w-full h-[0.22em] text-brand overflow-visible"
                >
                  <m.path
                    d="M2 8 C 40 2, 90 2, 120 6 S 180 10, 198 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    variants={TRAZO}
                    transition={{ delay: 0.9 }}
                  />
                </svg>
              </span>
            </Fragment>
          ) : (
            g.tokens.map((t, k) => palabra(t, g.desde + k))
          ),
        )}
      </m.span>
    </Etiqueta>
  );
}
