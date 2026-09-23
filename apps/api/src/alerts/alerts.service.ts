import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type Alerta,
  type AlertaAccion,
  type AlertasQuery,
  DIAS_POSPOSICION,
  type EstadoAlerta,
  type EvaluacionReposicion,
  type ListaAlertas,
  type ReposicionDashboard,
  type ResultadoRecalculo,
  type ResumenAlertas,
  type SeveridadAlerta,
  calculoVencido,
  evaluarReposicion,
  planCumple,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { codificarCursor, decodificarCursor } from '../common/cursor';
import { conflicto, noEncontrado } from '../common/errors';
import type { Env } from '../config/env';
import { Prisma } from '../generated/prisma/client';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';
import { Mailer } from './mailer';
import { armarResumen } from './plantillas/resumen';

/** Fila de la consulta de recálculo (design D3): un producto activo con lo que RN-04 necesita. */
interface FilaCalculo {
  id: string;
  stock: number;
  stockSeguridad: number;
  diasAnticipacion: number;
  leadTimeDias: number | null;
  unidades30d: number;
  alertaId: string | null;
  alertaEstado: EstadoAlerta | null;
  pospuestaHasta: Date | null;
  atendidaEn: Date | null;
  ultimoIngresoEn: Date | null;
}

/** Fila del listado: alerta más producto y proveedor. */
interface FilaAlerta {
  id: string;
  estado: EstadoAlerta;
  severidad: SeveridadAlerta;
  stock: number;
  velocidadDiaria: string;
  diasCobertura: number | null;
  puntoReposicion: number;
  umbral: number;
  leadTimeDias: number;
  diasAnticipacion: number;
  cantidadSugerida: number;
  generadaEn: Date;
  actualizadaEn: Date;
  pospuestaHasta: Date | null;
  atendidaEn: Date | null;
  resueltaEn: Date | null;
  notificadaEn: Date | null;
  productoId: string;
  codigo: string;
  nombre: string;
  stockActual: number;
  stockSeguridad: number;
  proveedorId: string | null;
  proveedorNombre: string | null;
  proveedorLeadTime: number | null;
}

interface ResultadoInterno extends ResultadoRecalculo {
  nombreComercio: string;
  nuevas: string[];
}

const SIN_COBERTURA = 999_999;
const REPOSICION_MAX = 5;

const COLUMNAS_ALERTA = Prisma.sql`
  a.id, a.estado, a.severidad, a.stock,
  a.velocidad_diaria::text AS "velocidadDiaria",
  a.dias_cobertura AS "diasCobertura",
  a.punto_reposicion AS "puntoReposicion",
  a.umbral, a.lead_time_dias AS "leadTimeDias", a.dias_anticipacion AS "diasAnticipacion",
  a.cantidad_sugerida AS "cantidadSugerida",
  a.generada_en AS "generadaEn", a.actualizada_en AS "actualizadaEn",
  a.pospuesta_hasta AS "pospuestaHasta", a.atendida_en AS "atendidaEn",
  a.resuelta_en AS "resueltaEn", a.notificada_en AS "notificadaEn",
  p.id AS "productoId", p.codigo, p.nombre,
  p.stock_actual AS "stockActual", p.stock_seguridad AS "stockSeguridad",
  pr.id AS "proveedorId", pr.nombre AS "proveedorNombre", pr.lead_time_dias AS "proveedorLeadTime"`;

const DESDE_ALERTA = Prisma.sql`
  FROM alerta a
  JOIN producto p ON p.id = a.producto_id
  LEFT JOIN proveedor pr ON pr.id = p.proveedor_principal_id`;

function estadoStockDe(stock: number, seguridad: number): Alerta['producto']['estadoStock'] {
  if (stock <= 0) return 'SIN_STOCK';
  return stock <= seguridad ? 'BAJO' : 'OK';
}

