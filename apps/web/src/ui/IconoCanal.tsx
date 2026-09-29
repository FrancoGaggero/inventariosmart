import type { CanalEnvio } from '@inventariosmart/shared';
import { Mail, Send } from 'lucide-react';

/**
 * Globo con tubo de teléfono, el símbolo con el que se reconoce a WhatsApp. `plano` lo dibuja en
 * un solo color (el del texto), para usarlo dentro de un botón de color.
 */
export function IconoWhatsApp({
  className = 'w-4 h-4',
  plano = false,
}: {
  className?: string;
  plano?: boolean;
}) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden>
      <path
        d="M12 2a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l5.4-1.3A9.5 9.5 0 1 0 12 2Z"
        fill={plano ? 'currentColor' : 'var(--color-whatsapp)'}
      />
      <path
        transform="translate(6.9 6.4) scale(0.43)"
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
        fill={plano ? 'var(--color-whatsapp)' : '#fff'}
      />
    </svg>
  );
}

/**
 * Ícono del canal de envío (HU-16). El correo lleva un sobre y no el logo de un servicio en
 * particular: el proveedor puede usar cualquier casilla.
 */
export function IconoCanal({
  canal,
  className = 'w-4 h-4',
  plano = false,
}: {
  canal: CanalEnvio;
  className?: string;
  plano?: boolean;
}) {
  if (canal === 'WHATSAPP') return <IconoWhatsApp className={className} plano={plano} />;
  const Icono = canal === 'EMAIL' ? Mail : Send;
  return <Icono className={`shrink-0 ${className}`} aria-hidden />;
}
