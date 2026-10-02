import { BarChart3 } from 'lucide-react';

/** Logo de InventarioSmart: baldosa ámbar con el glifo en tinta (web-redesign D6). */
export function Logo({
  conTexto = true,
  grande = false,
  className = '',
}: {
  conTexto?: boolean;
  grande?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-extrabold tracking-tight ${className}`}>
      <span
        className={`${grande ? 'w-10 h-10 rounded-xl' : 'w-8 h-8 rounded-lg'} bg-brand text-on-brand grid place-items-center shrink-0 shadow-[0_6px_16px_-8px_var(--color-glow)]`}
      >
        <BarChart3 className={grande ? 'w-5 h-5' : 'w-4 h-4'} aria-hidden />
      </span>
      {conTexto && <span className={grande ? 'text-xl' : ''}>InventarioSmart</span>}
    </span>
  );
}
