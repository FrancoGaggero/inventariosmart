import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AjustesReportes,
  type AjustesReportesPatch,
  type ContenidoReporte,
  ContenidoReporteSchema,
  type FilaOportunidad,
  type ListaReportes,
  MAX_ESTRELLAS,
  type MotivoNoEnvioReporte,
  type ReporteResumen,
  type ReporteSemanal,
  type ReportesQuery,
  type Semana,
  VENTANA_ROTACION_DIAS,
  capitalInmovilizado,
  margenBajo,
  mesDeSemana,
  oportunidadesCompra,
  rangoSemana,
  semanaAnterior,
  semanaDe,
  ultimaSemanaCerrada,
  variacionPct,
} from '@inventariosmart/shared';
import { Mailer } from '../alerts/mailer';
import { TenantContext } from '../auth/tenant-context';
import { noEncontrado } from '../common/errors';
import type { Env } from '../config/env';
import type { Prisma, ReporteSemanal as ReporteRow } from '../generated/prisma/client';
import { ProfitabilityService } from '../profitability/profitability.service';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';
import { armarSemanal } from './plantillas/semanal';

/** Fila por producto activo para las oportunidades (design D3). */
interface FilaProducto {
  id: string;
  codigo: string;
  nombre: string;
  stock: number;
  costoActual: string;
  precioNeto: string;
  proveedorActualId: string | null;
  proveedorActualNombre: string | null;
  costoMinimoOtro: string | null;
  proveedorMinimoId: string | null;
  proveedorMinimoNombre: string | null;
  unidades30d: number;
  unidadesSemana: number;
  ventasNetasSemana: string;
}

interface FilaCritica {
  productoId: string;
  codigo: string;
  nombre: string;
  stock: number;
  diasCobertura: number | null;
  cantidadSugerida: number;
}

export type ModoEnvio = 'siempre' | 'siNoEnviado' | 'nunca';

const MENSAJE_NO_ENCONTRADO = 'No encontramos ese reporte en tu comercio.';

function aReporte(r: ReporteRow): ReporteSemanal {
  return {
    id: r.id,
    semana: r.semana,
    desde: r.desde.toISOString(),
    hasta: r.hasta.toISOString(),
    contenido: ContenidoReporteSchema.parse(r.contenido),
    destinatarios: r.destinatarios,
    enviadoEn: r.enviadoEn?.toISOString() ?? null,
    motivoNoEnvio: r.motivoNoEnvio,
    generadoEn: r.generadoEn.toISOString(),
  };
}

function aResumen(r: ReporteRow): ReporteResumen {
  const c = ContenidoReporteSchema.parse(r.contenido);
  const conOportunidad = new Set([
    ...c.oportunidades.comprarMasBarato.items.map((i) => i.producto.id),
    ...c.oportunidades.capitalInmovilizado.items.map((i) => i.producto.id),
    ...c.oportunidades.margenBajo.items.map((i) => i.producto.id),
  ]);
  return {
    id: r.id,
    semana: r.semana,
    desde: r.desde.toISOString(),
    hasta: r.hasta.toISOString(),
    unidadesVendidas: c.resumen.unidadesVendidas,
    ventasNetas: c.resumen.ventasNetas,
    margenBruto: c.resumen.margenBruto,
    margenBrutoPct: c.resumen.margenBrutoPct,
    variacionVentasPct: c.semanaAnterior.variacionVentasPct,
    oportunidades: conOportunidad.size,
    enviadoEn: r.enviadoEn?.toISOString() ?? null,
    motivoNoEnvio: r.motivoNoEnvio,
    generadoEn: r.generadoEn.toISOString(),
  };
}

