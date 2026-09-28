import { z } from 'zod';

// Asistente conversacional con IA (HU-08, RF-10). Plan PREMIUM (RN-09), sólo DUENIO.

/** Largo máximo de un mensaje del usuario. */
export const ASISTENTE_MAX_CARACTERES = 1000;
/** Mensajes por día y por comercio, salvo que la API configure otro tope. */
export const ASISTENTE_LIMITE_DIARIO = 50;
/** Consultas al sistema que el asistente puede hacer para armar una respuesta. */
export const ASISTENTE_MAX_CONSULTAS = 6;
/** Mensajes anteriores de la conversación que se tienen en cuenta. */
export const ASISTENTE_MAX_HISTORIAL = 20;
/** Filas que devuelve como máximo cada consulta del asistente. */
export const ASISTENTE_MAX_FILAS = 10;
export const ASISTENTE_MAX_TITULO = 80;

export const ROLES_MENSAJE = ['USUARIO', 'ASISTENTE'] as const;
export const RolMensajeSchema = z.enum(ROLES_MENSAJE);
export type RolMensaje = z.infer<typeof RolMensajeSchema>;

/** Consultas predefinidas del asistente, con el nombre que ve el usuario. */
export const HERRAMIENTAS_ASISTENTE = {
  resumen_rentabilidad: 'Rentabilidad del período',
  productos_mas_rentables: 'Productos más rentables',
  buscar_productos: 'Productos',
  alertas_de_reposicion: 'Alertas de reposición',
  gastos_del_periodo: 'Gastos',
  precios_frente_a_inflacion: 'Precios e inflación',
  indicadores_economicos: 'Indicadores oficiales',
  buscar_proveedores: 'Proveedores',
  comparar_proveedores: 'Comparador de proveedores',
  preparar_orden: 'Orden en borrador',
} as const;
export type HerramientaAsistente = keyof typeof HERRAMIENTAS_ASISTENTE;
export const NOMBRES_HERRAMIENTA = Object.keys(HERRAMIENTAS_ASISTENTE) as HerramientaAsistente[];

export const FuenteAsistenteSchema = z.object({
  herramienta: z.string(),
  nombre: z.string(),
});
export type FuenteAsistente = z.infer<typeof FuenteAsistenteSchema>;

/** Lo que el asistente dejó preparado y el dueño tiene que revisar (RN-06). */
export const AccionAsistenteSchema = z.object({
  tipo: z.literal('ORDEN_BORRADOR'),
  ordenId: z.uuid(),
  numero: z.string(),
  proveedor: z.string(),
});
export type AccionAsistente = z.infer<typeof AccionAsistenteSchema>;

export const MensajeAsistenteSchema = z.object({
  id: z.uuid(),
  rol: RolMensajeSchema,
  contenido: z.string(),
  fuentes: z.array(FuenteAsistenteSchema),
  acciones: z.array(AccionAsistenteSchema),
  creadoEn: z.string(),
});
export type MensajeAsistente = z.infer<typeof MensajeAsistenteSchema>;

/** Cuerpo de POST /api/v1/assistant/messages. */
export const MensajeCreateSchema = z.object({
  conversacionId: z.uuid('La conversación no es válida.').optional(),
  mensaje: z
    .string('Escribí tu consulta.')
    .trim()
    .min(1, 'Escribí tu consulta.')
    .max(
      ASISTENTE_MAX_CARACTERES,
      `La consulta no puede superar los ${ASISTENTE_MAX_CARACTERES} caracteres.`,
    ),
});
export type MensajeCreate = z.infer<typeof MensajeCreateSchema>;

/** Respuesta de POST /api/v1/assistant/messages: el mensaje del asistente. */
export const RespuestaAsistenteSchema = z.object({
  conversacionId: z.uuid(),
  mensaje: MensajeAsistenteSchema,
});
export type RespuestaAsistente = z.infer<typeof RespuestaAsistenteSchema>;

export const ConversacionSchema = z.object({
  id: z.uuid(),
  titulo: z.string(),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});
export type Conversacion = z.infer<typeof ConversacionSchema>;

export const ListaConversacionesSchema = z.object({
  items: z.array(ConversacionSchema),
  siguienteCursor: z.string().nullable(),
});
export type ListaConversaciones = z.infer<typeof ListaConversacionesSchema>;

export const ConversacionDetalleSchema = ConversacionSchema.extend({
  mensajes: z.array(MensajeAsistenteSchema),
});
export type ConversacionDetalle = z.infer<typeof ConversacionDetalleSchema>;

export const ConversacionesQuerySchema = z.object({
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ConversacionesQuery = z.infer<typeof ConversacionesQuerySchema>;

/** Título de una conversación: el comienzo de su primer mensaje, en una línea. */
export function tituloDeConversacion(primerMensaje: string): string {
  const limpio = primerMensaje.replace(/\s+/g, ' ').trim();
  if (limpio.length <= ASISTENTE_MAX_TITULO) return limpio;
  return `${limpio.slice(0, ASISTENTE_MAX_TITULO - 1).trimEnd()}…`;
}

/** Argentina no tiene horario de verano: el desfase con UTC es fijo (−03:00). */
const DESFASE_BUENOS_AIRES_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Instante en que empezó el día calendario de Buenos Aires que contiene a `ahora`. */
export function inicioDelDiaBuenosAires(ahora: Date = new Date()): Date {
  const local = ahora.getTime() - DESFASE_BUENOS_AIRES_MS;
  return new Date(Math.floor(local / DIA_MS) * DIA_MS + DESFASE_BUENOS_AIRES_MS);
}

/** "2026-10-02": la fecha de hoy en Buenos Aires. */
export function fechaBuenosAires(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - DESFASE_BUENOS_AIRES_MS).toISOString().slice(0, 10);
}
