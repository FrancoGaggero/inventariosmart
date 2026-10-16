import { MessageCircle, Receipt, TrendingUp, Users } from 'lucide-react';
import { useScroll } from 'motion/react';
import { useRef } from 'react';
import { Escalonado, Item, Revelar } from '@/features/publico/Revelar';
import { Lienzo3D } from './3d/Lienzo3D';
import { fraseDeEjemplo } from './3d/datos/inflacionEjemplo';

const PUNTOS = [
  {
    Icono: Receipt,
    titulo: 'Precios netos de IVA',
    texto: 'Los márgenes se calculan sin IVA, con 21 % por defecto y la alícuota de cada producto.',
  },
  {
    Icono: TrendingUp,
    titulo: 'Tus precios frente al IPC',
    texto: 'Compará lo que subiste con la inflación oficial del INDEC y sabé qué quedó atrasado.',
  },
  {
    Icono: MessageCircle,
    titulo: 'Órdenes por WhatsApp',
    texto:
      'La orden al proveedor sale redactada para mandarla desde tu teléfono, como ya trabajás.',
  },
  {
    Icono: Users,
    titulo: 'Validado con comercios reales',
    texto:
      'Encuesta a 24 comercios de AMBA, Córdoba, Rosario y Mendoza (marzo de 2026): 3 de cada 4 se quedan sin stock todos los meses.',
  },
];

export const CIUDADES_DE_LA_MUESTRA = ['AMBA', 'Córdoba', 'Rosario', 'Mendoza'];

/**
 * Sección "Hecho para Argentina" (landing-3d D5): el texto dice lo que importa y el mapa 3D, con las
 * Islas Malvinas y el sector antártico (Ley 26.651), lo acompaña. La cinta usa datos de ejemplo.
 */
export function HechoParaArgentina() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 60%'] });
  return (
    <section
      id="argentina"
      aria-labelledby="titulo-argentina"
      className="max-w-6xl mx-auto px-4 md:px-6 py-12 scroll-mt-14"
    >
      <div
        ref={ref}
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center"
      >
        <div className="space-y-6">
          <Revelar>
            <h2
              id="titulo-argentina"
              className="text-2xl sm:text-3xl font-extrabold tracking-tight"
            >
              Hecho para <span className="acento-serif text-[1.1em]">Argentina</span>
            </h2>
            <p className="text-t2 text-sm mt-1 max-w-xl">
              Pensado para la inflación, el IVA y la forma de trabajar de las PyMEs de acá.
            </p>
          </Revelar>
          <Escalonado como="ul" className="grid gap-3 sm:grid-cols-2">
            {PUNTOS.map((p) => (
              <Item como="li" key={p.titulo} className="card p-4">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <p.Icono className="w-4 h-4 text-brand-3" aria-hidden />
                  {p.titulo}
                </h3>
                <p className="text-sm text-t2 mt-1">{p.texto}</p>
              </Item>
            ))}
          </Escalonado>
        </div>
        <figure className="space-y-3">
          <div className="relative aspect-[5/4]">
            <Lienzo3D
              escena="argentina"
              prioridad="cercania"
              progreso={scrollYProgress}
              imagen={{ ancho: 640, alto: 512 }}
              className="absolute inset-0 w-full h-full"
            />
          </div>
          <figcaption className="text-xs text-t3 space-y-1">
            <p>
              <span className="text-t2 font-semibold">Comercios de la encuesta:</span>{' '}
              {CIUDADES_DE_LA_MUESTRA.join(', ')}.
            </p>
            <p>
              <span className="etiqueta mr-1">Datos de ejemplo</span>
              {fraseDeEjemplo()} La cinta terracota es el IPC; la ámbar, tus precios.
            </p>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
