import type { InputHTMLAttributes } from 'react';

interface CampoProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'children'
> {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  ayuda?: string;
  error?: string;
}

/** Campo de formulario con etiqueta, ayuda y error, con el estilo de los wireframes. */
export function Campo({ label, value, onChange, ayuda, error, className, ...rest }: CampoProps) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="block text-xs font-semibold text-t2 mb-1.5">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-xl bg-[#070C16] border px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-brand/15 ${
          error ? 'border-crit/60 focus:border-crit' : 'border-white/12 focus:border-brand-2'
        }`}
      />
      {error ? (
        <span className="block text-xs text-crit mt-1.5">{error}</span>
      ) : ayuda ? (
        <span className="block text-xs text-t3 mt-1.5">{ayuda}</span>
      ) : null}
    </label>
  );
}
