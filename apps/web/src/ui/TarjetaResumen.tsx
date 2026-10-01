import type { LucideIcon } from 'lucide-react';
import { Entrada } from './Entrada';

const COLOR = { crit: 'text-crit', warn: 'text-warn', brand: 'text-brand-3' } as const;

/** Total de una página de análisis (falta de stock, stock parado): título, valor y detalle. */
export function TarjetaResumen({
  titulo,
  valor,
  detalle,
  Icono,
  tono,
  indice,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  Icono: LucideIcon;
  tono: keyof typeof COLOR;
  indice: number;
}) {
  return (
    <Entrada as="div" indice={indice} className="card p-5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-t3 flex items-center gap-2">
        <Icono className={`w-4 h-4 ${COLOR[tono]}`} aria-hidden />
        {titulo}
      </dt>
      <dd className="mt-2 text-2xl font-extrabold tabular-nums">{valor}</dd>
      <dd className="text-xs text-t2 mt-1">{detalle}</dd>
    </Entrada>
  );
}
