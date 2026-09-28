import { useLayoutEffect, useRef, useState } from 'react';

export interface SerieGrafico {
  id: string;
  nombre: string;
  /** Color CSS; se usan los tokens del tema (`var(--color-…)`). */
  color: string;
  /** Un valor por etiqueta; null donde no hay dato. Vacía si la serie no se pudo calcular. */
  valores: (number | null)[];
  punteada?: boolean;
}

const ANCHO = 640;
const ANCHO_MIN = 280;
const ANCHO_MAX = 1200;
/** El gráfico se dibuja al ancho real del contenedor: así el texto no se achica en el celular. */
const altoPara = (ancho: number) => (ancho < 480 ? 220 : ancho < 800 ? 280 : 320);
const MARGEN = { izq: 46, der: 18, sup: 16, inf: 34 };
const GUIAS = 4;

const numero = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const PASOS = [2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/** Extremos del eje vertical: las guías caen en números redondos y cubren todos los valores. */
export function extremos(valores: number[]): { min: number; max: number } {
  if (valores.length === 0) return { min: 90, max: 110 };
  const menor = Math.min(...valores);
  const mayor = Math.max(...valores);
  for (const paso of PASOS) {
    const min = Math.floor(menor / paso) * paso;
    if (min + paso * GUIAS >= mayor) return { min, max: min + paso * GUIAS };
  }
  return { min: Math.floor(menor), max: Math.ceil(mayor) };
}

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
const rotulo = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toLocaleString('es-AR', { maximumFractionDigits: 1 });

/**
 * Gráfico de líneas propio en SVG (design D8): hasta cuatro series sobre las mismas etiquetas,
 * con leyenda, valores del punto activo (cursor o teclado) y una tabla con los mismos datos.
 * Los colores salen de los tokens del tema, así acompaña al tema claro y al oscuro.
 */
export function GraficoLineas({
  etiquetas,
  series,
  resumen,
  titulo = 'Índice base 100',
}: {
  /** Etiquetas del eje horizontal (meses). */
  etiquetas: { corta: string; larga: string }[];
  series: SerieGrafico[];
  /** Descripción del gráfico para lectores de pantalla. */
  resumen: string;
  titulo?: string;
}) {
  const visibles = series.filter((s) => s.valores.some((v) => v !== null));
  const ultimo = etiquetas.length - 1;
  const [activo, setActivo] = useState<number | null>(null);
  const indice = activo ?? ultimo;
  const hayDatos = etiquetas.length > 0 && visibles.length > 0;

  const caja = useRef<HTMLElement>(null);
  const [ancho, setAncho] = useState(ANCHO);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const medir = () => {
      const w = Math.round(el.clientWidth);
      if (w > 0) setAncho(Math.max(ANCHO_MIN, Math.min(ANCHO_MAX, w)));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [hayDatos]);
  const alto = altoPara(ancho);

  if (!hayDatos) {
    return (
      <p role="status" className="text-sm text-t2 text-center py-10">
        Todavía no hay datos para graficar.
      </p>
    );
  }

  const { min, max } = extremos(
    visibles.flatMap((s) => s.valores).filter((v): v is number => v !== null),
  );
  const anchoUtil = ancho - MARGEN.izq - MARGEN.der;
  const altoUtil = alto - MARGEN.sup - MARGEN.inf;
  const paso = etiquetas.length > 1 ? anchoUtil / (etiquetas.length - 1) : 0;
  const x = (i: number) =>
    etiquetas.length > 1 ? MARGEN.izq + i * paso : MARGEN.izq + anchoUtil / 2;
  const y = (v: number) => MARGEN.sup + altoUtil * (1 - (v - min) / (max - min));
  const cadaCuanto = Math.ceil(etiquetas.length / (ancho < 480 ? 4 : 6));
  /** Zona sensible de cada mes, sin salirse del área del gráfico. */
  const zona = (i: number) => {
    const desde = Math.max(MARGEN.izq, x(i) - (paso || anchoUtil) / 2);
    const hasta = Math.min(ancho - MARGEN.der, x(i) + (paso || anchoUtil) / 2);
    return { x: desde, width: Math.max(1, hasta - desde) };
  };

  /** Tramos continuos: un mes sin dato corta la línea en lugar de inventar el valor. */
  const trazo = (valores: (number | null)[]): string => {
    let d = '';
    let pluma = false;
    valores.forEach((v, i) => {
      if (v === null) {
        pluma = false;
        return;
      }
      d += `${pluma ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pluma = true;
    });
    return d.trim();
  };

  return (
    <figure ref={caja} className="m-0 space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Series del gráfico">
          {visibles.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5 text-t2">
              <svg width="18" height="8" aria-hidden>
                <line
                  x1="1"
                  y1="4"
                  x2="17"
                  y2="4"
                  stroke={s.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={s.punteada ? '2 5' : undefined}
                />
              </svg>
              {s.nombre}
            </li>
          ))}
        </ul>
        <p
          className="text-xs text-t2 tabular-nums"
          aria-live="polite"
          data-testid="valores-activos"
        >
          <b className="text-t1">{capitalizar(etiquetas[indice]!.larga)}</b>
          {visibles.map((s) => {
            const v = s.valores[indice] ?? null;
            return (
              <span key={s.id} className="ml-3 whitespace-nowrap">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ background: s.color }}
                  aria-hidden
                />
                {v === null ? '—' : numero.format(v)}
              </span>
            );
          })}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        width={ancho}
        height={alto}
        className="w-full h-auto select-none"
        role="img"
        aria-label={resumen}
        onMouseLeave={() => setActivo(null)}
      >
        {Array.from({ length: GUIAS + 1 }, (_, i) => {
          const v = min + ((max - min) * i) / GUIAS;
          return (
            <g key={i}>
              <line
                x1={MARGEN.izq}
                x2={ancho - MARGEN.der}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--color-line)"
                strokeWidth="1"
              />
              <text
                x={MARGEN.izq - 8}
                y={y(v)}
                textAnchor="end"
                dominantBaseline="central"
                fontSize="11"
                fill="var(--color-t3)"
              >
                {rotulo(v)}
              </text>
            </g>
          );
        })}
        {min < 100 && max > 100 && (
          <line
            x1={MARGEN.izq}
            x2={ancho - MARGEN.der}
            y1={y(100)}
            y2={y(100)}
            stroke="var(--color-line-2)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}
        {etiquetas.map((e, i) =>
          (ultimo - i) % cadaCuanto === 0 ? (
            <text
              key={i}
              x={x(i)}
              y={alto - 10}
              textAnchor={i === 0 ? 'start' : i === ultimo ? 'end' : 'middle'}
              fontSize="11"
              fill="var(--color-t3)"
            >
              {e.corta}
            </text>
          ) : null,
        )}

        <line
          x1={x(indice)}
          x2={x(indice)}
          y1={MARGEN.sup}
          y2={alto - MARGEN.inf}
          stroke="var(--color-line-2)"
          strokeWidth="1"
        />

        {visibles.map((s) => (
          <g key={s.id} data-serie={s.id}>
            <path
              d={trazo(s.valores)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.punteada ? 2 : 2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              {...(s.punteada ? { strokeDasharray: '2 6' } : { pathLength: 1, className: 'trazo' })}
            />
            {s.valores.map((v, i) =>
              v === null ? null : (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  r={i === indice ? 4.5 : s.punteada ? 2 : 3}
                  fill={s.color}
                  stroke="var(--color-bg-2)"
                  strokeWidth="1.5"
                >
                  <title>{`${s.nombre}, ${etiquetas[i]!.larga}: ${numero.format(v)}`}</title>
                </circle>
              ),
            )}
          </g>
        ))}

        {etiquetas.map((e, i) => (
          <rect
            key={i}
            {...zona(i)}
            y={MARGEN.sup}
            height={altoUtil}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`Ver los valores de ${e.larga}`}
            className="outline-none focus-visible:stroke-brand-3"
            strokeWidth="1.5"
            onMouseEnter={() => setActivo(i)}
            onFocus={() => setActivo(i)}
            onBlur={() => setActivo(null)}
            onClick={() => setActivo(i)}
          />
        ))}
      </svg>

      <details className="text-xs">
        <summary className="cursor-pointer text-t2 hover:text-t1 w-fit">Ver datos</summary>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-right tabular-nums">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr className="text-t2">
                <th scope="col" className="text-left font-semibold py-1 pr-3">
                  Mes
                </th>
                {visibles.map((s) => (
                  <th key={s.id} scope="col" className="font-semibold py-1 pl-3">
                    {s.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {etiquetas.map((e, i) => (
                <tr key={i} className="border-t border-line">
                  <th scope="row" className="text-left font-normal py-1 pr-3">
                    {capitalizar(e.larga)}
                  </th>
                  {visibles.map((s) => {
                    const v = s.valores[i] ?? null;
                    return (
                      <td key={s.id} className="py-1 pl-3">
                        {v === null ? '—' : numero.format(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
