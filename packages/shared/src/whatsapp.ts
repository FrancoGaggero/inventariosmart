import { z } from 'zod';

// ---------------------------------------------------------------------------
// Envío de órdenes por WhatsApp — HU-16 (RF-17, RN-06)
// ---------------------------------------------------------------------------

/** Canales que se pueden elegir para un proveedor. */
export const CANALES_PROVEEDOR = ['EMAIL', 'WHATSAPP'] as const;
export const CanalProveedorSchema = z.enum(CANALES_PROVEEDOR, 'Elegí correo o WhatsApp.');
export type CanalProveedor = z.infer<typeof CanalProveedorSchema>;

/** Canal por el que salió una orden; OTRO es "la envié por mi cuenta". */
export const CANALES_ENVIO = ['EMAIL', 'WHATSAPP', 'OTRO'] as const;
export const CanalEnvioSchema = z.enum(CANALES_ENVIO);
export type CanalEnvio = z.infer<typeof CanalEnvioSchema>;

export const ETIQUETA_CANAL: Record<CanalEnvio, string> = {
  EMAIL: 'Correo',
  WHATSAPP: 'WhatsApp',
  OTRO: 'Otro medio',
};

const CODIGO_ARGENTINA = '54';
/** Código de área más número, sin 0 ni 15. */
const LARGO_NACIONAL = 10;

/**
 * Quita el 15 que sigue al código de área en un número de 12 dígitos. El código de área de
 * Buenos Aires tiene 2 dígitos (11); los demás, 3 o 4.
 */
function quitar15(n: string): string {
  const largos = n.startsWith('11') ? [2] : [3, 4];
  for (const largo of largos) {
    if (n.slice(largo, largo + 2) === '15') return n.slice(0, largo) + n.slice(largo + 2);
  }
  return n;
}

function argentino(numero: string): string | null {
  let n = numero;
  // El 9 de celular que va después del código de país.
  if (n.startsWith('9') && n.length > LARGO_NACIONAL) n = n.slice(1);
  if (n.startsWith('0')) n = n.slice(1);
  if (n.length === LARGO_NACIONAL + 2) n = quitar15(n);
  // Los códigos de área argentinos empiezan con 11, 2 o 3: "15 2345 6789" no tiene código de área.
  if (n.length !== LARGO_NACIONAL || !/^(11|[23])/.test(n)) return null;
  return `${CODIGO_ARGENTINA}9${n}`;
}

/**
 * Lleva un teléfono cargado con cualquier formato al que usa WhatsApp: sólo dígitos, con código de
 * país. Los números argentinos quedan como 549 + código de área + número. Devuelve null si el
 * teléfono no sirve (por ejemplo, sin código de área).
 */
export function normalizarWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  const texto = telefono.trim();
  if (/[a-z]/i.test(texto)) return null;
  let digitos = texto.replace(/\D/g, '');
  if (digitos === '') return null;
  const conCodigoDePais = texto.startsWith('+') || digitos.startsWith('00');
  if (digitos.startsWith('00')) digitos = digitos.slice(2);
  if (conCodigoDePais) {
    if (digitos.startsWith(CODIGO_ARGENTINA)) return argentino(digitos.slice(2));
    return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
  }
  // "54 9 11 2345 6789" sin el +: ningún código de área argentino empieza con 54.
  if (digitos.startsWith(CODIGO_ARGENTINA) && digitos.length > LARGO_NACIONAL + 1) {
    return argentino(digitos.slice(2));
  }
  return argentino(digitos);
}

/** "5491123456789" → "+54 9 11 2345-6789", para mostrar cómo quedó el número. */
export function formatearWhatsApp(numero: string): string {
  if (!numero.startsWith(`${CODIGO_ARGENTINA}9`) || numero.length !== LARGO_NACIONAL + 3) {
    return `+${numero}`;
  }
  const nacional = numero.slice(3);
  const area = nacional.startsWith('11') ? 2 : 3;
  const resto = nacional.slice(area);
  return `+54 9 ${nacional.slice(0, area)} ${resto.slice(0, -4)}-${resto.slice(-4)}`;
}

export interface ContactoProveedor {
  email: string | null;
  telefono: string | null;
  canalPreferido: CanalProveedor | null;
}

/** true si el proveedor tiene los datos que ese canal necesita. */
export function canalDisponible(p: ContactoProveedor, canal: CanalProveedor): boolean {
  return canal === 'EMAIL' ? !!p.email : normalizarWhatsApp(p.telefono) !== null;
}

/**
 * Canal que corresponde a un proveedor (CP-16.1b): el preferido si tiene los datos; si no, el
 * correo; si no, WhatsApp; si no tiene ninguno, null.
 */
export function canalDeProveedor(p: ContactoProveedor): CanalProveedor | null {
  if (p.canalPreferido && canalDisponible(p, p.canalPreferido)) return p.canalPreferido;
  if (canalDisponible(p, 'EMAIL')) return 'EMAIL';
  if (canalDisponible(p, 'WHATSAPP')) return 'WHATSAPP';
  return null;
}

/** Mensaje de error si el canal preferido no se puede usar con esos datos, o null. */
export function validarCanalPreferido(p: ContactoProveedor): string | null {
  if (p.canalPreferido === null || canalDisponible(p, p.canalPreferido)) return null;
  return p.canalPreferido === 'EMAIL'
    ? 'Para elegir el correo como canal, cargá el email del proveedor.'
    : 'Para elegir WhatsApp como canal, cargá el teléfono con código de área.';
}

export const MENSAJE_WHATSAPP_MAX = 3000;
export const NOTA_MENSAJE_RECORTADO = '\n\n(…) Te paso el detalle completo aparte.';

/**
 * Mensaje de WhatsApp de una orden: el asunto en la primera línea y el texto debajo. Si no entra,
 * se recorta en un salto de línea y termina con una nota (CP-16.4b).
 */
export function mensajeWhatsApp(asunto: string, texto: string): string {
  const mensaje = `${asunto.trim()}\n\n${texto.trim()}`;
  if (mensaje.length <= MENSAJE_WHATSAPP_MAX) return mensaje;
  const tope = MENSAJE_WHATSAPP_MAX - NOTA_MENSAJE_RECORTADO.length;
  const corte = mensaje.lastIndexOf('\n', tope);
  const cuerpo = corte > 0 ? mensaje.slice(0, corte) : mensaje.slice(0, tope);
  return cuerpo.trimEnd() + NOTA_MENSAJE_RECORTADO;
}

/** Enlace "clic para chatear": abre WhatsApp con el chat y el mensaje escrito. */
export function enlaceWhatsApp(numero: string, mensaje: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