export function aAlerta(f: FilaAlerta): Alerta {
  return {
    id: f.id,
    producto: {
      id: f.productoId,
      codigo: f.codigo,
      nombre: f.nombre,
      stockActual: f.stockActual,
      stockSeguridad: f.stockSeguridad,
      estadoStock: estadoStockDe(f.stockActual, f.stockSeguridad),
    },
    proveedor:
      f.proveedorId && f.proveedorNombre !== null && f.proveedorLeadTime !== null
        ? { id: f.proveedorId, nombre: f.proveedorNombre, leadTimeDias: f.proveedorLeadTime }
        : null,
    estado: f.estado,
    severidad: f.severidad,
    stock: f.stock,
    velocidadDiaria: Number(f.velocidadDiaria).toFixed(3),
    diasCobertura: f.diasCobertura,
    puntoReposicion: f.puntoReposicion,
    umbral: f.umbral,
    leadTimeDias: f.leadTimeDias,
    diasAnticipacion: f.diasAnticipacion,
    cantidadSugerida: f.cantidadSugerida,
    generadaEn: f.generadaEn.toISOString(),
    actualizadaEn: f.actualizadaEn.toISOString(),
    pospuestaHasta: f.pospuestaHasta?.toISOString() ?? null,
    atendidaEn: f.atendidaEn?.toISOString() ?? null,
    resueltaEn: f.resueltaEn?.toISOString() ?? null,
    notificadaEn: f.notificadaEn?.toISOString() ?? null,
  };
}

