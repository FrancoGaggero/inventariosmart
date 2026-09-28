import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ASISTENTE_MAX_CONSULTAS,
  ASISTENTE_MAX_HISTORIAL,
  AccionAsistenteSchema,
  FuenteAsistenteSchema,
  HERRAMIENTAS_ASISTENTE,
  inicioDelDiaBuenosAires,
  tituloDeConversacion,
  type AccionAsistente,
  type Conversacion,
  type ConversacionDetalle,
  type ConversacionesQuery,
  type FuenteAsistente,
  type ListaConversaciones,
  type MensajeAsistente,
  type MensajeCreate,
  type RespuestaAsistente,
} from '@inventariosmart/shared';
import { z } from 'zod';
import { TenantContext } from '../auth/tenant-context';
import { codificarCursor, decodificarCursor } from '../common/cursor';
import { limiteAlcanzado, noEncontrado, servicioNoDisponible, validacion } from '../common/errors';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { HerramientasAsistente } from './herramientas';
import { INSTRUCCIONES_ASISTENTE, contextoAsistente } from './instrucciones';
import {
  ErrorModelo,
  MODELO_ASISTENTE,
  type MensajeModelo,
  type ModeloAsistente,
  type RespuestaModelo,
} from './modelo';

const DIA_MS = 24 * 60 * 60 * 1000;
const SIN_RESPUESTA = 'No pude armar una respuesta. Probá escribir la consulta de otra manera.';
const NO_DISPONIBLE =
  'El asistente no está disponible en este momento. Probá de nuevo en unos minutos.';
const MENSAJE_NO_ENCONTRADA = 'No encontramos esa conversación.';

interface FilaMensaje {
  id: string;
  rol: 'USUARIO' | 'ASISTENTE';
  contenido: string;
  fuentes: unknown;
  acciones: unknown;
  creadoEn: Date;
}

interface FilaConversacion {
  id: string;
  titulo: string;
  creadoEn: Date;
  actualizadoEn: Date;
}

const aMensaje = (m: FilaMensaje): MensajeAsistente => ({
  id: m.id,
  rol: m.rol,
  contenido: m.contenido,
  fuentes: z.array(FuenteAsistenteSchema).catch([]).parse(m.fuentes),
  acciones: z.array(AccionAsistenteSchema).catch([]).parse(m.acciones),
  creadoEn: m.creadoEn.toISOString(),
});

const aConversacion = (c: FilaConversacion): Conversacion => ({
  id: c.id,
  titulo: c.titulo,
  creadoEn: c.creadoEn.toISOString(),
  actualizadoEn: c.actualizadoEn.toISOString(),
});

const COLUMNAS_MENSAJE = {
  id: true,
  rol: true,
  contenido: true,
  fuentes: true,
  acciones: true,
  creadoEn: true,
} as const;

