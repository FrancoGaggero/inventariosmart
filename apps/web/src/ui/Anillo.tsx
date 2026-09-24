import { useContador } from './useContador';

/**
 * Anillo de porcentaje en SVG (design D4): el arco crece desde 0 hasta el valor.
 * `valor` en porcentaje (puede ser negativo: se pinta en rojo, arco vacío).
 */
export function Anillo({
  valor,
  etiqueta,
  tamanio = 64,
  grosor = 7,
}: {
  valor: number | null;
  etiqueta: string;
  tamanio?: number;
  grosor?: number;
}) {
  const animado = useContador(valor);
  const radio = (tamanio - grosor) / 2;
  const largo = 2 * Math.PI * radio;
  const pct = Math.max(0, Math.min(100, animado ?? 0));
  const color =
    valor === null
      ? 'var(--color-t3)'
      : valor < 0
        ? 'var(--color-crit)'
        : valor < 15
          ? 'var(--color-warn)'
          : 'var(--color-ok)';
  const texto = valor === null ? '—' : `${Math.round(animado ?? 0)}%`;
  return (
    <svg
      width={tamanio}
      height={tamanio}
      viewBox={`0 0 ${tamanio} ${tamanio}`}
      role="img"
      aria-label={`${etiqueta}: ${valor === null ? 'no calculable' : `${Math.round(valor)} %`}`}
      className="shrink-0"
    >
      <circle
        cx={tamanio / 2}
        cy={tamanio / 2}
        r={radio}
        fill="none"
        stroke="var(--color-line-2)"
        strokeWidth={grosor}
      />
      <circle
        cx={tamanio / 2}
        cy={tamanio / 2}
        r={radio}
        fill="none"
        stroke={color}
        strokeWidth={grosor}
        strokeLinecap="round"
        strokeDasharray={largo}
        strokeDashoffset={largo * (1 - pct / 100)}
        transform={`rotate(-90 ${tamanio / 2} ${tamanio / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="currentColor"
        fontSize={tamanio / 4.6}
        fontWeight={800}
      >
        {texto}
      </text>
    </svg>
  );
}
