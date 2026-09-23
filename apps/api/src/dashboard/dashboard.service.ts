import { Injectable } from '@nestjs/common';
import {
  mesActual,
  redondear2,
  sumarMeses,
  variacionPct,
  type AlertaStock,
  type Dashboard,
  type Mes,
} from '@inventariosmart/shared';
import { AlertsService } from '../alerts/alerts.service';
import { TenantContext } from '../auth/tenant-context';
import { ProfitabilityService } from '../profitability/profitability.service';
import { PrismaService } from '../prisma/prisma.service';

interface FilaStock {
  productosActivos: number;
  unidades: number;
  valorizacion: string;
  sinStock: number;
  stockBajo: number;
}

const ALERTAS_MAX = 5;
const TOP_MAX = 5;

/** Panel del mes (HU-04): compone rentabilidad, gastos y stock en una sola respuesta (D1). */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    private readonly profitability: ProfitabilityService,
  ) {}

  async obtener(periodo: Mes | undefined): Promise<Dashboard> {
    const { comercioId } = TenantContext.requerido();
    const mes = periodo ?? this.mesActualBuenosAires();
    const anterior = sumarMeses(mes, -1);

    const [ventas, previo, stock, topRentables, alertas, reposicion] = await Promise.all([
      this.profitability.resumen(mes),
      this.profitability.resumen(anterior),
      this.stock(comercioId),
      this.profitability.topDelMes(mes, TOP_MAX),
      this.alertas(),
      this.alerts.reposicionParaPanel(),
    ]);

    return {
      periodo: mes,
      stock,
      ventas: {
        unidadesVendidas: ventas.unidadesVendidas,
        ventasNetas: ventas.ventasNetas,
        costoVendido: ventas.costoVendido,
        margenBruto: ventas.margenBruto,
        margenBrutoPct: ventas.margenBrutoPct,
        gastos: ventas.gastos,
        margenNeto: ventas.margenNeto,
        margenNetoPct: ventas.margenNetoPct,
        motivo: ventas.motivo,
      },
      mesAnterior: {
        periodo: anterior,
        unidadesVendidas: previo.unidadesVendidas,
        ventasNetas: previo.ventasNetas,
        variacionVentasPct: variacionPct(ventas.ventasNetas, previo.ventasNetas),
      },
      topRentables,
      alertas: { ...alertas, faltanGastos: ventas.motivo === 'SIN_GASTOS', reposicion },
    };
  }

  /** Una agregación sobre producto: el stock ya está almacenado (ADR 0006), no se recorre el histórico. */
  private async stock(comercioId: string): Promise<Dashboard['stock']> {
    const [fila] = await this.prisma.transaccionTenant(
      (tx) =>
        tx.$queryRaw<FilaStock[]>`
        SELECT count(*) FILTER (WHERE activo)::int AS "productosActivos",
               COALESCE(SUM(stock_actual) FILTER (WHERE activo), 0)::int AS unidades,
               COALESCE(SUM(stock_actual * costo_reposicion) FILTER (WHERE activo), 0)::text AS valorizacion,
               count(*) FILTER (WHERE activo AND stock_actual <= 0)::int AS "sinStock",
               count(*) FILTER (WHERE activo AND stock_actual > 0 AND stock_actual <= stock_seguridad)::int AS "stockBajo"
        FROM producto WHERE comercio_id = ${comercioId}::uuid`,
    );
    return {
      productosActivos: fila?.productosActivos ?? 0,
      unidades: fila?.unidades ?? 0,
      valorizacion: redondear2(Number(fila?.valorizacion ?? 0)),
      sinStock: fila?.sinStock ?? 0,
      stockBajo: fila?.stockBajo ?? 0,
    };
  }

  private async alertas(): Promise<Omit<Dashboard['alertas'], 'faltanGastos' | 'reposicion'>> {
    const select = {
      id: true,
      codigo: true,
      nombre: true,
      stockActual: true,
      stockSeguridad: true,
    };
    const orderBy = { nombre: 'asc' as const };
    const sinStockWhere = { activo: true, stockActual: { lte: 0 } };
    const [sinStockItems, sinStockTotal, bajos] = await Promise.all([
      this.prisma.tenant.producto.findMany({
        where: sinStockWhere,
        select,
        orderBy,
        take: ALERTAS_MAX,
      }),
      this.prisma.tenant.producto.count({ where: sinStockWhere }),
      // Prisma no compara dos columnas entre sí: el stock bajo se filtra en SQL.
      this.prisma.transaccionTenant(
        (tx) =>
          tx.$queryRaw<(AlertaStock & { total: number })[]>`
          SELECT id, codigo, nombre, stock_actual AS "stockActual", stock_seguridad AS "stockSeguridad",
                 count(*) OVER ()::int AS total
          FROM producto
          WHERE comercio_id = ${TenantContext.requerido().comercioId}::uuid AND activo
            AND stock_actual > 0 AND stock_actual <= stock_seguridad
          ORDER BY nombre ASC LIMIT ${ALERTAS_MAX}`,
      ),
    ]);
    return {
      sinStock: { total: sinStockTotal, items: sinStockItems },
      stockBajo: {
        total: bajos[0]?.total ?? 0,
        items: bajos.map(({ total: _t, ...a }) => a),
      },
    };
  }

  private mesActualBuenosAires(): Mes {
    const ahora = new Date();
    return mesActual(new Date(ahora.getTime() + (ahora.getTimezoneOffset() - 180) * 60_000));
  }
}
