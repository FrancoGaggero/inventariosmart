import { Injectable } from '@nestjs/common';
import {
  aplicaAlMes,
  importeDelMes,
  mesActual,
  prorratear,
  sumarMeses,
  totalizar,
  validarCoherencia,
  type Gasto,
  type GastoCreate,
  type GastoDelMes,
  type GastoPatch,
  type GastosQuery,
  type ListaGastosMes,
  type Mes,
  type ResumenGastos,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { noEncontrado, validacion } from '../common/errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Zona horaria del contrato: Argentina no tiene horario de verano, así que el desfase es fijo. */
const DESFASE_BUENOS_AIRES = '-03:00';

/** Primer día del mes como fecha (columnas DATE). */
export function mesADate(mes: Mes): Date {
  return new Date(`${mes}-01T00:00:00Z`);
}

/** Fecha DATE → YYYY-MM. */
export function dateAMes(d: Date): Mes {
  return d.toISOString().slice(0, 7);
}

/** Instante UTC en que empieza un mes en Buenos Aires (D3). */
export function inicioMesBuenosAires(mes: Mes): Date {
  return new Date(`${mes}-01T00:00:00${DESFASE_BUENOS_AIRES}`);
}

const INCLUIR_USUARIO = { usuario: { select: { id: true, nombre: true } } } as const;

type GastoRow = Prisma.GastoGetPayload<{ include: typeof INCLUIR_USUARIO }>;

export function aGasto(g: GastoRow): Gasto {
  return {
    id: g.id,
    concepto: g.concepto,
    tipo: g.tipo,
    importe: Number(g.importe).toFixed(2),
    periodo: dateAMes(g.periodo),
    periodicidad: g.periodicidad,
    fin: g.fin ? dateAMes(g.fin) : null,
    notas: g.notas,
    usuario: g.usuario,
    creadoEn: g.creadoEn.toISOString(),
    actualizadoEn: g.actualizadoEn.toISOString(),
  };
}

const MENSAJE_NO_ENCONTRADO = 'No encontramos ese gasto en tu comercio.';

/** Gastos operativos y prorrateo del período (HU-13, RN-02). */
@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Gastos que aplican a un mes, con el importe de ese mes y los totales (CP-13.2). */
  async listarMes(q: GastosQuery): Promise<ListaGastosMes> {
    const periodo = q.periodo ?? mesActual(this.ahoraBuenosAires());
    const inicio = mesADate(periodo);
    const filas = await this.prisma.tenant.gasto.findMany({
      where: {
        periodo: { lte: inicio },
        OR: [{ fin: null }, { fin: { gte: inicio } }],
        ...(q.tipo ? { tipo: q.tipo } : {}),
      },
      include: INCLUIR_USUARIO,
      orderBy: [{ tipo: 'asc' }, { concepto: 'asc' }],
    });
    const items: GastoDelMes[] = filas
      .map(aGasto)
      .filter((g) => aplicaAlMes(g, periodo))
      .map((g) => ({ ...g, importeMes: importeDelMes(g) }));
    return { periodo, items, totales: totalizar(items) };
  }

  /** Total del mes, unidades vendidas y gasto por unidad (CP-13.3, CP-13.5). */
  async resumen(periodo: Mes | undefined): Promise<ResumenGastos> {
    const mes = periodo ?? mesActual(this.ahoraBuenosAires());
    const { totales } = await this.listarMes({ periodo: mes });
    const { comercioId } = TenantContext.requerido();
    const desde = inicioMesBuenosAires(mes);
    const hasta = inicioMesBuenosAires(sumarMeses(mes, 1));
    const [fila] = await this.prisma.transaccionTenant(
      (tx) =>
        tx.$queryRaw<{ unidades: number }[]>`
        SELECT COALESCE(SUM(cantidad), 0)::int AS unidades
        FROM movimiento
        WHERE comercio_id = ${comercioId}::uuid AND tipo = 'VENTA'
          AND anulado_por_id IS NULL AND fecha >= ${desde} AND fecha < ${hasta}`,
    );
    const unidadesVendidas = fila?.unidades ?? 0;
    return {
      periodo: mes,
      totalFijos: totales.fijos,
      totalVariables: totales.variables,
      total: totales.total,
      unidadesVendidas,
      ...prorratear(totales.total, unidadesVendidas),
    };
  }

  async obtener(id: string): Promise<Gasto> {
    const g = await this.prisma.tenant.gasto.findFirst({ where: { id }, include: INCLUIR_USUARIO });
    if (!g) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
    return aGasto(g);
  }

  async crear(dto: GastoCreate): Promise<Gasto> {
    const { comercioId, usuarioId } = TenantContext.requerido();
    const creado = await this.prisma.tenant.gasto.create({
      data: {
        comercioId,
        usuarioId,
        concepto: dto.concepto,
        tipo: dto.tipo,
        importe: dto.importe,
        periodo: mesADate(dto.periodo),
        periodicidad: dto.periodicidad,
        fin: dto.fin ? mesADate(dto.fin) : null,
        notas: dto.notas ?? null,
      },
      include: INCLUIR_USUARIO,
    });
    return aGasto(creado);
  }

  /** Edición: la coherencia período/fin/periodicidad se revalida con los valores resultantes. */
  async actualizar(id: string, patch: GastoPatch): Promise<Gasto> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const actual = await tx.gasto.findFirst({ where: { id, comercioId } });
      if (!actual) throw noEncontrado(MENSAJE_NO_ENCONTRADO);

      const resultante = {
        periodicidad: patch.periodicidad ?? actual.periodicidad,
        periodo: patch.periodo ?? dateAMes(actual.periodo),
        fin: patch.fin === undefined ? (actual.fin ? dateAMes(actual.fin) : null) : patch.fin,
      };
      const error = validarCoherencia(resultante);
      if (error) throw validacion('Los datos enviados no son válidos.', { fin: error });

      const data: Prisma.GastoUpdateInput = {};
      if (patch.concepto !== undefined) data.concepto = patch.concepto;
      if (patch.tipo !== undefined) data.tipo = patch.tipo;
      if (patch.importe !== undefined) data.importe = patch.importe;
      if (patch.periodo !== undefined) data.periodo = mesADate(patch.periodo);
      if (patch.periodicidad !== undefined) data.periodicidad = patch.periodicidad;
      if (patch.fin !== undefined) data.fin = patch.fin ? mesADate(patch.fin) : null;
      if (patch.notas !== undefined) data.notas = patch.notas;

      const actualizado = await tx.gasto.update({ where: { id }, data, include: INCLUIR_USUARIO });
      return aGasto(actualizado);
    });
  }

  /** Borrado físico: los gastos no forman parte del historial inmutable. */
  async eliminar(id: string): Promise<void> {
    const { comercioId } = TenantContext.requerido();
    await this.prisma.transaccionTenant(async (tx) => {
      const actual = await tx.gasto.findFirst({ where: { id, comercioId }, select: { id: true } });
      if (!actual) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
      await tx.gasto.delete({ where: { id } });
    });
  }

  /** "Ahora" desplazado a Buenos Aires, para que `mesActual` use el mes local del comercio. */
  private ahoraBuenosAires(): Date {
    const ahora = new Date();
    return new Date(ahora.getTime() + (ahora.getTimezoneOffset() - 180) * 60_000);
  }
}
