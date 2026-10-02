import { type MotionValue, m, useReducedMotion, useScroll, useTransform } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { useRef } from 'react';
import { tramoDePaso } from '@/lib/animacion';
import { Escalonado, Item } from './Revelar';
import { useMedia } from './useMedia';

export interface Paso {
  Icono: LucideIcon;
  titulo: string;
  texto: string;
}

function Numero({ i }: { i: number }) {
  return (
    <span className="w-9 h-9 rounded-full bg-brand text-on-brand grid place-items-center font-extrabold shrink-0">
      {i + 1}
    </span>
  );
}

function Contenido({ p, i }: { p: Paso; i: number }) {
  return (
    <>
      <Numero i={i} />
      <div>
        <h3 className="font-bold flex items-center gap-2">
          <p.Icono className="w-4 h-4 text-brand-3" aria-hidden />
          {p.titulo}
        </h3>
        <p className="text-sm text-t2 mt-1">{p.texto}</p>
      </div>
    </>
  );
}

function PasoAnclado({
  p,
  i,
  total,
  progreso,
}: {
  p: Paso;
  i: number;
  total: number;
  progreso: MotionValue<number>;
}) {
  const [a, b, c, d] = tramoDePaso(i, total);
  const ultimo = i === total - 1;
  // Se ilumina en su tramo del scroll; el último queda encendido al final.
  const opacity = useTransform(progreso, [a, b, c, d], [0.35, 1, 1, ultimo ? 1 : 0.35]);
  const x = useTransform(progreso, [a, b], [0, 14]);
  const scale = useTransform(progreso, [a, b], [0.97, 1]);
  return (
    <m.li className="card p-6 flex gap-4" style={{ opacity, x, scale }}>
      <Contenido p={p} i={i} />
    </m.li>
  );
}

/**
 * "Cómo funciona" (landing-motion D2): desde 1024 px el bloque se ancla y cada paso se ilumina a
 * medida que se hace scroll; en pantallas angostas o con "reducir movimiento", la lista de siempre.
 */
export function ComoFuncionaAnclado({
  pasos,
  titulo,
  subtitulo,
}: {
  pasos: Paso[];
  titulo: string;
  subtitulo: string;
}) {
  const ancho = useMedia('(min-width: 1024px)');
  const reducido = useReducedMotion();
  const encabezado = (
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight">{titulo}</h2>
      <p className="text-t2 text-sm mt-1">{subtitulo}</p>
    </div>
  );

  if (!ancho || reducido) {
    return (
      <div className="space-y-6">
        {encabezado}
        <Escalonado como="ol" className="grid gap-4 md:grid-cols-3">
          {pasos.map((p, i) => (
            <Item como="li" key={p.titulo} className="card p-5 flex gap-4">
              <Contenido p={p} i={i} />
            </Item>
          ))}
        </Escalonado>
      </div>
    );
  }
  return <Anclado pasos={pasos} encabezado={encabezado} />;
}

function Anclado({ pasos, encabezado }: { pasos: Paso[]; encabezado: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const linea = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <div ref={ref} className="relative h-[240vh]">
      <div className="sticky top-24 grid grid-cols-[1fr_1.5fr] gap-12 items-center min-h-[70vh]">
        <div className="flex gap-5">
          <div className="relative w-1 rounded-full bg-line-2 self-stretch" aria-hidden>
            <m.div
              className="absolute inset-0 rounded-full bg-brand origin-top"
              style={{ scaleY: linea }}
            />
          </div>
          <div className="space-y-4">
            {encabezado}
            <p className="text-sm text-t3">Seguí bajando para ver cada paso.</p>
          </div>
        </div>
        <ol className="flex flex-col gap-4">
          {pasos.map((p, i) => (
            <PasoAnclado
              key={p.titulo}
              p={p}
              i={i}
              total={pasos.length}
              progreso={scrollYProgress}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
