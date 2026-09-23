import { sumarMeses, type Mes } from '@inventariosmart/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Selector de mes con flechas, compartido por Gastos y Rentabilidad. */
export function SelectorMes({ valor, onChange }: { valor: Mes; onChange: (mes: Mes) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="btn btn-ghost !px-2"
        aria-label="Mes anterior"
        onClick={() => onChange(sumarMeses(valor, -1))}
      >
        <ChevronLeft className="w-4 h-4" aria-hidden />
      </button>
      <input
        type="month"
        value={valor}
        onChange={(e) => e.target.value && onChange(e.target.value as Mes)}
        aria-label="Mes"
        className="rounded-xl bg-[#070C16] border border-white/12 px-3 py-2 text-sm outline-none focus:border-brand-2 focus:ring-4 focus:ring-brand/15"
      />
      <button
        type="button"
        className="btn btn-ghost !px-2"
        aria-label="Mes siguiente"
        onClick={() => onChange(sumarMeses(valor, 1))}
      >
        <ChevronRight className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