/**
 * Asistente conversacional (HU-08). El modelo sólo puede pedir las consultas de
 * `HerramientasAsistente`, que corren dentro del comercio del request (RNF-10), y nada se
 * guarda si el proveedor de IA no responde.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly herramientas: HerramientasAsistente,
    private readonly config: ConfigService<Env, true>,
    @Inject(MODELO_ASISTENTE) private readonly modelo: ModeloAsistente,
  ) {}

  async responder(dto: MensajeCreate): Promise<RespuestaAsistente> {
    const { comercioId, usuarioId } = TenantContext.requerido();
    const recibido = new Date();
    const limite = this.config.get('ASISTENTE_LIMITE_DIARIO', { infer: true });

    const { nombreComercio, historial } = await this.prisma.transaccionTenant(async (tx) => {
      if (dto.conversacionId) {
        const existe = await tx.conversacion.findFirst({
          where: { id: dto.conversacionId, comercioId, usuarioId },
          select: { id: true },
        });
        if (!existe) throw noEncontrado(MENSAJE_NO_ENCONTRADA);
      }
      const desde = inicioDelDiaBuenosAires(recibido);
      const enviados = await tx.mensajeAsistente.count({
        where: { comercioId, rol: 'USUARIO', creadoEn: { gte: desde } },
      });
      if (enviados >= limite) {
        throw limiteAlcanzado(
          `Llegaste al límite de ${limite} consultas por día al asistente. Se renueva mañana.`,
          { limite, renuevaEn: new Date(desde.getTime() + DIA_MS).toISOString() },
        );
      }
      const comercio = await tx.comercio.findFirst({
        where: { id: comercioId },
        select: { nombre: true },
      });
      const anteriores = dto.conversacionId
        ? await tx.mensajeAsistente.findMany({
            where: { comercioId, conversacionId: dto.conversacionId },
            orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
            take: ASISTENTE_MAX_HISTORIAL,
            select: { rol: true, contenido: true },
          })
        : [];
      return { nombreComercio: comercio?.nombre ?? '', historial: anteriores.reverse() };
    });

    if (!this.modelo.disponible) throw servicioNoDisponible(NO_DISPONIBLE);

    const mensajes: MensajeModelo[] = [
      ...historial.map((m): MensajeModelo =>
        m.rol === 'USUARIO'
          ? { rol: 'usuario', contenido: m.contenido }
          : { rol: 'asistente', bloques: [{ tipo: 'texto', texto: m.contenido }] },
      ),
      { rol: 'usuario', contenido: dto.mensaje },
    ];
    const { texto, fuentes, acciones, uso } = await this.conversar(
      mensajes,
      contextoAsistente(nombreComercio, recibido),
    );

    return this.prisma.transaccionTenant(async (tx) => {
      const respondido = new Date(Math.max(Date.now(), recibido.getTime() + 1));
      const conversacionId =
        dto.conversacionId ??
        (
          await tx.conversacion.create({
            data: {
              comercioId,
              usuarioId,
              titulo: tituloDeConversacion(dto.mensaje),
              creadoEn: recibido,
              actualizadoEn: respondido,
            },
            select: { id: true },
          })
        ).id;
      if (dto.conversacionId) {
        await tx.conversacion.update({
          where: { id: conversacionId },
          data: { actualizadoEn: respondido },
        });
      }
      await tx.mensajeAsistente.create({
        data: {
          comercioId,
          conversacionId,
          rol: 'USUARIO',
          contenido: dto.mensaje,
          creadoEn: recibido,
        },
      });
      const guardado = await tx.mensajeAsistente.create({
        data: {
          comercioId,
          conversacionId,
          rol: 'ASISTENTE',
          contenido: texto,
          fuentes,
          acciones,
          modelo: uso.modelo.slice(0, 80),
          tokensEntrada: uso.tokensEntrada,
          tokensSalida: uso.tokensSalida,
          creadoEn: respondido,
        },
        select: COLUMNAS_MENSAJE,
      });
      return { conversacionId, mensaje: aMensaje(guardado) };
    });
  }

  /** Ciclo de la respuesta (design D3): el modelo pide consultas hasta responder o llegar al tope. */
  private async conversar(mensajes: MensajeModelo[], contexto: string) {
    const definiciones = this.herramientas.definiciones();
    const fuentes = new Map<string, FuenteAsistente>();
    const acciones: AccionAsistente[] = [];
    const uso = { modelo: '', tokensEntrada: 0, tokensSalida: 0 };
    let consultas = 0;

    // Una vuelta más que el tope: la última es sin herramientas, para cerrar la respuesta.
    for (let vuelta = 0; vuelta <= ASISTENTE_MAX_CONSULTAS; vuelta += 1) {
      const permitirHerramientas = consultas < ASISTENTE_MAX_CONSULTAS;
      const respuesta = await this.pedir({
        sistema: INSTRUCCIONES_ASISTENTE,
        contexto,
        mensajes,
        herramientas: definiciones,
        permitirHerramientas,
      });
      uso.modelo = respuesta.modelo;
      uso.tokensEntrada += respuesta.tokensEntrada;
      uso.tokensSalida += respuesta.tokensSalida;

      const pedidos = respuesta.bloques.filter((b) => b.tipo === 'herramienta');
      if (pedidos.length === 0 || !permitirHerramientas) {
        const texto = respuesta.bloques
          .filter((b) => b.tipo === 'texto')
          .map((b) => b.texto.trim())
          .join('\n\n');
        return { texto: texto || SIN_RESPUESTA, fuentes: [...fuentes.values()], acciones, uso };
      }

      mensajes.push({ rol: 'asistente', bloques: respuesta.bloques });
      const resultados = [];
      for (const pedido of pedidos) {
        if (consultas >= ASISTENTE_MAX_CONSULTAS) {
          resultados.push({
            id: pedido.id,
            contenido: JSON.stringify({
              error: 'Se alcanzó el máximo de consultas para esta respuesta.',
            }),
            error: true,
          });
          continue;
        }
        consultas += 1;
        const r = await this.herramientas.ejecutar(pedido.nombre, pedido.entrada);
        if (!r.error && this.herramientas.esHerramienta(pedido.nombre)) {
          fuentes.set(pedido.nombre, {
            herramienta: pedido.nombre,
            nombre: HERRAMIENTAS_ASISTENTE[pedido.nombre],
          });
        }
        if (r.accion) acciones.push(r.accion);
        resultados.push({ id: pedido.id, contenido: r.contenido, error: r.error });
      }
      mensajes.push({ rol: 'resultados', resultados });
    }
    return { texto: SIN_RESPUESTA, fuentes: [...fuentes.values()], acciones, uso };
  }

  private async pedir(
    pedido: Parameters<ModeloAsistente['responder']>[0],
  ): Promise<RespuestaModelo> {
    try {
      return await this.modelo.responder(pedido);
    } catch (err) {
      if (err instanceof ErrorModelo) {
        this.logger.warn({ err: err.causa ?? err }, err.message);
        throw servicioNoDisponible(NO_DISPONIBLE);
      }
      throw err;
    }
  }

  /** Conversaciones del usuario, de la más reciente a la más antigua. */
  async listar(q: ConversacionesQuery): Promise<ListaConversaciones> {
    const { comercioId, usuarioId } = TenantContext.requerido();
    const cursor = q.cursor ? this.cursorDe(q.cursor) : null;
    const filas = await this.prisma.transaccionTenant((tx) =>
      tx.conversacion.findMany({
        where: {
          comercioId,
          usuarioId,
          ...(cursor
            ? {
                OR: [
                  { actualizadoEn: { lt: cursor.fecha } },
                  { actualizadoEn: cursor.fecha, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ actualizadoEn: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
        select: { id: true, titulo: true, creadoEn: true, actualizadoEn: true },
      }),
    );
    const pagina = filas.slice(0, q.limit);
    const ultima = pagina.at(-1);
    return {
      items: pagina.map(aConversacion),
      siguienteCursor:
        filas.length > q.limit && ultima
          ? codificarCursor([ultima.actualizadoEn.toISOString(), ultima.id])
          : null,
    };
  }

  async obtener(id: string): Promise<ConversacionDetalle> {
    const { comercioId, usuarioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const conversacion = await tx.conversacion.findFirst({
        where: { id, comercioId, usuarioId },
        select: { id: true, titulo: true, creadoEn: true, actualizadoEn: true },
      });
      if (!conversacion) throw noEncontrado(MENSAJE_NO_ENCONTRADA);
      const mensajes = await tx.mensajeAsistente.findMany({
        where: { comercioId, conversacionId: id },
        orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
        select: COLUMNAS_MENSAJE,
      });
      return { ...aConversacion(conversacion), mensajes: mensajes.map(aMensaje) };
    });
  }

  private cursorDe(cursor: string): { fecha: Date; id: string } {
    const [iso, id] = decodificarCursor(cursor, 2) as [string, string];
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime()) || !z.uuid().safeParse(id).success) {
      throw validacion('El cursor de paginación no es válido.', { cursor: 'Cursor inválido.' });
    }
    return { fecha, id };
  }
}
