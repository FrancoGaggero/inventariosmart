import { Injectable } from '@nestjs/common';
import {
  margenBruto,
  margenNeto,
  mesActual,
  porcentaje,
  precioNeto,
  redondear2,
  sumarMeses,
  type ListaRentabilidad,
  type Mes,
  type RentabilidadProducto,
  type RentabilidadQuery,
  type ResumenRentabilidad,
  type TopRentable,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { codificarCursor, decodificarCursor } from '../common/cursor';
import { ExpensesService, inicioMesBuenosAires } from '../expenses/expenses.service';
import { Prisma } from '../generated/prisma/client';
import { normalizarCodigo } from '../products/products.service';
import { PrismaService } from '../prisma/prisma.service';

/** Fila del listado: producto más las ventas del mes agregadas en SQL (D2). */
interface FilaRentabilidad {
  id: string;
  codigo: string;
  nombre: string;
  precioVenta: string;
  alicuotaIva: string;
  costoReposicion: string;
  unidades: number;
}

interface FilaResumen {
  unidades: number;
  ventasNetas: string;
  costoVendido: string;
}

/** Márgenes bruto y neto por producto y consolidados (HU-03). Nada se almacena. */
@Injectable()
export class ProfitabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expenses: ExpensesService,
  ) {}

  /** Rentabilidad por producto activo, con búsqueda y cursor (CP-03.1 a CP-03.4, CP-03.6). */
  async listar(q: RentabilidadQuery): Promise<ListaRentabilidad> {
    const { comercioId } = TenantContext.requerido();
    const periodo = q.periodo ?? this.mesActualBuenosAires();
    const desde = inicioMesBuenosAires(periodo);
    const hasta = inicioMesBuenosAires(sumarMeses(periodo, 1));
    const cursor = q.cursor ? decodificarCursor(q.cursor, 2) : null;

    const condiciones: Prisma.Sql[] = [
      Prisma.sql`p.comercio_id = ${comercioId}::uuid`,
      Prisma.sql`p.activo = true`,
    ];
    if (q.q) {
      condiciones.push(
        Prisma.sql`(p.codigo_normalizado LIKE ${`${normalizarCodigo(q.q)}%`} OR p.nombre ILIKE ${`%${q.q}%`})`,
      );
    }
    if (cursor) condiciones.push(Prisma.sql`(p.nombre, p.id) > (${cursor[0]}, ${cursor[1]}::uuid)`);

    const [resumenGastos, filas] = await Promise.all([
      this.expenses.resumen(periodo),
      this.prisma.transaccionTenant((tx) =>
        tx.$queryRaw<FilaRentabilidad[]>(
          Prisma.sql`SELECT p.id, p.codigo, p.nombre,
              p.precio_venta::text AS "precioVenta",
              p.alicuota_iva::text AS "alicuotaIva",
              p.costo_reposicion::text AS "costoReposicion",
              v.unidades
            FROM producto p
            LEFT JOIN LATERAL (
              SELECT COALESCE(SUM(m.cantidad), 0)::int AS unidades
              FROM movimiento m
              WHERE m.producto_id = p.id AND m.tipo = 'VENTA' AND m.anulado_por_id IS NULL
                AND m.fecha >= ${desde} AND m.fecha < ${hasta}
            ) v ON true
            WHERE ${Prisma.join(condiciones, ' AND ')}
            ORDER BY p.nombre ASC, p.id ASC
            LIMIT ${q.limit + 1}`,
        ),
      ),
    ]);

    const hayMas = filas.length > q.limit;
    const pagina = hayMas ? filas.slice(0, q.limit) : filas;
    const ultimo = pagina[pagina.length - 1];
    return {
      periodo,
      gastoPorUnidad: resumenGastos.gastoPorUnidad,
      motivoNeto: resumenGastos.motivo,
      items: pagina.map((f) => this.aRentabilidad(f, resumenGastos.gastoPorUnidad)),
      siguienteCursor: hayMas && ultimo ? codificarCursor([ultimo.nombre, ultimo.id]) : null,
    };
  }

  /** Consolidado del mes (CP-03.5). */
  async resumen(periodo: Mes | undefined): Promise<ResumenRentabilidad> {
    const mes = periodo ?? this.mesActualBuenosAires();
    const desde = inicioMesBuenosAires(mes);
    const hasta = inicioMesBuenosAires(sumarMeses(mes, 1));
    return { periodo: mes, ...(await this.resumenEntre(desde, hasta, mes, 'mes')) };
  }

  /**
   * Consolidado de un rango de fechas (HU-09 lo usa por semana). Los gastos salen del mes
   * `mesGastos` (RN-02): con `modo: 'mes'` se resta el total del mes (el rango es el mes);
   * con `modo: 'porUnidad'` se resta el gasto por unidad × unidades del rango.
   */
  async resumenEntre(
    desde: Date,
    hasta: Date,
    mesGastos: Mes,
    modo: 'mes' | 'porUnidad',
  ): Promise<Omit<ResumenRentabilidad, 'periodo'>> {
    const { comercioId } = TenantContext.requerido();
    const [gastos, [fila]] = await Promise.all([
      this.expenses.resumen(mesGastos),
      this.prisma.transaccionTenant(
        (tx) =>
          tx.$queryRaw<FilaResumen[]>`
          SELECT COALESCE(SUM(m.cantidad), 0)::int AS unidades,
                 COALESCE(SUM(m.cantidad * m.precio_unitario / (1 + p.alicuota_iva / 100)), 0)::text AS "ventasNetas",
                 COALESCE(SUM(m.cantidad * p.costo_reposicion), 0)::text AS "costoVendido"
          FROM movimiento m
          JOIN producto p ON p.id = m.producto_id
          WHERE m.comercio_id = ${comercioId}::uuid AND m.tipo = 'VENTA'
            AND m.anulado_por_id IS NULL AND m.fecha >= ${desde} AND m.fecha < ${hasta}`,
      ),
    ]);

    const unidades = fila?.unidades ?? 0;
    const ventasNetas = redondear2(Number(fila?.ventasNetas ?? 0));
    const costoVendido = redondear2(Number(fila?.costoVendido ?? 0));
    const bruto = margenBruto(ventasNetas, costoVendido);
    const gastosAplicados =
      modo === 'mes'
        ? gastos.total
        : gastos.gastoPorUnidad === null
          ? '0.00'
          : redondear2(Number(gastos.gastoPorUnidad) * unidades);
    const sinVentas = modo === 'porUnidad' && unidades === 0;
    const neto =
      gastos.gastoPorUnidad === null || sinVentas ? null : margenBruto(bruto, gastosAplicados);
    return {
      unidadesVendidas: unidades,
      ventasNetas,
      costoVendido,
      margenBruto: bruto,
      margenBrutoPct: porcentaje(bruto, ventasNetas),
      gastos: gastosAplicados,
      margenNeto: neto,
      margenNetoPct: neto === null ? null : porcentaje(neto, ventasNetas),
      motivo: sinVentas ? 'SIN_VENTAS' : gastos.motivo,
    };
  }

  /** Productos con ventas en el mes, ordenados por margen bruto generado (HU-04, D1 d). */
  async topDelMes(periodo: Mes, n: number): Promise<TopRentable[]> {
    return this.topEntre(
      inicioMesBuenosAires(periodo),
      inicioMesBuenosAires(sumarMeses(periodo, 1)),
      n,
    );
  }

  /** Productos con ventas en el rango, ordenados por margen bruto generado (HU-09 por semana). */
  async topEntre(desde: Date, hasta: Date, n: number): Promise<TopRentable[]> {
    const { comercioId } = TenantContext.requerido();
    const filas = await this.prisma.transaccionTenant(
      (tx) =>
        tx.$queryRaw<FilaRentabilidad[]>`
        SELECT p.id, p.codigo, p.nombre,
               p.precio_venta::text AS "precioVenta",
               p.alicuota_iva::text AS "alicuotaIva",
               p.costo_reposicion::text AS "costoReposicion",
               v.unidades
        FROM producto p
        JOIN LATERAL (
          SELECT COALESCE(SUM(m.cantidad), 0)::int AS unidades
          FROM movimiento m
          WHERE m.producto_id = p.id AND m.tipo = 'VENTA' AND m.anulado_por_id IS NULL
            AND m.fecha >= ${desde} AND m.fecha < ${hasta}
        ) v ON true
        WHERE p.comercio_id = ${comercioId}::uuid AND p.activo AND v.unidades > 0
        ORDER BY (p.precio_venta / (1 + p.alicuota_iva / 100) - p.costo_reposicion) * v.unidades DESC,
                 p.nombre ASC
        LIMIT ${n}`,
    );
    return filas.map((f) => {
      const r = this.aRentabilidad(f, null);
      return {
        producto: r.producto,
        unidadesVendidas: r.unidadesVendidas,
        margenBruto: r.margenBruto,
        margenBrutoPct: r.margenBrutoPct,
        margenBrutoMes: r.margenBrutoMes,
      };
    });
  }

  private aRentabilidad(f: FilaRentabilidad, gastoPorUnidad: string | null): RentabilidadProducto {
    const neto = precioNeto(f.precioVenta, f.alicuotaIva);
    const bruto = margenBruto(neto, f.costoReposicion);
    const margenNetoUnitario = margenNeto(bruto, gastoPorUnidad);
    return {
      producto: { id: f.id, codigo: f.codigo, nombre: f.nombre },
      precioVenta: Number(f.precioVenta).toFixed(2),
      alicuotaIva: Number(f.alicuotaIva).toString(),
      precioNeto: neto,
      costoReposicion: Number(f.costoReposicion).toFixed(2),
      margenBruto: bruto,
      margenBrutoPct: porcentaje(bruto, neto),
      unidadesVendidas: f.unidades,
      margenBrutoMes: redondear2(Number(bruto) * f.unidades),
      margenNeto: margenNetoUnitario,
      margenNetoPct: margenNetoUnitario === null ? null : porcentaje(margenNetoUnitario, neto),
    };
  }

  private mesActualBuenosAires(): Mes {
    const ahora = new Date();
    return mesActual(new Date(ahora.getTime() + (ahora.getTimezoneOffset() - 180) * 60_000));
  }
}
