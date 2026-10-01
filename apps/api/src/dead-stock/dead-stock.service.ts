import { Inject, Injectable } from '@nestjs/common';
import {
  DIA_MS,
  type DeadStockQuery,
  type ListaStockParado,
  type ProductoParado,
  type TotalesStockParado,
  capitalParado,
  diasSinVender,
  ordenarStockParado,
  redondear2,
  totalizarStockParado,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { codificarCursor, decodificarCursor } from '../common/cursor';
import { validacion } from '../common/errors';
import { RELOJ, type Reloj } from '../common/reloj';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface FilaProducto {
  id: string;
  codigo: string;
  nombre: string;
  stockActual: number;
  costoReposicion: string;
  creadoEn: Date;
}

interface Calculo {
  desde: Date;
  hasta: Date;
  items: ProductoParado[];
  valorizacion: string;
}

/**
 * Stock parado (HU-19, RN-15): productos activos con stock y sin ventas en el período. Se calcula
 * al consultar con tres consultas de una tabla y el cruce en memoria (design D1): nada se guarda.
 */
@Injectable()
export class DeadStockService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  /** Productos parados por capital, con cursor de posición (D4). */
  async listar(q: DeadStockQuery): Promise<ListaStockParado> {
    const inicio = q.cursor ? this.posicion(q.cursor) : 0;
    const { desde, hasta, items, valorizacion } = await this.calcular(q.dias);
    const hayMas = inicio + q.limit < items.length;
    return {
      dias: q.dias,
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      totales: totalizarStockParado(items, valorizacion),
      items: items.slice(inicio, inicio + q.limit),
      siguienteCursor: hayMas ? codificarCursor([String(inicio + q.limit)]) : null,
    };
  }

  /** Sólo los totales: el bloque del panel (D6). */
  async totales(dias: number): Promise<TotalesStockParado> {
    const { items, valorizacion } = await this.calcular(dias);
    return totalizarStockParado(items, valorizacion);
  }

  private async calcular(dias: number): Promise<Calculo> {
    const { comercioId } = TenantContext.requerido();
    const ahora = this.reloj();
    const desde = new Date(ahora.getTime() - dias * DIA_MS);

    const { productos, ultimas } = await this.prisma.transaccionTenant(async (tx) => {
      const productos = await tx.$queryRaw<FilaProducto[]>(Prisma.sql`
        SELECT p.id, p.codigo, p.nombre, p.stock_actual AS "stockActual",
               p.costo_reposicion::text AS "costoReposicion", p.creado_en AS "creadoEn"
        FROM producto p
        WHERE p.comercio_id = ${comercioId}::uuid AND p.activo`);
      // Por la fecha del hecho: una venta cargada tarde cuenta el día en que ocurrió (D2).
      const conVentas = await tx.$queryRaw<{ productoId: string }[]>(Prisma.sql`
        SELECT DISTINCT m.producto_id AS "productoId"
        FROM movimiento m
        WHERE m.comercio_id = ${comercioId}::uuid AND m.tipo = 'VENTA'
          AND m.anulado_por_id IS NULL AND m.fecha >= ${desde}`);
      const vendieron = new Set(conVentas.map((v) => v.productoId));
      const candidatos = productos
        .filter((p) => p.stockActual > 0 && p.creadoEn < desde && !vendieron.has(p.id))
        .map((p) => p.id);
      const ultimas =
        candidatos.length === 0
          ? []
          : await tx.$queryRaw<{ id: string; ultima: Date | null }[]>(Prisma.sql`
              SELECT c.id, (
                SELECT max(m.fecha) FROM movimiento m
                WHERE m.comercio_id = ${comercioId}::uuid AND m.producto_id = c.id
                  AND m.tipo = 'VENTA' AND m.anulado_por_id IS NULL
              ) AS ultima
              FROM unnest(${candidatos}::uuid[]) AS c(id)`);
      return { productos, ultimas };
    });

    const ultimaDe = new Map(ultimas.map((u) => [u.id, u.ultima]));
    const items: ProductoParado[] = [];
    let valorizacion = 0;
    for (const p of productos) {
      valorizacion += p.stockActual * Number(p.costoReposicion);
      // Sólo los candidatos tienen última venta consultada: son los parados.
      if (!ultimaDe.has(p.id)) continue;
      const ultima = ultimaDe.get(p.id) ?? null;
      items.push({
        producto: { id: p.id, codigo: p.codigo, nombre: p.nombre },
        stock: p.stockActual,
        costoReposicion: Number(p.costoReposicion).toFixed(2),
        capitalParado: capitalParado(p.stockActual, p.costoReposicion),
        ultimaVenta: ultima ? ultima.toISOString() : null,
        diasSinVender: diasSinVender(ultima, p.creadoEn, ahora),
      });
    }
    return {
      desde,
      hasta: ahora,
      items: ordenarStockParado(items),
      valorizacion: redondear2(valorizacion),
    };
  }

  /** La lista se ordena en memoria por capital: el cursor es la posición (D4). */
  private posicion(cursor: string): number {
    const n = Number(decodificarCursor(cursor, 1)[0]);
    if (!Number.isInteger(n) || n < 0) {
      throw validacion('El cursor de paginación no es válido.', { cursor: 'Cursor inválido.' });
    }
    return n;
  }
}
