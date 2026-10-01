import { Inject, Injectable } from '@nestjs/common';
import {
  DIA_MS,
  type EventoStock,
  type ListaQuiebres,
  type ProductoConQuiebres,
  type StockoutsQuery,
  type TotalesQuiebres,
  VENTANA_DEMANDA_DIAS,
  diasConStock,
  diasDe,
  estimarPerdida,
  ordenarQuiebres,
  recortarTramos,
  totalizarQuiebres,
  tramosSinStock,
  unDecimal,
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
  precioVenta: string;
  alicuotaIva: string;
  costoReposicion: string;
}

/**
 * Un movimiento que cambia el stock entre cero y positivo (o el primero de la ventana), con los
 * totales de la ventana de su producto: lo que se movió y lo que se vendió sin anular.
 */
interface FilaCambio {
  productoId: string;
  creadoEn: Date;
  stockResultante: number;
  efecto: number;
  vendidas: number;
}

interface Calculo {
  desde: Date;
  hasta: Date;
  items: ProductoConQuiebres[];
}

/**
 * Pérdidas por falta de stock (HU-18, RN-14). Los quiebres se reconstruyen en cada consulta con el
 * stock que dejó cada movimiento de los últimos 90 días (design D1, D2): nada se guarda.
 */
@Injectable()
export class StockoutsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  /** Productos con quiebres en el período, por ganancia perdida, con cursor de posición (D5). */
  async listar(q: StockoutsQuery): Promise<ListaQuiebres> {
    const desdePos = q.cursor ? this.posicion(q.cursor) : 0;
    const { desde, hasta, items } = await this.calcular(q.dias);
    const pagina = items.slice(desdePos, desdePos + q.limit);
    const hayMas = desdePos + q.limit < items.length;
    return {
      dias: q.dias,
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      totales: totalizarQuiebres(items),
      items: pagina,
      siguienteCursor: hayMas ? codificarCursor([String(desdePos + q.limit)]) : null,
    };
  }

  /** Sólo los totales: el bloque del panel (D7). */
  async totales(dias: number): Promise<TotalesQuiebres> {
    return totalizarQuiebres((await this.calcular(dias)).items);
  }

  private async calcular(dias: number): Promise<Calculo> {
    const ahora = this.reloj();
    const { comercioId } = TenantContext.requerido();
    const inicioVentana = new Date(ahora.getTime() - VENTANA_DEMANDA_DIAS * DIA_MS);
    const desde = new Date(ahora.getTime() - dias * DIA_MS);

    const { productos, cambios, efecto, conHistoria } = await this.prisma.transaccionTenant(
      async (tx) => {
        const productos = await tx.$queryRaw<FilaProducto[]>(Prisma.sql`
          SELECT p.id, p.codigo, p.nombre, p.stock_actual AS "stockActual",
                 p.precio_venta::text AS "precioVenta", p.alicuota_iva::text AS "alicuotaIva",
                 p.costo_reposicion::text AS "costoReposicion"
          FROM producto p
          WHERE p.comercio_id = ${comercioId}::uuid AND p.activo`);
        // Sólo viajan los movimientos que cambian el stock entre cero y positivo: los demás no
        // cortan ningún tramo. Los totales por producto se suman en la misma pasada.
        const cambios = await tx.$queryRaw<FilaCambio[]>(Prisma.sql`
          SELECT x."productoId", x."creadoEn", x."stockResultante", x.efecto, x.vendidas
          FROM (
            SELECT m.producto_id AS "productoId", m.creado_en AS "creadoEn", m.id,
                   m.stock_resultante AS "stockResultante",
                   lag(m.stock_resultante) OVER orden AS previo,
                   (sum(m.efecto_stock) OVER producto)::int AS efecto,
                   (sum(m.cantidad) FILTER (WHERE m.tipo = 'VENTA' AND m.anulado_por_id IS NULL)
                      OVER producto)::int AS vendidas
            FROM movimiento m
            WHERE m.comercio_id = ${comercioId}::uuid AND m.creado_en >= ${inicioVentana}
            WINDOW orden AS (PARTITION BY m.producto_id ORDER BY m.creado_en, m.id),
                   producto AS (PARTITION BY m.producto_id)
          ) x
          WHERE x.previo IS NULL OR (x."stockResultante" > 0) <> (x.previo > 0)
          ORDER BY x."creadoEn", x.id`);

        // Stock al inicio de la ventana = stock actual − lo que movieron los movimientos de la
        // ventana. Los que arrancan en 0 son quiebre sólo si tuvieron stock antes (D2, consulta 3).
        const efecto = new Map(cambios.map((c) => [c.productoId, c.efecto]));
        const enCeroAlInicio = productos
          .filter((p) => p.stockActual - (efecto.get(p.id) ?? 0) <= 0)
          .map((p) => p.id);
        const conHistoria =
          enCeroAlInicio.length === 0
            ? []
            : await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
                SELECT c.id
                FROM unnest(${enCeroAlInicio}::uuid[]) AS c(id)
                WHERE EXISTS (
                  SELECT 1 FROM movimiento m
                  WHERE m.comercio_id = ${comercioId}::uuid AND m.producto_id = c.id
                    AND m.creado_en < ${inicioVentana})`);
        return { productos, cambios, efecto, conHistoria };
      },
    );

    const eventos = new Map<string, EventoStock[]>();
    const ventas = new Map<string, number>();
    for (const c of cambios) {
      const lista = eventos.get(c.productoId) ?? [];
      lista.push({ instante: c.creadoEn, stockResultante: c.stockResultante });
      eventos.set(c.productoId, lista);
      ventas.set(c.productoId, c.vendidas ?? 0);
    }
    const teniaStock = new Set(conHistoria.map((c) => c.id));

    const items: ProductoConQuiebres[] = [];
    for (const p of productos) {
      const stockInicial = p.stockActual - (efecto.get(p.id) ?? 0);
      const evs = eventos.get(p.id) ?? [];
      const tramos = tramosSinStock(
        stockInicial,
        evs,
        inicioVentana,
        ahora,
        stockInicial > 0 || teniaStock.has(p.id),
      );
      const enPeriodo = recortarTramos(tramos, desde, ahora);
      if (enPeriodo.length === 0) continue;
      const diasSinStock = diasDe(enPeriodo);
      const ultimo = enPeriodo.at(-1)!;
      const perdida = estimarPerdida({
        diasSinStock,
        diasConStock: diasConStock(stockInicial, evs, inicioVentana, ahora),
        unidadesVendidas: ventas.get(p.id) ?? 0,
        precioVenta: p.precioVenta,
        alicuotaIva: p.alicuotaIva,
        costo: p.costoReposicion,
      });
      items.push({
        producto: { id: p.id, codigo: p.codigo, nombre: p.nombre },
        quiebres: enPeriodo.length,
        diasSinStock: unDecimal(diasSinStock),
        enCurso: ultimo.enCurso,
        // Inicio del último quiebre, aunque sea anterior al período; como mucho, el de la ventana.
        inicioUltimo: tramos.at(-1)!.desde.toISOString(),
        ...perdida,
      });
    }
    return { desde, hasta: ahora, items: ordenarQuiebres(items) };
  }

  /** La lista se ordena en memoria por ganancia perdida: el cursor es la posición (D5). */
  private posicion(cursor: string): number {
    const n = Number(decodificarCursor(cursor, 1)[0]);
    if (!Number.isInteger(n) || n < 0) {
      throw validacion('El cursor de paginación no es válido.', { cursor: 'Cursor inválido.' });
    }
    return n;
  }
}
