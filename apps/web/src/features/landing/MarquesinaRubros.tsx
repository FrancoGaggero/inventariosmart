import { m, useReducedMotion, useScroll, useTransform } from 'motion/react';

/** Rubros de los comercios de la encuesta de validación (marzo de 2026). */
export const RUBROS = [
  'Repuestos del automotor',
  'Ferretería',
  'Textil e indumentaria',
  'Electrónica',
  'Materiales de construcción',
  'Alimentos y bebidas',
  'Librería y bazar',
  'Sanitarios',
  'Pinturería',
  'Insumos médicos',
];

function Fila({ oculta = false }: { oculta?: boolean }) {
  return (
    <ul
      aria-hidden={oculta || undefined}
      className="flex shrink-0 items-center gap-3 pr-3"
      aria-label={oculta ? undefined : 'Rubros de los comercios que validaron la idea'}
    >
      {RUBROS.map((r) => (
        <li key={r} className="chip whitespace-nowrap">
          {r}
        </li>
      ))}
    </ul>
  );
}

/**
 * Marquesina de rubros debajo del hero (landing-3d D6): avanza sólo con el scroll, así no se mueve
 * sola (WCAG 2.2.2). La lista se lee una vez; la copia que completa la tira va oculta. Con
 * "reducir movimiento" queda quieta, en varias líneas.
 */
export function MarquesinaRubros() {
  const reducido = useReducedMotion();
  const { scrollY } = useScroll();
  const x = useTransform(scrollY, [0, 2400], [0, -900]);
  if (reducido) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
        <ul
          className="flex flex-wrap gap-2"
          aria-label="Rubros de los comercios que validaron la idea"
        >
          {RUBROS.map((r) => (
            <li key={r} className="chip">
              {r}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="overflow-hidden py-4 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <m.div className="flex w-max" style={{ x }}>
        <Fila />
        <Fila oculta />
        <Fila oculta />
      </m.div>
    </div>
  );
}
