import Anthropic from '@anthropic-ai/sdk';
import {
  type ClienteAnthropic,
  ErrorModelo,
  MAX_TOKENS_RESPUESTA,
  ModeloAnthropic,
  ModeloFalso,
  type PedidoModelo,
} from './modelo';

const pedido = (extra: Partial<PedidoModelo> = {}): PedidoModelo => ({
  sistema: 'Instrucciones fijas.',
  contexto: 'Hoy es 2026-10-02.',
  mensajes: [{ rol: 'usuario', contenido: '¿Qué tengo que reponer?' }],
  herramientas: [
    {
      nombre: 'alertas_de_reposicion',
      descripcion: 'Alertas activas.',
      esquema: { type: 'object', properties: {} },
    },
  ],
  permitirHerramientas: true,
  ...extra,
});

const respuestaSdk = (content: unknown[]) => ({
  model: 'claude-sonnet-5',
  content,
  usage: {
    input_tokens: 40,
    output_tokens: 12,
    cache_creation_input_tokens: 300,
    cache_read_input_tokens: null,
  },
});

function clienteCon(create: jest.Mock): ClienteAnthropic {
  return { messages: { create } } as unknown as ClienteAnthropic;
}

describe('ModeloAnthropic', () => {
  it('arma el pedido con las instrucciones cacheables, las herramientas y los mensajes', async () => {
    const create = jest
      .fn()
      .mockResolvedValue(respuestaSdk([{ type: 'text', text: 'Tenés 2 alertas.' }]));
    const modelo = new ModeloAnthropic(clienteCon(create), 'claude-sonnet-5');
    expect(modelo.disponible).toBe(true);

    const r = await modelo.responder(
      pedido({
        mensajes: [
          { rol: 'usuario', contenido: '¿Qué tengo que reponer?' },
          {
            rol: 'asistente',
            bloques: [
              { tipo: 'texto', texto: 'Consulto las alertas.' },
              { tipo: 'herramienta', id: 'h1', nombre: 'alertas_de_reposicion', entrada: {} },
            ],
          },
          {
            rol: 'resultados',
            resultados: [{ id: 'h1', contenido: '{"activas":2}', error: false }],
          },
        ],
      }),
    );

    expect(create).toHaveBeenCalledWith({
      model: 'claude-sonnet-5',
      max_tokens: MAX_TOKENS_RESPUESTA,
      system: [
        { type: 'text', text: 'Instrucciones fijas.', cache_control: { type: 'ephemeral' } },
        { type: 'text', text: 'Hoy es 2026-10-02.' },
      ],
      tools: [
        {
          name: 'alertas_de_reposicion',
          description: 'Alertas activas.',
          input_schema: { type: 'object', properties: {} },
        },
      ],
      tool_choice: { type: 'auto' },
      messages: [
        { role: 'user', content: '¿Qué tengo que reponer?' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Consulto las alertas.' },
            { type: 'tool_use', id: 'h1', name: 'alertas_de_reposicion', input: {} },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'h1', content: '{"activas":2}', is_error: false },
          ],
        },
      ],
    });
    expect(r).toEqual({
      bloques: [{ tipo: 'texto', texto: 'Tenés 2 alertas.' }],
      modelo: 'claude-sonnet-5',
      tokensEntrada: 340,
      tokensSalida: 12,
    });
  });

  it('devuelve los pedidos de herramienta y descarta el texto vacío', async () => {
    const create = jest.fn().mockResolvedValue(
      respuestaSdk([
        { type: 'text', text: '  ' },
        { type: 'tool_use', id: 'h9', name: 'buscar_productos', input: { q: 'filtro' } },
      ]),
    );
    const r = await new ModeloAnthropic(clienteCon(create), 'm').responder(pedido());
    expect(r.bloques).toEqual([
      { tipo: 'herramienta', id: 'h9', nombre: 'buscar_productos', entrada: { q: 'filtro' } },
    ]);
  });

  it('sin herramientas permitidas le pide al modelo que responda con lo que tiene', async () => {
    const create = jest.fn().mockResolvedValue(respuestaSdk([{ type: 'text', text: 'Listo.' }]));
    await new ModeloAnthropic(clienteCon(create), 'm').responder(
      pedido({ permitirHerramientas: false }),
    );
    expect(create.mock.calls[0][0].tool_choice).toEqual({ type: 'none' });
  });

  it('sin clave no está disponible y no intenta llamar', async () => {
    const modelo = new ModeloAnthropic(null, 'm');
    expect(modelo.disponible).toBe(false);
    await expect(modelo.responder(pedido())).rejects.toThrow(ErrorModelo);
  });

  it('convierte el tiempo límite y los errores del proveedor en ErrorModelo', async () => {
    const tiempo = jest.fn().mockRejectedValue(new Anthropic.APIConnectionTimeoutError());
    await expect(new ModeloAnthropic(clienteCon(tiempo), 'm').responder(pedido())).rejects.toThrow(
      /tardó demasiado/,
    );

    const saturado = jest
      .fn()
      .mockRejectedValue(new Anthropic.APIError(529, undefined, 'overloaded', new Headers()));
    await expect(
      new ModeloAnthropic(clienteCon(saturado), 'm').responder(pedido()),
    ).rejects.toThrow(/respondió 529/);

    const caido = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const error = await new ModeloAnthropic(clienteCon(caido), 'm')
      .responder(pedido())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorModelo);
    expect((error as ErrorModelo).message).toMatch(/no respondió/);
  });
});

describe('ModeloFalso', () => {
  it('sigue el guion en orden, registra los pedidos y después responde un texto fijo', async () => {
    const modelo = new ModeloFalso();
    modelo.guion = [
      [{ tipo: 'herramienta', id: 'h1', nombre: 'buscar_productos', entrada: {} }],
      (p) => [{ tipo: 'texto', texto: `Recibí ${p.mensajes.length} mensajes.` }],
    ];
    expect((await modelo.responder(pedido())).bloques[0]).toMatchObject({ tipo: 'herramienta' });
    expect((await modelo.responder(pedido())).bloques).toEqual([
      { tipo: 'texto', texto: 'Recibí 1 mensajes.' },
    ]);
    expect((await modelo.responder(pedido())).bloques).toEqual([
      { tipo: 'texto', texto: 'Respuesta de prueba.' },
    ]);
    expect(modelo.pedidos).toHaveLength(3);
  });

  it('simula al proveedor caído', async () => {
    const modelo = new ModeloFalso();
    modelo.fallar = true;
    await expect(modelo.responder(pedido())).rejects.toThrow(ErrorModelo);
    modelo.reiniciar();
    await expect(modelo.responder(pedido())).resolves.toBeDefined();
  });
});
