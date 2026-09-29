import { Injectable } from '@nestjs/common';
import {
  LIMITES_PLAN,
  evaluarCambioDePlan,
  funcionalidadesDe,
  mensajeCambioRechazado,
  type CambioPlan,
  type HistorialPlan,
  type HistorialPlanQuery,
  type Plan,
  type PlanDetalle,
  type UsoPlan,
} from '@inventariosmart/shared';
import { z } from 'zod';
import { TenantContext } from '../auth/tenant-context';
import { codificarCursor, decodificarCursor } from '../common/cursor';
import { conflicto, noEncontrado, validacion } from '../common/errors';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';

const aDetalle = (plan: Plan, uso: UsoPlan): PlanDetalle => ({
  plan,
  limites: LIMITES_PLAN[plan],
  uso,
  funcionalidades: funcionalidadesDe(plan),
});

/**
 * Gestión de plan (HU-14, RF-15). El plan se lee de la base en cada request, así que un cambio
 * rige desde el pedido siguiente. Cambiar de plan no toca datos de negocio: lo que pertenece a
 * un plan superior queda guardado.
 */
@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(): Promise<PlanDetalle> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const comercio = await tx.comercio.findFirst({
        where: { id: comercioId },
        select: { plan: true },
      });
      if (!comercio) throw noEncontrado('No encontramos tu comercio.');
      return aDetalle(comercio.plan, await this.uso(tx, comercioId));
    });
  }

  /** Cambio atómico (design D4): todo o nada, con su registro en el historial. */
  async cambiar(dto: CambioPlan): Promise<PlanDetalle> {
    const { comercioId, usuarioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      // El mismo bloqueo que usan las altas de productos: no entra un producto entre el
      // conteo y el cambio, ni dos cambios registran el mismo plan anterior.
      const [comercio] = await tx.$queryRaw<{ plan: Plan }[]>`
        SELECT plan FROM comercio WHERE id = ${comercioId}::uuid FOR UPDATE`;
      if (!comercio) throw noEncontrado('No encontramos tu comercio.');

      const uso = await this.uso(tx, comercioId);
      const evaluacion = evaluarCambioDePlan(comercio.plan, dto.plan, uso);
      if (!evaluacion.permitido) {
        throw conflicto(mensajeCambioRechazado(dto.plan, evaluacion), {
          motivo: evaluacion.motivo,
          excesos: evaluacion.excesos,
        });
      }

      await tx.comercio.update({ where: { id: comercioId }, data: { plan: dto.plan } });
      await tx.cambioPlan.create({
        data: { comercioId, usuarioId, planAnterior: comercio.plan, planNuevo: dto.plan },
      });
      return aDetalle(dto.plan, uso);
    });
  }

  /** Cambios de plan del comercio, del más reciente al más antiguo. */
  async historial(q: HistorialPlanQuery): Promise<HistorialPlan> {
    const { comercioId } = TenantContext.requerido();
    const cursor = q.cursor ? this.cursorDe(q.cursor) : null;
    const filas = await this.prisma.transaccionTenant((tx) =>
      tx.cambioPlan.findMany({
        where: {
          comercioId,
          ...(cursor
            ? {
                OR: [
                  { creadoEn: { lt: cursor.fecha } },
                  { creadoEn: cursor.fecha, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
        select: {
          id: true,
          planAnterior: true,
          planNuevo: true,
          creadoEn: true,
          usuario: { select: { id: true, nombre: true } },
        },
      }),
    );
    const pagina = filas.slice(0, q.limit);
    const ultima = pagina.at(-1);
    return {
      items: pagina.map((f) => ({
        id: f.id,
        planAnterior: f.planAnterior,
        planNuevo: f.planNuevo,
        usuario: f.usuario,
        creadoEn: f.creadoEn.toISOString(),
      })),
      siguienteCursor:
        filas.length > q.limit && ultima
          ? codificarCursor([ultima.creadoEn.toISOString(), ultima.id])
          : null,
    };
  }

  /** Productos y usuarios activos (design D3). */
  private async uso(tx: TransaccionRaw, comercioId: string): Promise<UsoPlan> {
    const productos = await tx.producto.count({ where: { comercioId, activo: true } });
    const usuarios = await tx.usuario.count({ where: { comercioId, activo: true } });
    return { productos, usuarios };
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
