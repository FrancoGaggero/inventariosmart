import Anthropic from '@anthropic-ai/sdk';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

/** Consulta que el modelo puede pedir, con el esquema JSON de su entrada. */
export interface DefinicionHerramienta {
  nombre: string;
  descripcion: string;
  esquema: Record<string, unknown>;
}

export type BloqueModelo =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'herramienta'; id: string; nombre: string; entrada: unknown };

export interface ResultadoHerramienta {
  id: string;
  contenido: string;
  error: boolean;
}

export type MensajeModelo =
  | { rol: 'usuario'; contenido: string }
  | { rol: 'asistente'; bloques: BloqueModelo[] }
  | { rol: 'resultados'; resultados: ResultadoHerramienta[] };

export interface PedidoModelo {
  /** Instrucciones fijas: no cambian entre pedidos, así el proveedor las puede cachear. */
  sistema: string;
  /** Lo que cambia en cada pedido: fecha y comercio. */
  contexto: string;
  mensajes: MensajeModelo[];
  herramientas: DefinicionHerramienta[];
  /** false: el modelo tiene que responder con lo que ya obtuvo. */
  permitirHerramientas: boolean;
}

export interface RespuestaModelo {
  bloques: BloqueModelo[];
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
}

/** El proveedor de IA no respondió, tardó demasiado o rechazó el pedido. */
export class ErrorModelo extends Error {
  constructor(
    message: string,
    readonly causa?: unknown,
  ) {
    super(message);
    this.name = 'ErrorModelo';
  }
}

/** Modelo de lenguaje detrás del asistente (HU-08, design D1). */
export interface ModeloAsistente {
  /** false si no está configurado: el asistente responde 503 sin intentar. */
  readonly disponible: boolean;
  responder(pedido: PedidoModelo): Promise<RespuestaModelo>;
}

export const MODELO_ASISTENTE = Symbol('MODELO_ASISTENTE');

export const MAX_TOKENS_RESPUESTA = 1024;
export const TIEMPO_LIMITE_MS = 30_000;

/** La parte del SDK que usa el adaptador; los tests la reemplazan por un doble. */
export type ClienteAnthropic = Pick<Anthropic, 'messages'>;

function aMensajes(mensajes: MensajeModelo[]): Anthropic.MessageParam[] {
  return mensajes.map((m): Anthropic.MessageParam => {
    if (m.rol === 'usuario') return { role: 'user', content: m.contenido };
    if (m.rol === 'asistente') {
      return {
        role: 'assistant',
        content: m.bloques.map((b) =>
          b.tipo === 'texto'
            ? { type: 'text' as const, text: b.texto }
            : { type: 'tool_use' as const, id: b.id, name: b.nombre, input: b.entrada },
        ),
      };
    }
    return {
      role: 'user',
      content: m.resultados.map((r) => ({
        type: 'tool_result' as const,
        tool_use_id: r.id,
        content: r.contenido,
        is_error: r.error,
      })),
    };
  });
}

/** Adaptador de la API de Anthropic (Messages API con tool use). */
export class ModeloAnthropic implements ModeloAsistente {
  constructor(
    private readonly cliente: ClienteAnthropic | null,
    private readonly modelo: string,
  ) {}

  get disponible(): boolean {
    return this.cliente !== null;
  }

  async responder(pedido: PedidoModelo): Promise<RespuestaModelo> {
    if (!this.cliente) throw new ErrorModelo('El proveedor de IA no está configurado.');
    try {
      const respuesta = await this.cliente.messages.create({
        model: this.modelo,
        max_tokens: MAX_TOKENS_RESPUESTA,
        // Herramientas e instrucciones fijas van primero y se cachean; el contexto cambia.
        system: [
          { type: 'text', text: pedido.sistema, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: pedido.contexto },
        ],
        tools: pedido.herramientas.map((h) => ({
          name: h.nombre,
          description: h.descripcion,
          input_schema: h.esquema as Anthropic.Tool.InputSchema,
        })),
        tool_choice: pedido.permitirHerramientas ? { type: 'auto' } : { type: 'none' },
        messages: aMensajes(pedido.mensajes),
      });
      const bloques: BloqueModelo[] = [];
      for (const b of respuesta.content) {
        if (b.type === 'text' && b.text.trim() !== '') {
          bloques.push({ tipo: 'texto', texto: b.text });
        } else if (b.type === 'tool_use') {
          bloques.push({ tipo: 'herramienta', id: b.id, nombre: b.name, entrada: b.input });
        }
      }
      return {
        bloques,
        modelo: respuesta.model,
        tokensEntrada:
          respuesta.usage.input_tokens +
          (respuesta.usage.cache_creation_input_tokens ?? 0) +
          (respuesta.usage.cache_read_input_tokens ?? 0),
        tokensSalida: respuesta.usage.output_tokens,
      };
    } catch (err) {
      if (err instanceof ErrorModelo) throw err;
      const motivo =
        err instanceof Anthropic.APIConnectionTimeoutError
          ? 'tardó demasiado en responder'
          : err instanceof Anthropic.APIError && err.status !== undefined
            ? `respondió ${err.status}`
            : 'no respondió';
      throw new ErrorModelo(`El proveedor de IA ${motivo}.`, err);
    }
  }
}

/**
 * Doble para tests: responde lo que indica el guion, en orden, y registra lo que le piden.
 * Sin guion responde un texto fijo.
 */
export class ModeloFalso implements ModeloAsistente {
  disponible = true;
  /** true: simula al proveedor caído. */
  fallar = false;
  guion: (BloqueModelo[] | ((pedido: PedidoModelo) => BloqueModelo[]))[] = [];
  pedidos: PedidoModelo[] = [];

  reiniciar(): void {
    this.disponible = true;
    this.fallar = false;
    this.guion = [];
    this.pedidos = [];
  }

  async responder(pedido: PedidoModelo): Promise<RespuestaModelo> {
    // Copia: el servicio sigue agregando mensajes al mismo arreglo.
    this.pedidos.push({ ...pedido, mensajes: [...pedido.mensajes] });
    if (this.fallar) throw new ErrorModelo('El proveedor de IA respondió 500.');
    const paso = this.guion.shift();
    const bloques =
      paso === undefined
        ? [{ tipo: 'texto' as const, texto: 'Respuesta de prueba.' }]
        : typeof paso === 'function'
          ? paso(pedido)
          : paso;
    return { bloques, modelo: 'modelo-de-prueba', tokensEntrada: 100, tokensSalida: 20 };
  }
}

export const modeloProvider: Provider = {
  provide: MODELO_ASISTENTE,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): ModeloAsistente => {
    if (config.get('NODE_ENV', { infer: true }) === 'test') return new ModeloFalso();
    const apiKey = config.get('ANTHROPIC_API_KEY', { infer: true });
    const cliente = apiKey
      ? new Anthropic({ apiKey, timeout: TIEMPO_LIMITE_MS, maxRetries: 1 })
      : null;
    return new ModeloAnthropic(cliente, config.get('ANTHROPIC_MODEL', { infer: true }));
  },
};
