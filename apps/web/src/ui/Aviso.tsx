import type { ReactNode } from 'react';

type Tono = 'error' | 'info' | 'plan' | 'ok';

const ESTILO: Record<Tono, string> = {
  error: 'text-crit bg-crit/10 border-crit/30',
  info: 'text-t1 bg-white/5 border-white/10',
  plan: 'text-violet bg-violet/10 border-violet/30',
  ok: 'text-ok bg-ok/10 border-ok/30',
};

export function Aviso({ tono = 'info', children }: { tono?: Tono; children: ReactNode }) {
  return (
    <p
      role={tono === 'error' ? 'alert' : 'status'}
      className={`text-sm border rounded-lg px-3 py-2 ${ESTILO[tono]}`}
    >
      {children}
    </p>
  );
}
