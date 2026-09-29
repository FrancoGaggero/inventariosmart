import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { RUTA_PLAN } from '@/lib/plan-formato';

type Tono = 'error' | 'info' | 'plan' | 'ok' | 'warn';

const ESTILO: Record<Tono, string> = {
  error: 'text-crit bg-crit/10 border-crit/30',
  info: 'text-t1 bg-fill border-line',
  plan: 'text-violet bg-violet/10 border-violet/30',
  ok: 'text-ok bg-ok/10 border-ok/30',
  warn: 'text-warn bg-warn/10 border-warn/30',
};

/**
 * Aviso en línea. Los de tono `plan` (funcionalidad no incluida) llevan el enlace a la página
 * "Plan" (HU-14); `sinEnlace` lo quita donde no corresponde.
 */
export function Aviso({
  tono = 'info',
  sinEnlace = false,
  children,
}: {
  tono?: Tono;
  sinEnlace?: boolean;
  children: ReactNode;
}) {
  return (
    <p
      role={tono === 'error' ? 'alert' : 'status'}
      className={`text-sm border rounded-lg px-3 py-2 ${ESTILO[tono]}`}
    >
      {children}
      {tono === 'plan' && !sinEnlace && (
        <>
          {' '}
          <Link to={RUTA_PLAN} className="font-semibold underline whitespace-nowrap">
            Ver planes
          </Link>
        </>
      )}
    </p>
  );
}
