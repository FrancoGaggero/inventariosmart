import { ASISTENTE_MAX_CARACTERES, type FuenteAsistente } from '@inventariosmart/shared';

// Textos y reglas de pantalla del asistente (HU-08): funciones puras, sin red ni sesión.

/** Preguntas para empezar una conversación vacía (CP-08.6). */
export const PREGUNTAS_SUGERIDAS = [
  '¿Qué productos tengo que reponer?',
  '¿Qué fue lo que más vendí este mes?',
  '¿Cuál fue mi producto más rentable del mes?',
  '¿Cómo vienen mis precios frente a la inflación?',
  '¿Tengo plata parada en productos que no se venden?',
] as const;

export const AVISO_IA =
  'Las respuestas las genera un modelo de inteligencia artificial con los datos de tu comercio. Verificá los números importantes en su pantalla.';

export const AVISO_PLAN =
  'Disponible en el plan PREMIUM: preguntale al asistente por tus ventas, tu stock, tus márgenes y tus proveedores, y pedile que te prepare un pedido.';

const entero = new Intl.NumberFormat('es-AR');

/** "120 / 1.000" */
export function contadorDeCaracteres(texto: string): string {
  return `${entero.format(texto.length)} / ${entero.format(ASISTENTE_MAX_CARACTERES)}`;
}

export function excedeElLargo(texto: string): boolean {
  return texto.trim().length > ASISTENTE_MAX_CARACTERES;
}

export function puedeEnviar(texto: string, ocupado: boolean): boolean {
  return !ocupado && texto.trim().length > 0 && !excedeElLargo(texto);
}

/** "Consulté: Productos más rentables y Alertas de reposición." */
export function fraseFuentes(fuentes: Pick<FuenteAsistente, 'nombre'>[]): string {
  const nombres = [...new Set(fuentes.map((f) => f.nombre))];
  if (nombres.length === 0) return '';
  const ultima = nombres.pop()!;
  return `Consulté: ${nombres.length > 0 ? `${nombres.join(', ')} y ${ultima}` : ultima}.`;
}

export type BloqueTexto = { tipo: 'parrafo'; texto: string } | { tipo: 'lista'; items: string[] };

/**
 * Separa la respuesta en párrafos y listas para mostrarla. El texto se muestra siempre como
 * texto: acá sólo se quitan las marcas de formato que el modelo pueda haber dejado.
 */
export function bloquesDeTexto(contenido: string): BloqueTexto[] {
  const bloques: BloqueTexto[] = [];
  const limpiar = (linea: string) =>
    linea
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/^#{1,6}\s+/, '')
      .trim();
  for (const cruda of contenido.split(/\r?\n/)) {
    const linea = cruda.trim();
    if (linea === '') continue;
    const item = /^(?:[-•*]|\d+[.)])\s+(.*)$/.exec(linea);
    const ultimo = bloques.at(-1);
    if (item) {
      const texto = limpiar(item[1] ?? '');
      if (ultimo?.tipo === 'lista') ultimo.items.push(texto);
      else bloques.push({ tipo: 'lista', items: [texto] });
    } else {
      bloques.push({ tipo: 'parrafo', texto: limpiar(linea) });
    }
  }
  return bloques;
}

const hora = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const diaMes = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
const DIA_MS = 24 * 60 * 60 * 1000;

const medianoche = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "hoy 14:32", "ayer" o "12 sept", según cuándo fue el último mensaje. */
export function fechaDeConversacion(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso);
  const dias = Math.round((medianoche(ahora) - medianoche(fecha)) / DIA_MS);
  if (dias <= 0) return `hoy ${hora.format(fecha)}`;
  if (dias === 1) return 'ayer';
  return diaMes.format(fecha);
}

export interface AvisoAsistente {
  tono: 'error' | 'warn' | 'plan';
  texto: string;
}

/** Aviso para un error al enviar: el límite y la falta del servicio no son fallas del usuario. */
export function avisoDeError(status: number, mensaje: string): AvisoAsistente {
  if (status === 402) return { tono: 'plan', texto: AVISO_PLAN };
  if (status === 429) {
    return {
      tono: 'warn',
      texto: mensaje || 'Llegaste al límite de consultas de hoy. Se renueva mañana.',
    };
  }
  if (status === 503) {
    return {
      tono: 'warn',
      texto:
        'El asistente no está disponible en este momento. Tu consulta quedó escrita: probá de nuevo en unos minutos.',
    };
  }
  return { tono: 'error', texto: mensaje };
}