/**
 * Reportes semanales de rentabilidad (HU-09). El contenido se genera una vez por semana y se
 * guarda tal como se envió (design D2, D3); el envío va después del commit (D4).
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profitability: ProfitabilityService,
    private readonly mailer: Mailer,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Genera (o regenera) el reporte de una semana y decide el envío según `modo`. */
  async generar(semana: Semana, modo: ModoEnvio): Promise<ReporteSemanal> {
    const { comercioId } = TenantContext.requerido();
    const contenido = await this.armarContenido(semana);
    const fila = await this.prisma.transaccionTenant(async (tx) => {
      // Un reporte por comercio y semana aunque el cron y una consulta coincidan (D4).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rep:${comercioId}`}))`;
      const { desde, hasta } = rangoSemana(semana);
      return tx.reporteSemanal.upsert({
        where: { comercioId_semana: { comercioId, semana } },
        create: {
          comercioId,
          semana,
          desde,
          hasta,
          contenido: contenido as unknown as Prisma.InputJsonValue,
        },
        update: {
          desde,
          hasta,
          contenido: contenido as unknown as Prisma.InputJsonValue,
          generadoEn: new Date(),
          actualizadoEn: new Date(),
        },
      });
    });
    const debeEnviar = modo === 'siempre' || (modo === 'siNoEnviado' && fila.enviadoEn === null);
    return debeEnviar ? this.enviar(fila) : aReporte(fila);
  }

  /** Genera la semana sólo si no existe todavía (cron y bajo demanda). */
  async generarSiFalta(semana: Semana): Promise<ReporteSemanal | null> {
    const existe = await this.prisma.tenant.reporteSemanal.findFirst({
      where: { semana },
      select: { id: true },
    });
    if (existe) return null;
    return this.generar(semana, 'siNoEnviado');
  }

  /** Listado por semana descendente (CP-09.4); genera la última semana cerrada si falta (D4). */
  async listar(q: ReportesQuery): Promise<ListaReportes> {
    const ajustes = await this.ajustes();
    if (ajustes.activo) {
      try {
        await this.generarSiFalta(ultimaSemanaCerrada());
      } catch (err) {
        this.logger.warn({ err }, 'No se pudo generar el reporte de la última semana');
      }
    }
    const filas = await this.prisma.tenant.reporteSemanal.findMany({
      where: q.cursor ? { semana: { lt: q.cursor } } : {},
      orderBy: { semana: 'desc' },
      take: q.limit + 1,
    });
    const hayMas = filas.length > q.limit;
    const pagina = hayMas ? filas.slice(0, q.limit) : filas;
    const ultimo = pagina[pagina.length - 1];
    return {
      items: pagina.map(aResumen),
      siguienteCursor: hayMas && ultimo ? ultimo.semana : null,
    };
  }

  async obtener(id: string): Promise<ReporteSemanal> {
    const r = await this.prisma.tenant.reporteSemanal.findFirst({ where: { id } });
    if (!r) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
    return aReporte(r);
  }

  /** Reenvío explícito de un reporte existente (botón "Reenviar"). */
  async reenviar(id: string): Promise<ReporteSemanal> {
    const r = await this.prisma.tenant.reporteSemanal.findFirst({ where: { id } });
    if (!r) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
    return this.enviar(r);
  }

  async ajustes(): Promise<AjustesReportes> {
    const { comercioId } = TenantContext.requerido();
    const c = await this.prisma.tenant.comercio.findUniqueOrThrow({
      where: { id: comercioId },
      select: { reportesActivos: true, reportesDestinatarios: true },
    });
    return { activo: c.reportesActivos, destinatariosExtra: c.reportesDestinatarios };
  }

  async actualizarAjustes(patch: AjustesReportesPatch): Promise<AjustesReportes> {
    const { comercioId } = TenantContext.requerido();
    const c = await this.prisma.tenant.comercio.update({
      where: { id: comercioId },
      data: {
        ...(patch.activo !== undefined ? { reportesActivos: patch.activo } : {}),
        ...(patch.destinatariosExtra !== undefined
          ? { reportesDestinatarios: patch.destinatariosExtra }
          : {}),
      },
      select: { reportesActivos: true, reportesDestinatarios: true },
    });
    return { activo: c.reportesActivos, destinatariosExtra: c.reportesDestinatarios };
  }

  /** Semana en curso según Buenos Aires. */
  semanaActual(): Semana {
    return semanaDe(new Date());
  }

  // --- Contenido ---------------------------------------------------------------------

  private async armarContenido(semana: Semana): Promise<ContenidoReporte> {
    const { desde, hasta } = rangoSemana(semana);
    const anterior = semanaAnterior(semana);
    const rangoAnterior = rangoSemana(anterior);
    const mesGastos = mesDeSemana(semana);
    const [resumen, previo, estrellas, filas, criticas] = await Promise.all([
      this.profitability.resumenEntre(desde, hasta, mesGastos, 'porUnidad'),
      this.profitability.resumenEntre(
        rangoAnterior.desde,
        rangoAnterior.hasta,
        mesDeSemana(anterior),
        'porUnidad',
      ),
      this.profitability.topEntre(desde, hasta, MAX_ESTRELLAS),
      this.filasProductos(desde, hasta),
      this.alertasCriticas(),
    ]);
    const gastoPorUnidad =
      resumen.unidadesVendidas > 0 && resumen.motivo === null
        ? (Number(resumen.gastos) / resumen.unidadesVendidas).toFixed(2)
        : null;
    const oportunidad: FilaOportunidad[] = filas.map((f) => ({
      producto: { id: f.id, codigo: f.codigo, nombre: f.nombre },
      costoActual: f.costoActual,
      proveedorActual:
        f.proveedorActualId && f.proveedorActualNombre
          ? { id: f.proveedorActualId, nombre: f.proveedorActualNombre }
          : null,
      costoMinimoOtro: f.costoMinimoOtro,
      proveedorMinimo:
        f.proveedorMinimoId && f.proveedorMinimoNombre
          ? { id: f.proveedorMinimoId, nombre: f.proveedorMinimoNombre }
          : null,
      unidades30d: f.unidades30d,
      stock: f.stock,
      unidadesSemana: f.unidadesSemana,
      ventasNetasSemana: f.ventasNetasSemana,
      precioNeto: f.precioNeto,
    }));
    return {
      semana,
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      mesGastos,
      resumen: { ...resumen, gastoPorUnidad },
      semanaAnterior: {
        semana: anterior,
        ventasNetas: previo.ventasNetas,
        unidadesVendidas: previo.unidadesVendidas,
        variacionVentasPct: variacionPct(resumen.ventasNetas, previo.ventasNetas),
      },
      estrellas: estrellas.map((e) => ({
        producto: e.producto,
        unidadesVendidas: e.unidadesVendidas,
        margenBruto: e.margenBruto,
        margenBrutoPct: e.margenBrutoPct,
        margenBrutoSemana: e.margenBrutoMes,
      })),
      oportunidades: {
        comprarMasBarato: oportunidadesCompra(oportunidad),
        capitalInmovilizado: capitalInmovilizado(oportunidad),
        margenBajo: margenBajo(oportunidad),
      },
      alertasCriticas: criticas.map((a) => ({
        producto: { id: a.productoId, codigo: a.codigo, nombre: a.nombre },
        stock: a.stock,
        diasCobertura: a.diasCobertura,
        cantidadSugerida: a.cantidadSugerida,
      })),
      generadoEn: new Date().toISOString(),
    };
  }

  /** Una consulta por producto activo con lo que las tres reglas de ahorro necesitan (D3). */
  private filasProductos(desde: Date, hasta: Date): Promise<FilaProducto[]> {
    const { comercioId } = TenantContext.requerido();
    const desde30 = new Date(hasta.getTime() - VENTANA_ROTACION_DIAS * 24 * 60 * 60 * 1000);
    return this.prisma.transaccionTenant(
      (tx: TransaccionRaw) =>
        tx.$queryRaw<FilaProducto[]>`
        SELECT p.id, p.codigo, p.nombre, p.stock_actual AS stock,
               p.costo_reposicion::text AS "costoActual",
               (p.precio_venta / (1 + p.alicuota_iva / 100))::text AS "precioNeto",
               pr.id AS "proveedorActualId", pr.nombre AS "proveedorActualNombre",
               o.costo::text AS "costoMinimoOtro",
               o.proveedor_id AS "proveedorMinimoId", o.nombre AS "proveedorMinimoNombre",
               v30.unidades AS "unidades30d",
               vs.unidades AS "unidadesSemana", vs.ventas::text AS "ventasNetasSemana"
        FROM producto p
        LEFT JOIN proveedor pr ON pr.id = p.proveedor_principal_id
        LEFT JOIN LATERAL (
          SELECT x.proveedor_id, x.costo, x.nombre
          FROM (
            SELECT DISTINCT ON (pp.proveedor_id) pp.proveedor_id, pp.costo_neto AS costo, prx.nombre
            FROM precio_proveedor pp
            JOIN proveedor prx ON prx.id = pp.proveedor_id AND prx.activo
            WHERE pp.comercio_id = p.comercio_id AND pp.producto_id = p.id
              AND pp.proveedor_id IS DISTINCT FROM p.proveedor_principal_id
            ORDER BY pp.proveedor_id, pp.vigente_desde DESC, pp.creado_en DESC
          ) x
          ORDER BY x.costo ASC
          LIMIT 1
        ) o ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(m.cantidad), 0)::int AS unidades
          FROM movimiento m
          WHERE m.producto_id = p.id AND m.tipo = 'VENTA' AND m.anulado_por_id IS NULL
            AND m.fecha >= ${desde30} AND m.fecha < ${hasta}
        ) v30 ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(m.cantidad), 0)::int AS unidades,
                 COALESCE(SUM(m.cantidad * m.precio_unitario / (1 + p.alicuota_iva / 100)), 0) AS ventas
          FROM movimiento m
          WHERE m.producto_id = p.id AND m.tipo = 'VENTA' AND m.anulado_por_id IS NULL
            AND m.fecha >= ${desde} AND m.fecha < ${hasta}
        ) vs ON true
        WHERE p.comercio_id = ${comercioId}::uuid AND p.activo`,
    );
  }

  private alertasCriticas(): Promise<FilaCritica[]> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(
      (tx: TransaccionRaw) =>
        tx.$queryRaw<FilaCritica[]>`
        SELECT p.id AS "productoId", p.codigo, p.nombre, a.stock,
               a.dias_cobertura AS "diasCobertura", a.cantidad_sugerida AS "cantidadSugerida"
        FROM alerta a JOIN producto p ON p.id = a.producto_id
        WHERE a.comercio_id = ${comercioId}::uuid AND a.estado = 'ACTIVA' AND a.severidad = 'CRITICA'
        ORDER BY COALESCE(a.dias_cobertura, 999999) ASC, p.nombre ASC
        LIMIT 10`,
    );
  }

  // --- Envío ---------------------------------------------------------------------------

  /** Envía el reporte a los dueños activos y a los destinatarios extra; registra el resultado (D4). */
  private async enviar(fila: ReporteRow): Promise<ReporteSemanal> {
    const { comercioId } = TenantContext.requerido();
    const [comercio, duenios] = await Promise.all([
      this.prisma.tenant.comercio.findUniqueOrThrow({
        where: { id: comercioId },
        select: { nombre: true, reportesDestinatarios: true },
      }),
      this.prisma.tenant.usuario.findMany({
        where: { rol: 'DUENIO', activo: true },
        select: { email: true },
      }),
    ]);
    const destinatarios = [
      ...new Set([...duenios.map((d) => d.email), ...comercio.reportesDestinatarios]),
    ];
    let motivo: MotivoNoEnvioReporte | null = null;
    let enviado = false;
    if (destinatarios.length === 0) motivo = 'SIN_DESTINATARIOS';
    else if (!this.mailer.configurado) motivo = 'SIN_PROVEEDOR';
    else {
      const correo = armarSemanal(
        comercio.nombre,
        ContenidoReporteSchema.parse(fila.contenido),
        this.config.get('WEB_URL', { infer: true }),
        fila.id,
      );
      enviado = await this.mailer.enviar({ para: destinatarios, ...correo });
      if (!enviado) motivo = 'ENVIO_FALLIDO';
    }
    if (!enviado) this.logger.warn({ reporte: fila.id, motivo }, 'Reporte semanal sin enviar');
    const actualizado = await this.prisma.tenant.reporteSemanal.update({
      where: { id: fila.id },
      data: enviado
        ? { enviadoEn: new Date(), destinatarios, motivoNoEnvio: null }
        : { motivoNoEnvio: motivo, destinatarios: enviado ? destinatarios : fila.destinatarios },
    });
    return aReporte(actualizado);
  }
}
