import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SerieIndicador } from '@inventariosmart/shared';
import { z } from 'zod';
import type { Env } from '../config/env';

/** Un dato de una serie oficial. */
export interface LecturaIndicador {
  serie: SerieIndicador;
  /** Día del dato (YYYY-MM-DD); en las series mensuales del INDEC, el primer día del mes. */
  fecha: string;
  valor: number;
}

/** La fuente no respondió, respondió con error o cambió la forma de la respuesta. */
export class ErrorFuente extends Error {
  constructor(
    readonly fuente: string,
    mensaje: string,
  ) {
    super(`${fuente}: ${mensaje}`);
    this.name = 'ErrorFuente';
  }
}

/**
 * Fuente pública de indicadores (design D3). `FuenteIndec` y `FuenteBcra` en desarrollo y
 * producción; `FuenteFalsa` en tests, que no dependen de la red.
 */
export abstract class FuenteIndicadores {
  abstract readonly nombre: string;
  /** Datos con fecha igual o posterior a `desde`. Lanza `ErrorFuente` si no puede leerlos. */
  abstract leer(desde: Date): Promise<LecturaIndicador[]>;
}

export const TIMEOUT_FUENTE_MS = 10_000;
const DIA_MS = 24 * 60 * 60 * 1000;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const dia = (d: Date) => d.toISOString().slice(0, 10);

async function pedirJson(fuente: string, url: string): Promise<unknown> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_FUENTE_MS),
    });
  } catch (err) {
    // El corte por tiempo llega como DOMException, que no siempre es instancia de Error.
    const nombre = (err as { name?: string } | null)?.name;
    const motivo = nombre === 'TimeoutError' ? 'no respondió a tiempo' : 'no se pudo conectar';
    throw new ErrorFuente(fuente, motivo);
  }
  if (!respuesta.ok) throw new ErrorFuente(fuente, `respondió ${respuesta.status}`);
  try {
    return await respuesta.json();
  } catch {
    throw new ErrorFuente(fuente, 'la respuesta no es JSON');
  }
}

function validar<T>(fuente: string, esquema: z.ZodType<T>, cuerpo: unknown): T {
  const r = esquema.safeParse(cuerpo);
  if (!r.success) throw new ErrorFuente(fuente, 'la respuesta no tiene la forma esperada');
  return r.data;
}

// --- INDEC (API de Series de Tiempo de datos.gob.ar) ------------------------------------------

/** IPC nacional, base diciembre 2016: nivel general y bienes. */
export const SERIES_INDEC = ['148.3_INIVELNAL_DICI_M_26', '147.3_IBIENESNAL_DICI_T_19'] as const;

const RespuestaIndecSchema = z.object({
  data: z.array(z.tuple([z.string().regex(FECHA), z.number().nullable(), z.number().nullable()])),
});

export class FuenteIndec extends FuenteIndicadores {
  readonly nombre = 'INDEC';

  constructor(private readonly base: string) {
    super();
  }

  async leer(desde: Date): Promise<LecturaIndicador[]> {
    const inicio = `${dia(desde).slice(0, 7)}-01`;
    const url = `${this.base}/series/?ids=${SERIES_INDEC.join(',')}&start_date=${inicio}&format=json&metadata=none&limit=1000`;
    const { data } = validar(this.nombre, RespuestaIndecSchema, await pedirJson(this.nombre, url));
    const lecturas: LecturaIndicador[] = [];
    for (const [fecha, general, bienes] of data) {
      if (general !== null) lecturas.push({ serie: 'IPC_GENERAL', fecha, valor: general });
      if (bienes !== null) lecturas.push({ serie: 'IPC_BIENES', fecha, valor: bienes });
    }
    return lecturas;
  }
}

// --- BCRA (estadísticas monetarias v4.0) ------------------------------------------------------

/** Variables del BCRA y desde cuántos días atrás se piden (el dólar es diario: alcanza un mes). */
export const VARIABLES_BCRA: { id: number; serie: SerieIndicador; dias: number | null }[] = [
  { id: 27, serie: 'INFLACION_MENSUAL', dias: null },
  { id: 28, serie: 'INFLACION_INTERANUAL', dias: null },
  { id: 4, serie: 'USD_MINORISTA', dias: 30 },
];

const RespuestaBcraSchema = z.object({
  results: z.array(
    z.object({
      idVariable: z.number(),
      detalle: z.array(z.object({ fecha: z.string().regex(FECHA), valor: z.number() })),
    }),
  ),
});

export class FuenteBcra extends FuenteIndicadores {
  readonly nombre = 'BCRA';

  constructor(private readonly base: string) {
    super();
  }

  async leer(desde: Date): Promise<LecturaIndicador[]> {
    const hoy = new Date();
    const partes = await Promise.all(
      VARIABLES_BCRA.map(async (v) => {
        const inicio = v.dias === null ? desde : new Date(hoy.getTime() - v.dias * DIA_MS);
        const url = `${this.base}/monetarias/${v.id}?desde=${dia(inicio)}&hasta=${dia(hoy)}&limit=1000`;
        const { results } = validar(
          this.nombre,
          RespuestaBcraSchema,
          await pedirJson(this.nombre, url),
        );
        return results
          .filter((r) => r.idVariable === v.id)
          .flatMap((r) => r.detalle)
          .map((d): LecturaIndicador => ({ serie: v.serie, fecha: d.fecha, valor: d.valor }));
      }),
    );
    return partes.flat();
  }
}

// --- Doble para tests -------------------------------------------------------------------------

export class FuenteFalsa extends FuenteIndicadores {
  readonly nombre = 'PRUEBA';
  lecturas: LecturaIndicador[] = [];
  llamadas = 0;
  /** true: simula una fuente caída. */
  fallar = false;

  async leer(desde: Date): Promise<LecturaIndicador[]> {
    this.llamadas += 1;
    if (this.fallar) throw new ErrorFuente(this.nombre, 'respondió 500');
    return this.lecturas.filter((l) => l.fecha >= dia(desde).slice(0, 7));
  }
}

export const FUENTES_INDICADORES = Symbol('FUENTES_INDICADORES');

export const fuentesProvider: Provider = {
  provide: FUENTES_INDICADORES,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): FuenteIndicadores[] => {
    if (config.get('NODE_ENV', { infer: true }) === 'test') return [new FuenteFalsa()];
    return [
      new FuenteIndec(config.get('INDEC_API_URL', { infer: true })),
      new FuenteBcra(config.get('BCRA_API_URL', { infer: true })),
    ];
  },
};
