import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Indicadores, IndicadorValor, Mes, SerieIndicador } from '@inventariosmart/shared';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';
import { FUENTES_INDICADORES, type FuenteIndicadores, type LecturaIndicador } from './fuentes';

const HORA_MS = 60 * 60 * 1000;
/** Un dato vence a las 24 horas: recién entonces se vuelve a consultar la fuente (design D4). */
export const VIGENCIA_MS = 24 * HORA_MS;
/** Pasadas 48 horas sin una consulta exitosa, el dato se informa como desactualizado. */
export const TOLERANCIA_MS = 48 * HORA_MS;
/** Tras una falla no se insiste en cada pedido: se espera antes de reintentar. */
export const REINTENTO_MS = 15 * 60 * 1000;
/** Historia que se pide a las fuentes: cubre los 24 meses de la comparación más la base. */
export const MESES_HISTORIA = 25;
const CANDADO_ACTUALIZACION = 150915;

/** Organismo que publica cada serie: es lo que se cita junto al dato. */
export const FUENTE_DE_SERIE: Record<SerieIndicador, string> = {
  IPC_GENERAL: 'INDEC',
  IPC_BIENES: 'INDEC',
  INFLACION_MENSUAL: 'BCRA',
  INFLACION_INTERANUAL: 'BCRA',
  USD_MINORISTA: 'BCRA',
};

interface EstadoFuente {
  fuente: string;
  actualizadoEn: Date | null;
  intentadoEn: Date | null;
  ultimoError: string | null;
}

interface UltimoValor {
  serie: SerieIndicador;
  fecha: string;
  valor: string;
  fuente: string;
}

/**
 * Indicadores económicos oficiales (HU-15, RNF-08). Se guardan en una tabla de referencia y se
 * sirven desde ahí: las fuentes se consultan una vez por día y, si fallan, queda el último dato.
 */
