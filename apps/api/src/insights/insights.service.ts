import { Injectable } from '@nestjs/common';
import {
  cierreDeMes,
  compararProducto,
  indiceBase100,
  inicioDeMes,
  listaMeses,
  mesDe,
  mesesEntre,
  MESES_DEFAULT,
  MESES_MAX,
  ordenarPorAtraso,
  sumarMeses,
  valorCanasta,
  variacionReal,
  variacionSerie,
  type ComparacionInflacion,
  type InflacionQuery,
  type Mes,
  type MotivoComparacion,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { validacion } from '../common/errors';
import { Prisma } from '../generated/prisma/client';
import { IndicatorsService } from '../indicators/indicators.service';
import { PrismaService } from '../prisma/prisma.service';

/** Fila por producto activo: unidades del período y precio y costo al cierre de cada mes. */
interface FilaComparacion {
  id: string;
  codigo: string;
  nombre: string;
  unidades: number;
  datosDesde: Date;
  precios: string[];
  costos: string[];
}

/** Precios y costos propios frente a la inflación (HU-15, RF-16; RN-01, RN-08, RN-11). */
@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly indicators: IndicatorsService,
  ) {}

  async inflacion(q: InflacionQuery): Promise<ComparacionInflacion> {
    await this.indicators.actualizarSiVence();
    const ipc = await this.indicators.ipcMensual();
    const { desde, hasta, recortado } = this.periodo(q, ipc.ultimoMes);
    const meses = listaMeses(desde, hasta);
    const filas = await this.filas(meses);

    // Canasta fija: los productos con ventas en el período, ponderados por sus unidades (design D6).
    const canasta = filas.filter((f) => f.unidades > 0);
    const indice = (valorDe: (f: FilaComparacion, i: number) => string) =>
      canasta.length === 0
        ? []
        : indiceBase100(meses.map((_, i) => valorCanasta(canasta, (f) => valorDe(f, i))));
    const series = {
      misPrecios: indice((f, i) => f.precios[i]!),
      misCostos: indice((f, i) => f.costos[i]!),
      ipc: indiceBase100(meses.map((m) => ipc.general.get(m) ?? null)),
      ipcBienes: indiceBase100(meses.map((m) => ipc.bienes.get(m) ?? null)),
    };
    const variaciones = {
      misPrecios: variacionSerie(series.misPrecios),
      misCostos: variacionSerie(series.misCostos),
      ipc: this.variacionCompleta(series.ipc),
      ipcBienes: this.variacionCompleta(series.ipcBienes),
    };

    const ultimo = meses.length - 1;
    const productos = ordenarPorAtraso(
      filas.map((f) =>
        compararProducto(
          {
            producto: { id: f.id, codigo: f.codigo, nombre: f.nombre },
            unidades: f.unidades,
            precioInicial: f.precios[0]!,
            precioFinal: f.precios[ultimo]!,
            costoInicial: f.costos[0]!,
            costoFinal: f.costos[ultimo]!,
            datosDesde: f.datosDesde.toISOString(),
          },
          variaciones.ipc,
        ),
      ),
    );

    let motivo: MotivoComparacion | null = null;
    if (canasta.length === 0) motivo = 'SIN_VENTAS';
    else if (series.ipc.every((v) => v === null)) motivo = 'SIN_IPC';

    return {
      desde,
      hasta,
      recortado,
      meses,
      series,
      variaciones,
      brechas: {
        preciosVsIpc: variacionReal(variaciones.misPrecios, variaciones.ipc),
        preciosVsCostos: variacionReal(variaciones.misPrecios, variaciones.misCostos),
      },
      motivo,
      productos,
    };
  }

  /** La variación del IPC sólo vale si hay dato del primer y del último mes del período. */
  private variacionCompleta(serie: (string | null)[]): string | null {
    if (serie[0] === null || serie[serie.length - 1] === null) return null;
    return variacionSerie(serie);
  }

  /**
   * Período de la comparación: llega hasta el último mes con IPC publicado (se publica con un
   * mes de rezago) y, por defecto, cubre los últimos seis meses.
   */
  private periodo(
    q: InflacionQuery,
    ultimoIpc: Mes | null,
  ): { desde: Mes; hasta: Mes; recortado: boolean } {
    const tope = ultimoIpc ?? sumarMeses(mesDe(new Date()), -1);
    let hasta = q.hasta ?? tope;
    let recortado = false;
    if (hasta > tope) {
      hasta = tope;
      recortado = true;
    }
    let desde = q.desde ?? sumarMeses(hasta, -(MESES_DEFAULT - 1));
    if (desde > hasta) {
      desde = hasta;
      recortado = true;
    }
    if (mesesEntre(desde, hasta) + 1 > MESES_MAX) {
      throw validacion(`El período no puede superar los ${MESES_MAX} meses.`, {
        desde: `El período no puede superar los ${MESES_MAX} meses.`,
      });
    }
    return { desde, hasta, recortado };
  }

  private filas(meses: Mes[]): Promise<FilaComparacion[]> {
    const { comercioId } = TenantContext.requerido();
    const desde = inicioDeMes(meses[0]!);
    const hasta = cierreDeMes(meses[meses.length - 1]!);
    const cierres = meses.map((m) => cierreDeMes(m).toISOString());
    return this.prisma.transaccionTenant(async (tx) => {
      // Las unidades vendidas van en su propia consulta: unidas a los productos, el plan dependía
      // de las estadísticas y, con tablas recién cargadas, recalculaba la suma por cada producto.
      const ventas = await tx.$queryRaw<{ productoId: string; unidades: number }[]>`
        SELECT m.producto_id AS "productoId", SUM(m.cantidad)::int AS unidades
        FROM movimiento m
        WHERE m.comercio_id = ${comercioId}::uuid AND m.tipo = 'VENTA'
          AND m.anulado_por_id IS NULL
          AND m.fecha >= ${desde} AND m.fecha < ${hasta}
        GROUP BY m.producto_id`;
      const unidadesDe = new Map(ventas.map((v) => [v.productoId, v.unidades]));
      // El precio y el costo de cada cierre se buscan por índice; sin esto, con estadísticas
      // viejas el planificador puede recorrer la tabla entera en cada búsqueda.
      await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
      const filas = await tx.$queryRaw<Omit<FilaComparacion, 'unidades'>[]>(Prisma.sql`
        WITH prod AS MATERIALIZED (
          SELECT p.id, p.codigo, p.nombre, p.precio_venta, p.costo_reposicion,
                 p.proveedor_principal_id,
                 COALESCE(
                   (SELECT min(h.vigente_desde) FROM precio_venta_historial h
                     WHERE h.comercio_id = ${comercioId}::uuid AND h.producto_id = p.id),
                   p.creado_en
                 ) AS datos_desde
          FROM producto p
          WHERE p.comercio_id = ${comercioId}::uuid AND p.activo
        ),
        cierres AS (
          SELECT u.t::timestamptz AS cierre, u.n
          FROM unnest(${cierres}::text[]) WITH ORDINALITY AS u(t, n)
        )
        SELECT prod.id, prod.codigo, prod.nombre,
               prod.datos_desde AS "datosDesde",
               array_agg(COALESCE(
                 (SELECT h.precio_venta FROM precio_venta_historial h
                   WHERE h.comercio_id = ${comercioId}::uuid AND h.producto_id = prod.id
                     AND h.vigente_desde < c.cierre
                   ORDER BY h.vigente_desde DESC, h.id DESC LIMIT 1),
                 (SELECT h.precio_venta FROM precio_venta_historial h
                   WHERE h.comercio_id = ${comercioId}::uuid AND h.producto_id = prod.id
                   ORDER BY h.vigente_desde ASC, h.id ASC LIMIT 1),
                 prod.precio_venta
               )::text ORDER BY c.n) AS precios,
               array_agg(CASE WHEN prod.proveedor_principal_id IS NULL THEN prod.costo_reposicion
               ELSE COALESCE(
                 (SELECT pp.costo_neto FROM precio_proveedor pp
                   WHERE pp.comercio_id = ${comercioId}::uuid
                     AND pp.proveedor_id = prod.proveedor_principal_id
                     AND pp.producto_id = prod.id AND pp.vigente_desde < c.cierre
                   ORDER BY pp.vigente_desde DESC, pp.creado_en DESC LIMIT 1),
                 (SELECT pp.costo_neto FROM precio_proveedor pp
                   WHERE pp.comercio_id = ${comercioId}::uuid
                     AND pp.proveedor_id = prod.proveedor_principal_id
                     AND pp.producto_id = prod.id
                   ORDER BY pp.vigente_desde ASC, pp.creado_en ASC LIMIT 1),
                 prod.costo_reposicion
               ) END::text ORDER BY c.n) AS costos
        FROM prod CROSS JOIN cierres c
        GROUP BY prod.id, prod.codigo, prod.nombre, prod.datos_desde
      `);
      return filas.map((f) => ({ ...f, unidades: unidadesDe.get(f.id) ?? 0 }));
    });
  }
}