/**
 * Alertas predictivas de reposición (HU-06, RN-04). El recálculo corre en una pasada por
 * comercio (design D3) y lo disparan el cron diario, la lectura vencida y el botón (D4).
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: Mailer,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Recalcula las alertas del comercio del contexto. Con `soloSiVencido`, no hace nada si el
   * último cálculo tiene menos de una hora (lectura bajo demanda, CP-06.2e). Devuelve null en
   * ese caso.
   */
  async recalcular(opts: { soloSiVencido?: boolean } = {}): Promise<ResultadoRecalculo | null> {
    const { comercioId } = TenantContext.requerido();
    const resultado = await this.prisma.transaccionTenant(async (tx) => {
      // Un solo recálculo por comercio a la vez (D4): el segundo espera y encuentra el cálculo fresco.
      // El lock y la lectura del comercio van en un solo viaje a la base.
      const [comercio] = await tx.$queryRaw<{ nombre: string; alertasCalculadasEn: Date | null }[]>`
        SELECT pg_advisory_xact_lock(hashtext(${comercioId}))::text AS lock,
               c.nombre, c.alertas_calculadas_en AS "alertasCalculadasEn"
        FROM comercio c WHERE c.id = ${comercioId}::uuid`;
      if (!comercio) throw noEncontrado('No encontramos tu comercio.');
      if (opts.soloSiVencido && !calculoVencido(comercio.alertasCalculadasEn)) return null;
      return this.recalcularEn(tx, comercioId, comercio.nombre);
    });
    if (!resultado) return null;
    await this.notificar(resultado);
    const { nombreComercio: _n, nuevas: _v, ...publico } = resultado;
    return publico;
  }

  private async recalcularEn(
    tx: TransaccionRaw,
    comercioId: string,
    nombreComercio: string,
  ): Promise<ResultadoInterno> {
    const ahora = new Date();
    const t0 = Date.now();
    const tiempos: Record<string, number> = {};
    const marcar = (fase: string) => {
      tiempos[fase] = Date.now() - t0;
    };
    // Una pasada agrupada sobre los movimientos y las alertas del comercio (RNF-04, CP-06.7):
    // ventas de la ventana de 30 días, último ingreso y última atención por producto. Las CTE van
    // MATERIALIZED para que la agregación se calcule una sola vez aunque las estadísticas estén
    // desactualizadas (sin eso, con datos recién cargados el planificador la repite por producto).
    const filas = await tx.$queryRaw<FilaCalculo[]>`
      WITH mov AS MATERIALIZED (
        SELECT m.producto_id,
               COALESCE(SUM(m.cantidad) FILTER (
                 WHERE m.tipo = 'VENTA' AND m.anulado_por_id IS NULL
                   AND m.fecha >= ${ahora}::timestamptz - interval '30 days'
               ), 0)::int AS unidades,
               MAX(m.creado_en) FILTER (WHERE m.tipo = 'INGRESO' AND m.anulado_por_id IS NULL) AS ultimo_ingreso
        FROM movimiento m
        WHERE m.comercio_id = ${comercioId}::uuid
        GROUP BY m.producto_id
      ),
      abiertas AS MATERIALIZED (
        SELECT x.producto_id, x.id, x.estado, x.pospuesta_hasta FROM alerta x
        WHERE x.comercio_id = ${comercioId}::uuid AND x.estado IN ('ACTIVA', 'POSPUESTA')
      ),
      atendidas AS MATERIALIZED (
        SELECT x.producto_id, MAX(x.atendida_en) AS atendida_en FROM alerta x
        WHERE x.comercio_id = ${comercioId}::uuid AND x.estado = 'ATENDIDA'
        GROUP BY x.producto_id
      )
      SELECT p.id, p.stock_actual AS stock, p.stock_seguridad AS "stockSeguridad",
             p.dias_anticipacion_alerta AS "diasAnticipacion",
             pr.lead_time_dias AS "leadTimeDias",
             COALESCE(mov.unidades, 0)::int AS "unidades30d",
             abiertas.id AS "alertaId", abiertas.estado AS "alertaEstado",
             abiertas.pospuesta_hasta AS "pospuestaHasta",
             atendidas.atendida_en AS "atendidaEn", mov.ultimo_ingreso AS "ultimoIngresoEn"
      FROM producto p
      LEFT JOIN proveedor pr ON pr.id = p.proveedor_principal_id
      LEFT JOIN mov ON mov.producto_id = p.id
      LEFT JOIN abiertas ON abiertas.producto_id = p.id
      LEFT JOIN atendidas ON atendidas.producto_id = p.id
      WHERE p.comercio_id = ${comercioId}::uuid AND p.activo`;
    marcar('consulta');

    const crear: { fila: FilaCalculo; e: EvaluacionReposicion }[] = [];
    // Alertas abiertas: se actualizan las cifras y, según el caso, se reactivan o se resuelven.
    const actualizar: {
      id: string;
      stock: number;
      e: EvaluacionReposicion;
      reactivar: boolean;
      resolver: boolean;
    }[] = [];
    for (const f of filas) {
      const e = evaluarReposicion({
        stock: f.stock,
        unidades30d: f.unidades30d,
        leadTimeDias: f.leadTimeDias,
        stockSeguridad: f.stockSeguridad,
        diasAnticipacion: f.diasAnticipacion,
      });
      if (e.enAlerta) {
        if (f.alertaId) {
          const vencida =
            f.alertaEstado === 'POSPUESTA' &&
            f.pospuestaHasta !== null &&
            f.pospuestaHasta <= ahora;
          actualizar.push({
            id: f.alertaId,
            stock: f.stock,
            e,
            reactivar: vencida,
            resolver: false,
          });
        } else {
          // Atendida = ya se pidió: no se vuelve a alertar hasta que entre mercadería (CP-06.5, CP-06.5c).
          const bloqueada =
            f.atendidaEn !== null &&
            (f.ultimoIngresoEn === null || f.ultimoIngresoEn <= f.atendidaEn);
          if (!bloqueada) crear.push({ fila: f, e });
        }
      } else if (f.alertaId) {
        // Se cierra con las cifras finales (CP-06.2c, CP-06.4).
        actualizar.push({ id: f.alertaId, stock: f.stock, e, reactivar: false, resolver: true });
      }
    }

    let nuevas: string[] = [];
    if (crear.length > 0) {
      const creadas = await tx.alerta.createManyAndReturn({
        select: { id: true },
        data: crear.map(({ fila, e }) => ({
          comercioId,
          productoId: fila.id,
          estado: 'ACTIVA' as const,
          severidad: e.severidad ?? 'PROXIMA',
          stock: fila.stock,
          velocidadDiaria: e.velocidadDiaria,
          diasCobertura: e.diasCobertura,
          puntoReposicion: e.puntoReposicion,
          umbral: e.umbral,
          leadTimeDias: e.leadTimeDias,
          diasAnticipacion: e.diasAnticipacion,
          cantidadSugerida: e.cantidadSugerida,
          generadaEn: ahora,
          actualizadaEn: ahora,
        })),
      });
      nuevas = creadas.map((a) => a.id);
      marcar('crear');
    }
    if (actualizar.length > 0) {
      await tx.$executeRaw`
        UPDATE alerta a SET
          severidad = v.severidad::severidad_alerta,
          stock = v.stock,
          velocidad_diaria = v.velocidad::numeric,
          dias_cobertura = v.cobertura,
          punto_reposicion = v.punto,
          umbral = v.umbral,
          lead_time_dias = v.lead,
          dias_anticipacion = v.antic,
          cantidad_sugerida = v.sugerida,
          estado = CASE
            WHEN v.resolver THEN 'RESUELTA'::estado_alerta
            WHEN v.reactivar THEN 'ACTIVA'::estado_alerta
            ELSE a.estado END,
          pospuesta_hasta = CASE WHEN v.reactivar OR v.resolver THEN NULL ELSE a.pospuesta_hasta END,
          resuelta_en = CASE WHEN v.resolver THEN ${ahora}::timestamptz ELSE a.resuelta_en END,
          actualizada_en = ${ahora}::timestamptz
        FROM unnest(
          ${actualizar.map((x) => x.id)}::uuid[],
          ${actualizar.map((x) => x.e.severidad ?? (x.stock <= x.e.puntoReposicion ? 'CRITICA' : 'PROXIMA'))}::text[],
          ${actualizar.map((x) => x.stock)}::int[],
          ${actualizar.map((x) => x.e.velocidadDiaria.toFixed(3))}::text[],
          ${actualizar.map((x) => x.e.diasCobertura)}::int[],
          ${actualizar.map((x) => x.e.puntoReposicion)}::int[],
          ${actualizar.map((x) => x.e.umbral)}::int[],
          ${actualizar.map((x) => x.e.leadTimeDias)}::int[],
          ${actualizar.map((x) => x.e.diasAnticipacion)}::int[],
          ${actualizar.map((x) => x.e.cantidadSugerida)}::int[],
          ${actualizar.map((x) => x.reactivar)}::boolean[],
          ${actualizar.map((x) => x.resolver)}::boolean[]
        ) AS v(id, severidad, stock, velocidad, cobertura, punto, umbral, lead, antic, sugerida, reactivar, resolver)
        WHERE a.id = v.id AND a.comercio_id = ${comercioId}::uuid`;
      marcar('actualizar');
    }
    let resueltas = actualizar.filter((x) => x.resolver).length;
    // Un producto dado de baja cierra su alerta abierta.
    resueltas += await tx.$executeRaw`
      UPDATE alerta a SET estado = 'RESUELTA', resuelta_en = ${ahora}::timestamptz, actualizada_en = ${ahora}::timestamptz
      FROM producto p
      WHERE a.producto_id = p.id AND a.comercio_id = ${comercioId}::uuid
        AND NOT p.activo AND a.estado IN ('ACTIVA', 'POSPUESTA')`;

    await tx.comercio.update({ where: { id: comercioId }, data: { alertasCalculadasEn: ahora } });
    marcar('fin');
    this.logger.debug({ comercioId, productos: filas.length, ...tiempos }, 'Recálculo de alertas');

    return {
      creadas: crear.length,
      actualizadas: actualizar.filter((x) => !x.resolver).length,
      resueltas,
      calculadasEn: ahora.toISOString(),
      nombreComercio,
      nuevas,
    };
  }

  /** Correo de resumen a los dueños con las alertas nuevas aún no notificadas (D5, CP-06.3b). */
  private async notificar(r: ResultadoInterno): Promise<void> {
    if (r.nuevas.length === 0) return;
    const { comercioId } = TenantContext.requerido();
    try {
      // Lectura y marca en una sola transacción; el envío queda afuera (D5). Si el proveedor
      // falla, queda en el log: la alerta ya es visible en la app (CP-06.3c).
      const { alertas, duenios } = await this.prisma.transaccionTenant(async (tx) => {
        const alertas = await tx.$queryRaw<FilaAlerta[]>`
          SELECT ${COLUMNAS_ALERTA} ${DESDE_ALERTA}
          WHERE a.comercio_id = ${comercioId}::uuid AND a.notificada_en IS NULL
            AND a.id IN (${Prisma.join(r.nuevas.map((id) => Prisma.sql`${id}::uuid`))})
          ORDER BY COALESCE(a.dias_cobertura, ${SIN_COBERTURA}) ASC, p.nombre ASC`;
        const duenios = await tx.usuario.findMany({
          where: { comercioId, rol: 'DUENIO', activo: true },
          select: { email: true },
        });
        if (alertas.length > 0 && duenios.length > 0) {
          await tx.alerta.updateMany({
            where: { comercioId, id: { in: alertas.map((a) => a.id) } },
            data: { notificadaEn: new Date() },
          });
        }
        return { alertas, duenios };
      });
      if (alertas.length === 0 || duenios.length === 0) return;
      const correo = armarResumen(
        r.nombreComercio,
        alertas.map((a) => ({
          codigo: a.codigo,
          nombre: a.nombre,
          stock: a.stock,
          diasCobertura: a.diasCobertura,
          cantidadSugerida: a.cantidadSugerida,
          severidad: a.severidad,
        })),
        this.config.get('WEB_URL', { infer: true }),
      );
      await this.mailer.enviar({ para: duenios.map((d) => d.email), ...correo });
    } catch (err) {
      this.logger.warn({ err, comercioId }, 'No se pudo notificar las alertas nuevas');
    }
  }

  /** Listado paginado por días de cobertura (CP-06.3); recalcula antes si está vencido. */
  async listar(q: AlertasQuery): Promise<ListaAlertas> {
    await this.recalcular({ soloSiVencido: true });
    const { comercioId } = TenantContext.requerido();
    const condiciones = [Prisma.sql`a.comercio_id = ${comercioId}::uuid`];
    if (q.estado !== 'TODAS') condiciones.push(Prisma.sql`a.estado = ${q.estado}::estado_alerta`);
    if (q.cursor) {
      const [cobertura, id] = decodificarCursor(q.cursor, 2);
      condiciones.push(
        Prisma.sql`(COALESCE(a.dias_cobertura, ${SIN_COBERTURA}), a.id) > (${Number(cobertura)}, ${id}::uuid)`,
      );
    }
    const filas = await this.prisma.transaccionTenant(
      (tx) =>
        tx.$queryRaw<FilaAlerta[]>`
        SELECT ${COLUMNAS_ALERTA} ${DESDE_ALERTA}
        WHERE ${Prisma.join(condiciones, ' AND ')}
        ORDER BY COALESCE(a.dias_cobertura, ${SIN_COBERTURA}) ASC, a.id ASC
        LIMIT ${q.limit + 1}`,
    );
    const hayMas = filas.length > q.limit;
    const pagina = hayMas ? filas.slice(0, q.limit) : filas;
    const ultimo = pagina[pagina.length - 1];
    return {
      items: pagina.map(aAlerta),
      siguienteCursor:
        hayMas && ultimo
          ? codificarCursor([String(ultimo.diasCobertura ?? SIN_COBERTURA), ultimo.id])
          : null,
    };
  }

  async obtener(id: string): Promise<Alerta> {
    const { comercioId } = TenantContext.requerido();
    const filas = await this.prisma.transaccionTenant(
      (tx) =>
        tx.$queryRaw<FilaAlerta[]>`
        SELECT ${COLUMNAS_ALERTA} ${DESDE_ALERTA}
        WHERE a.comercio_id = ${comercioId}::uuid AND a.id = ${id}::uuid`,
    );
    const fila = filas[0];
    if (!fila) throw noEncontrado('No encontramos esa alerta en tu comercio.');
    return aAlerta(fila);
  }

  /** Contadores para la navegación y el panel (CP-06.3); recalcula antes si está vencido. */
  async resumen(): Promise<ResumenAlertas> {
    await this.recalcular({ soloSiVencido: true });
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const [conteo] = await tx.$queryRaw<
        { activas: number; criticas: number; pospuestas: number }[]
      >`
        SELECT count(*) FILTER (WHERE estado = 'ACTIVA')::int AS activas,
               count(*) FILTER (WHERE estado = 'ACTIVA' AND severidad = 'CRITICA')::int AS criticas,
               count(*) FILTER (WHERE estado = 'POSPUESTA')::int AS pospuestas
        FROM alerta WHERE comercio_id = ${comercioId}::uuid`;
      const comercio = await tx.comercio.findUniqueOrThrow({
        where: { id: comercioId },
        select: { alertasCalculadasEn: true },
      });
      return {
        activas: conteo?.activas ?? 0,
        criticas: conteo?.criticas ?? 0,
        pospuestas: conteo?.pospuestas ?? 0,
        calculadasEn: comercio.alertasCalculadasEn?.toISOString() ?? null,
      };
    });
  }

  /** Bloque `alertas.reposicion` del panel (CP-04.1e): null si el plan no incluye alertas. */
  async reposicionParaPanel(): Promise<ReposicionDashboard> {
    const { comercioId, plan } = TenantContext.requerido();
    if (!planCumple(plan, 'PRO')) return null;
    await this.recalcular({ soloSiVencido: true });
    const filas = await this.prisma.transaccionTenant(
      (tx) =>
        tx.$queryRaw<(FilaAlerta & { total: number; criticas: number })[]>`
        SELECT ${COLUMNAS_ALERTA},
               count(*) OVER ()::int AS total,
               (count(*) FILTER (WHERE a.severidad = 'CRITICA') OVER ())::int AS criticas
        ${DESDE_ALERTA}
        WHERE a.comercio_id = ${comercioId}::uuid AND a.estado = 'ACTIVA'
        ORDER BY COALESCE(a.dias_cobertura, ${SIN_COBERTURA}) ASC, a.id ASC
        LIMIT ${REPOSICION_MAX}`,
    );
    return {
      total: filas[0]?.total ?? 0,
      criticas: filas[0]?.criticas ?? 0,
      items: filas.map((f) => ({
        id: f.id,
        producto: { id: f.productoId, codigo: f.codigo, nombre: f.nombre },
        severidad: f.severidad,
        stock: f.stock,
        diasCobertura: f.diasCobertura,
        cantidadSugerida: f.cantidadSugerida,
      })),
    };
  }

  /** ATENDER o POSPONER una alerta abierta (CP-06.5, CP-06.5b, CP-06.5d). */
  async accionar(id: string, dto: AlertaAccion): Promise<Alerta> {
    const { comercioId } = TenantContext.requerido();
    await this.prisma.transaccionTenant(async (tx) => {
      const alerta = await tx.alerta.findFirst({ where: { id, comercioId } });
      if (!alerta) throw noEncontrado('No encontramos esa alerta en tu comercio.');
      if (alerta.estado !== 'ACTIVA' && alerta.estado !== 'POSPUESTA') {
        throw conflicto(
          'La alerta ya está cerrada: sólo se atienden o posponen alertas abiertas.',
          {
            estado: alerta.estado,
          },
        );
      }
      const ahora = new Date();
      await tx.alerta.update({
        where: { id },
        data:
          dto.accion === 'ATENDER'
            ? { estado: 'ATENDIDA', atendidaEn: ahora, pospuestaHasta: null, actualizadaEn: ahora }
            : {
                estado: 'POSPUESTA',
                pospuestaHasta: new Date(ahora.getTime() + DIAS_POSPOSICION * 24 * 60 * 60 * 1000),
                actualizadaEn: ahora,
              },
      });
    });
    return this.obtener(id);
  }
}
