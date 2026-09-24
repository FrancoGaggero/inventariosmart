/** Gráfica decorativa de barras que suben con una línea de tendencia (login y landing). */
export function GraficaBarras({ className = '' }: { className?: string }) {
  const barras = [38, 52, 46, 64, 58, 76, 70, 88];
  return (
    <svg viewBox="0 0 240 110" className={`w-full max-w-xs ${className}`} aria-hidden>
      <defs>
        <linearGradient id="g-barra" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {barras.map((h, i) => (
        <rect
          key={i}
          x={12 + i * 28}
          y={100 - h}
          width={18}
          height={h}
          rx={5}
          fill="url(#g-barra)"
          className="entra"
          style={{ ['--i' as string]: i, transformOrigin: 'bottom' }}
        />
      ))}
      <path
        d="M20 72 L48 60 L76 66 L104 44 L132 50 L160 30 L188 36 L216 14"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}
