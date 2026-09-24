/**
 * Barra de progreso horizontal (design D4). `valor` de 0 a `maximo`; el color sale del umbral:
 * crit por debajo de `critico`, warn por debajo de `alerta`, ok en el resto.
 */
export function Barra({
  valor,
  maximo,
  critico = 0,
  alerta = 0,
  etiqueta,
  className = '',
}: {
  valor: number | null;
  maximo: number;
  critico?: number;
  alerta?: number;
  etiqueta: string;
  className?: string;
}) {
  const pct =
    valor === null || maximo <= 0 ? 0 : Math.max(0, Math.min(100, (valor / maximo) * 100));
  const color =
    valor === null
      ? 'var(--color-t3)'
      : valor <= critico
        ? 'var(--color-crit)'
        : valor <= alerta
          ? 'var(--color-warn)'
          : 'var(--color-ok)';
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={maximo}
      aria-valuenow={valor ?? undefined}
      className={`h-1.5 w-full rounded-full bg-line-2 overflow-hidden ${className}`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}
