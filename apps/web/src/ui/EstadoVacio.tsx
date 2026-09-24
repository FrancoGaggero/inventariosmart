import type { ReactNode } from 'react';

export type Ilustracion = 'cajas' | 'campana' | 'carrito' | 'camion' | 'recibo' | 'flechas';

/** Ilustraciones SVG inline, con los colores de la marca (design D4). */
function Dibujo({ tipo }: { tipo: Ilustracion }) {
  const comun = {
    width: 120,
    height: 88,
    viewBox: '0 0 120 88',
    fill: 'none',
    'aria-hidden': true,
  } as const;
  const trazo = 'var(--color-brand-3)';
  const suave = 'color-mix(in srgb, var(--color-brand) 18%, transparent)';
  switch (tipo) {
    case 'cajas':
      return (
        <svg {...comun}>
          <ellipse cx="60" cy="78" rx="44" ry="6" fill={suave} />
          <rect
            x="22"
            y="40"
            width="34"
            height="30"
            rx="4"
            fill={suave}
            stroke={trazo}
            strokeWidth="2"
          />
          <rect
            x="62"
            y="40"
            width="34"
            height="30"
            rx="4"
            fill={suave}
            stroke={trazo}
            strokeWidth="2"
          />
          <rect
            x="42"
            y="12"
            width="34"
            height="28"
            rx="4"
            fill={suave}
            stroke={trazo}
            strokeWidth="2"
          />
          <path
            d="M42 22h34M22 50h34M62 50h34"
            stroke={trazo}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </svg>
      );
    case 'campana':
      return (
        <svg {...comun}>
          <ellipse cx="60" cy="78" rx="40" ry="6" fill={suave} />
          <path
            d="M40 60c0-18 4-34 20-34s20 16 20 34l6 6H34l6-6Z"
            fill={suave}
            stroke={trazo}
            strokeWidth="2"
          />
          <path d="M52 70a8 8 0 0 0 16 0" stroke={trazo} strokeWidth="2" />
          <circle cx="60" cy="22" r="4" fill={trazo} />
          <path
            d="M84 30l6-4M36 30l-6-4M60 12V8"
            stroke={trazo}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'carrito':
      return (
        <svg {...comun}>
          <ellipse cx="60" cy="80" rx="42" ry="5" fill={suave} />
          <path
            d="M20 20h12l10 36h42l8-24H36"
            fill={suave}
            stroke={trazo}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="48" cy="68" r="5" fill={suave} stroke={trazo} strokeWidth="2" />
          <circle cx="78" cy="68" r="5" fill={suave} stroke={trazo} strokeWidth="2" />
          <path d="M52 40h24M56 48h16" stroke={trazo} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'camion':
      return (
        <svg {...comun}>
          <ellipse cx="60" cy="80" rx="44" ry="5" fill={suave} />
          <rect
            x="16"
            y="30"
            width="56"
            height="32"
            rx="4"
            fill={suave}
            stroke={trazo}
            strokeWidth="2"
          />
          <path
            d="M72 40h18l12 12v10H72V40Z"
            fill={suave}
            stroke={trazo}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="34" cy="66" r="6" fill={suave} stroke={trazo} strokeWidth="2" />
          <circle cx="86" cy="66" r="6" fill={suave} stroke={trazo} strokeWidth="2" />
          <path d="M26 44h30" stroke={trazo} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'recibo':
      return (
        <svg {...comun}>
          <ellipse cx="60" cy="80" rx="36" ry="5" fill={suave} />
          <path
            d="M38 10h44v62l-7-5-7 5-8-5-8 5-7-5-7 5V10Z"
            fill={suave}
            stroke={trazo}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M48 26h24M48 38h24M48 50h14"
            stroke={trazo}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'flechas':
      return (
        <svg {...comun}>
          <ellipse cx="60" cy="80" rx="40" ry="5" fill={suave} />
          <path
            d="M28 34h56l-10-10M92 54H36l10 10"
            stroke={trazo}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="60" cy="44" r="18" fill={suave} />
        </svg>
      );
  }
}

/** Estado vacío con ilustración, título, texto y acción opcional (design D4). */
export function EstadoVacio({
  ilustracion,
  titulo,
  texto,
  accion,
  className = '',
}: {
  ilustracion: Ilustracion;
  titulo: string;
  texto?: ReactNode;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`entra flex flex-col items-center text-center px-6 py-10 ${className}`}
    >
      <Dibujo tipo={ilustracion} />
      <p className="font-bold mt-3">{titulo}</p>
      {texto && <p className="text-sm text-t2 mt-1 max-w-md">{texto}</p>}
      {accion && <div className="mt-4 flex flex-wrap gap-2 justify-center">{accion}</div>}
    </div>
  );
}
