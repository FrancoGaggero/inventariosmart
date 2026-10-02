import { ArrowLeftRight, Check, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Entrada } from '@/ui/Entrada';

// Sección "Antes y después" de la portada (landing-comparison): la planilla contra
// InventarioSmart, con una animación propia en el centro. Sólo funcionalidades que existen.

export const CON_PLANILLA = [
  'Te enterás de que falta un producto cuando el cliente ya lo pidió.',
  'Calculás el margen a mano y nunca sabés si el costo está al día.',
  'Los precios quedan atrás de la inflación sin que lo notes.',
  'Pedís a ojo y el pedido sale por WhatsApp sin registro.',
  'Cada lista de precios del proveedor es otra planilla.',
];

export const CON_INVENTARIOSMART = [
  'Alertas que avisan antes del quiebre, según lo que vendés y lo que tarda cada proveedor.',
  'Margen bruto y neto de cada producto con el último costo del proveedor, sin IVA.',
  'Tus precios frente al IPC del INDEC, con el precio sugerido para no atrasarte.',
  'Órdenes armadas con lo que hace falta, listas para mandar por correo o WhatsApp.',
  'Listas importadas desde Excel y el proveedor que más conviene para cada insumo.',
];

/** Retraso de la entrada escalonada (como `ui/Entrada`). */
const escalon = (i: number) => ({ '--i': i }) as CSSProperties;

/** Alturas de las barras de stock (de 150 hacia arriba en el viewBox). */
const BARRAS = [70, 60, 52, 44];

/**
 * El ciclo del producto en un vistazo (design D3): el stock baja, la alerta avisa, sale la orden
 * y el stock se repone. Decorativa: el contenido está en las listas. Con "reducir movimiento"
 * queda quieta en un cuadro que igual se entiende.
 */
function AnimacionReposicion() {
  return (
    <svg viewBox="0 0 200 200" className="w-[78%] h-auto" aria-hidden="true" fill="none">
      {/* Base y umbral de reposición */}
      <line
        x1="26"
        y1="150"
        x2="130"
        y2="150"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="26"
        y1="122"
        x2="130"
        y2="122"
        stroke="var(--color-acento-inverso)"
        strokeWidth="2"
        strokeDasharray="4 5"
        strokeLinecap="round"
      />
      {BARRAS.map((h, i) => (
        <rect
          key={h}
          className="anim-stock"
          style={{ animationDelay: `${i * 0.15}s` }}
          x={34 + i * 24}
          y={150 - h}
          width="16"
          height={h}
          rx="4"
          fill="currentColor"
          fillOpacity={0.9 - i * 0.15}
        />
      ))}

      {/* La alerta */}
      <g className="anim-campana">
        <path
          d="M150 44a14 14 0 0 1 14 14v10l5 7h-38l5-7V58a14 14 0 0 1 14-14Z"
          fill="var(--color-acento-inverso)"
        />
        <path
          d="M144 79a6 6 0 0 0 12 0"
          stroke="var(--color-acento-inverso)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>

      {/* La orden de compra */}
      <g className="anim-orden">
        <rect
          x="128"
          y="100"
          width="46"
          height="56"
          rx="7"
          fill="var(--color-acento-inverso)"
          fillOpacity="0.16"
          stroke="var(--color-acento-inverso)"
          strokeWidth="2.5"
        />
        <line
          x1="137"
          y1="116"
          x2="165"
          y2="116"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="137"
          y1="128"
          x2="158"
          y2="128"
          stroke="currentColor"
          strokeOpacity="0.6"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="137"
          y1="140"
          x2="161"
          y2="140"
          stroke="currentColor"
          strokeOpacity="0.6"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function Lista({
  titulo,
  items,
  positiva,
  desde,
}: {
  titulo: string;
  items: string[];
  positiva: boolean;
  desde: number;
}) {
  const Icono = positiva ? Check : X;
  return (
    <div>
      <h3 className="sr-only">{titulo}</h3>
      <ul className="flex flex-col gap-3">
        {items.map((texto, i) => (
          <Entrada
            as="li"
            indice={desde + i}
            key={texto}
            className="card p-4 flex gap-3 items-start"
          >
            <Icono
              className={`w-[18px] h-[18px] shrink-0 mt-0.5 ${positiva ? 'text-ok' : 'text-crit'}`}
              aria-hidden
            />
            <span className={`text-sm leading-snug ${positiva ? 'text-t1' : 'text-t2'}`}>
              {texto}
            </span>
          </Entrada>
        ))}
      </ul>
    </div>
  );
}

/** "Antes y después" (landing-comparison, design D2): la planilla contra InventarioSmart. */
export function FrenteAFrente() {
  return (
    <section
      id="diferencia"
      aria-labelledby="diferencia-titulo"
      className="max-w-6xl mx-auto px-4 md:px-6 py-12 flex flex-col items-center gap-9 scroll-mt-14"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <p className="entra etiqueta etiqueta-acento !text-sm !px-4 !py-1.5" style={escalon(0)}>
          <ArrowLeftRight className="w-4 h-4" aria-hidden />
          Antes y después
        </p>
        <h2
          id="diferencia-titulo"
          className="entra font-extrabold tracking-tight text-[clamp(28px,4vw,48px)] leading-[1.15] m-0"
          style={escalon(1)}
        >
          Dejá de apagar incendios.
          <br />
          <span className="inline-block pb-1 bg-[linear-gradient(90deg,var(--color-brand),var(--color-warn))] bg-clip-text text-transparent">
            Manejá tu comercio con datos.
          </span>
        </h2>
      </div>

      <div className="w-full flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-9 lg:items-center">
        <Lista titulo="Con la planilla" items={CON_PLANILLA} positiva={false} desde={2} />
        <div className="order-first lg:order-none self-center flex justify-center">
          <div className="relative rounded-full overflow-hidden card-inversa shadow-3 size-[clamp(200px,22vw,320px)] grid place-items-center">
            <AnimacionReposicion />
          </div>
        </div>
        <Lista titulo="Con InventarioSmart" items={CON_INVENTARIOSMART} positiva desde={7} />
      </div>
    </section>
  );
}
