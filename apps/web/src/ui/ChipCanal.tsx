import { ETIQUETA_CANAL, type CanalEnvio } from '@inventariosmart/shared';
import { Mail, MessageCircle, Send } from 'lucide-react';

const ICONO = { EMAIL: Mail, WHATSAPP: MessageCircle, OTRO: Send } as const;
const CLASE: Record<CanalEnvio, string> = {
  EMAIL: 'bg-brand/15 text-brand-3',
  WHATSAPP: 'bg-ok/15 text-ok',
  OTRO: 'bg-fill text-t2',
};

/** Canal por el que sale (o salió) una orden: correo, WhatsApp u otro medio (HU-16). */
export function ChipCanal({ canal, className = '' }: { canal: CanalEnvio; className?: string }) {
  const Icono = ICONO[canal];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${CLASE[canal]} ${className}`}
    >
      <Icono className="w-3 h-3" aria-hidden />
      {ETIQUETA_CANAL[canal]}
    </span>
  );
}