@Injectable()
export class IndicatorsService {
  private readonly logger = new Logger(IndicatorsService.name);
  private enCurso: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FUENTES_INDICADORES) private readonly fuentes: FuenteIndicadores[],
  ) {}

  /** Consulta las fuentes cuyo dato venció. Nunca lanza: ante una falla queda lo guardado. */
  async actualizarSiVence(ahora = new Date()): Promise<void> {
    return this.actualizar(false, ahora);
  }

  /** `forzar` ignora la vigencia (job diario). */
  async actualizar(forzar: boolean, ahora = new Date()): Promise<void> {
    if (this.enCurso) return this.enCurso;
    this.enCurso = this.consultar(forzar, ahora)
      .catch((err: unknown) => {
        this.logger.warn({ err }, 'No se pudieron actualizar los indicadores');
      })
      .finally(() => {
        this.enCurso = null;
      });
    return this.enCurso;
  }

  private async consultar(forzar: boolean, ahora: Date): Promise<void> {
    const estados = new Map((await this.estados()).map((e) => [e.fuente, e]));
    const pendientes = this.fuentes.filter((f) => {
      if (forzar) return true;
      const e = estados.get(f.nombre);
      if (!e) return true;
      const falloReciente =
        e.ultimoError !== null &&
        e.intentadoEn !== null &&
        ahora.getTime() - e.intentadoEn.getTime() < REINTENTO_MS;
      if (falloReciente) return false;
      return (
        e.ultimoError !== null ||
        e.actualizadoEn === null ||
        ahora.getTime() - e.actualizadoEn.getTime() > VIGENCIA_MS
      );
    });
    if (pendientes.length === 0) return;

    const desde = new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - MESES_HISTORIA, 1),
    );
    // Las fuentes se consultan fuera de la transacción: pueden tardar hasta el tiempo de corte.
    const resultados = await Promise.all(
      pendientes.map(async (f) => {
        try {
          return { fuente: f.nombre, lecturas: await f.leer(desde), error: null };
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Error desconocido';
          this.logger.warn({ fuente: f.nombre, error }, 'La fuente de indicadores no respondió');
          return { fuente: f.nombre, lecturas: [] as LecturaIndicador[], error };
        }
      }),
    );

    await this.prisma.comoSistema(async (tx) => {
      const [candado] = await tx.$queryRaw<{ tomado: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${CANDADO_ACTUALIZACION}) AS tomado`;
      // Otra instancia está escribiendo los mismos datos.
      if (!candado?.tomado) return;
      for (const r of resultados) {
        if (r.error === null) {
          const unicas = [...new Map(r.lecturas.map((l) => [`${l.serie}|${l.fecha}`, l])).values()];
          if (unicas.length > 0) {
            await tx.$executeRaw`
              INSERT INTO indicador_economico (id, serie, fecha, valor, fuente)
              SELECT gen_random_uuid(), v.serie::serie_indicador, v.fecha::date, v.valor::numeric, v.fuente
              FROM unnest(
                ${unicas.map((l) => l.serie)}::text[],
                ${unicas.map((l) => l.fecha)}::text[],
                ${unicas.map((l) => String(l.valor))}::text[],
                ${unicas.map((l) => FUENTE_DE_SERIE[l.serie])}::text[]
              ) AS v(serie, fecha, valor, fuente)
              ON CONFLICT (serie, fecha) DO UPDATE
                SET valor = EXCLUDED.valor, fuente = EXCLUDED.fuente, actualizado_en = now()`;
          }
        }
        await tx.indicadorActualizacion.upsert({
          where: { fuente: r.fuente },
          create: {
            fuente: r.fuente,
            actualizadoEn: r.error === null ? ahora : null,
            intentadoEn: ahora,
            ultimoError: r.error?.slice(0, 300) ?? null,
          },
          update: {
            ...(r.error === null ? { actualizadoEn: ahora } : {}),
            intentadoEn: ahora,
            ultimoError: r.error?.slice(0, 300) ?? null,
          },
        });
      }
    });
  }

  /**
   * Las tablas de indicadores no son de ningún comercio: se leen en contexto de sistema, que
   * también sirve al job diario (corre sin request ni comercio).
   */
  private estados(tx?: TransaccionRaw): Promise<EstadoFuente[]> {
    const leer = (t: TransaccionRaw) =>
      t.indicadorActualizacion.findMany({
        where: { fuente: { in: this.fuentes.map((f) => f.nombre) } },
      });
    return tx ? leer(tx) : this.prisma.comoSistema(leer);
  }

  /** Última actualización completa y si el dato debe mostrarse como desactualizado. */
  async vigencia(
    ahora = new Date(),
    tx?: TransaccionRaw,
  ): Promise<{ actualizadoEn: Date | null; desactualizado: boolean }> {
    const estados = await this.estados(tx);
    const exitosas = estados.flatMap((e) => (e.actualizadoEn ? [e.actualizadoEn.getTime()] : []));
    const actualizadoEn = exitosas.length > 0 ? new Date(Math.min(...exitosas)) : null;
    const desactualizado =
      estados.length < this.fuentes.length ||
      estados.some(
        (e) =>
          e.ultimoError !== null ||
          e.actualizadoEn === null ||
          ahora.getTime() - e.actualizadoEn.getTime() > TOLERANCIA_MS,
      );
    return { actualizadoEn, desactualizado };
  }

  /** Últimos valores de cada serie (GET /indicators). */
  async obtener(): Promise<Indicadores> {
    await this.actualizarSiVence();
    const { filas, actualizadoEn, desactualizado } = await this.prisma.comoSistema(async (tx) => ({
      filas: await tx.$queryRaw<UltimoValor[]>`
        SELECT DISTINCT ON (serie) serie::text AS serie, fecha::text AS fecha,
               valor::text AS valor, fuente
        FROM indicador_economico
        ORDER BY serie, fecha DESC`,
      ...(await this.vigencia(new Date(), tx)),
    }));
    const porSerie = new Map(filas.map((f) => [f.serie, f]));
    const valor = (serie: SerieIndicador): IndicadorValor | null => {
      const f = porSerie.get(serie);
      return f ? { valor: Number(f.valor).toFixed(2), fecha: f.fecha, fuente: f.fuente } : null;
    };
    const ipc = porSerie.get('IPC_GENERAL');
    return {
      inflacionMensual: valor('INFLACION_MENSUAL'),
      inflacionInteranual: valor('INFLACION_INTERANUAL'),
      dolarMinorista: valor('USD_MINORISTA'),
      ipc: ipc
        ? {
            valor: Number(ipc.valor).toFixed(2),
            periodo: ipc.fecha.slice(0, 7),
            fuente: ipc.fuente,
          }
        : null,
      actualizadoEn: actualizadoEn?.toISOString() ?? null,
      desactualizado,
    };
  }

  /**
   * IPC mensual guardado (nivel general y bienes) y último mes publicado, en una sola consulta:
   * son a lo sumo dos filas por mes.
   */
  async ipcMensual(): Promise<IpcMensual> {
    const filas = await this.prisma.comoSistema(
      (tx) => tx.$queryRaw<{ serie: 'IPC_GENERAL' | 'IPC_BIENES'; mes: string; valor: string }[]>`
        SELECT serie::text AS serie, to_char(fecha, 'YYYY-MM') AS mes, valor::text AS valor
        FROM indicador_economico
        WHERE serie IN ('IPC_GENERAL', 'IPC_BIENES')
        ORDER BY fecha`,
    );
    const general = new Map<Mes, number>();
    const bienes = new Map<Mes, number>();
    for (const f of filas)
      (f.serie === 'IPC_GENERAL' ? general : bienes).set(f.mes, Number(f.valor));
    return { ultimoMes: [...general.keys()].at(-1) ?? null, general, bienes };
  }
}

export interface IpcMensual {
  /** Último mes con IPC general publicado, o null si todavía no hay datos. */
  ultimoMes: Mes | null;
  general: Map<Mes, number>;
  bienes: Map<Mes, number>;
}
