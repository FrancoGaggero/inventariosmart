import {
  formatearWhatsApp,
  normalizarWhatsApp,
  type CanalEnvio,
  type CanalProveedor,
} from '@inventariosmart/shared';

// Textos del envío de órdenes por canal (HU-16): funciones puras, sin red ni sesión.

/** Ayuda bajo el teléfono del proveedor: cómo queda para WhatsApp, o qué le falta. */
export function ayudaTelefono(telefono: string): { texto: string; sirve: boolean | null } {
  if (telefono.trim() === '') {
    return { texto: 'Opcional. Con código de área sirve para WhatsApp', sirve: null };
  }
  const numero = normalizarWhatsApp(telefono);
  return numero
    ? { texto: `WhatsApp: ${formatearWhatsApp(numero)}`, sirve: true }
    : { texto: 'Para WhatsApp falta el código de área (por ejemplo, 011 o 0351)', sirve: false };
}

/** Canales que el proveedor puede usar con los datos que tiene cargados. */
export function canalesDe(p: { email: string | null; whatsapp: string | null }): CanalProveedor[] {
  return [...(p.email ? (['EMAIL'] as const) : []), ...(p.whatsapp ? (['WHATSAPP'] as const) : [])];
}

/** Texto del botón de confirmar según por dónde sale la orden. */
export function textoConfirmar(canal: CanalProveedor | null): string {
  if (canal === 'EMAIL') return 'Confirmar y enviar por correo';
  if (canal === 'WHATSAPP') return 'Confirmar y enviar por WhatsApp';
  return 'Confirmar';
}

/** Qué va a pasar al confirmar, en lenguaje claro. */
export function avisoDeEnvio(
  canal: CanalProveedor | null,
  p: { email: string | null; whatsapp: string | null },
): string {
  if (canal === 'EMAIL' && p.email) {
    return `Al confirmar se envía por correo a ${p.email}, con tu correo como respuesta.`;
  }
  if (canal === 'WHATSAPP' && p.whatsapp) {
    return `Al confirmar vas a poder abrir WhatsApp con el mensaje ya escrito para ${formatearWhatsApp(p.whatsapp)}. Lo enviás vos desde tu teléfono.`;
  }
  return 'Este proveedor no tiene email ni WhatsApp: al confirmar, la orden queda lista para que copies el texto y la envíes por otro medio.';
}

/** Cómo salió una orden enviada. */
export function fraseEnviada(o: {
  canal: CanalEnvio | null;
  enviadaA: string | null;
  fecha: string;
}): string {
  if (o.canal === 'WHATSAPP')
    return `Enviada por WhatsApp a ${o.enviadaA ?? 'el proveedor'} el ${o.fecha}.`;
  if (o.canal === 'OTRO') return `Marcada como enviada el ${o.fecha}.`;
  return `Enviada por correo a ${o.enviadaA ?? 'el proveedor'} el ${o.fecha}.`;
}
