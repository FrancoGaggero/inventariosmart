import { Injectable } from '@nestjs/common';
import {
  calcularItem,
  precioPorMargenObjetivo,
  precioPorPorcentaje,
  resumirRemarcacion,
  type EstadoPrecio,
  type ItemRemarcacion,
  type ListaLotes,
  type LoteRemarcacion,
  type LoteRemarcacionDetalle,
  type LotesQuery,
  type ParametrosRemarcacion,
  type ProductoCambiado,
  type ProductoInflacion,
  type RemarcacionApply,
  type RemarcacionPreview,
  type ResultadoReversion,
  type VistaPreviaRemarcacion,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { conflicto, noEncontrado, validacion } from '../common/errors';
import { Prisma } from '../generated/prisma/client';
import { InsightsService } from '../insights/insights.service';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';
import { registrarPreciosVenta } from '../products/price-history';

/** Producto activo con lo que la remarcación necesita. */
interface FilaProducto {
  id: string;
  codigo: string;
  nombre: string;
  precioVenta: string;
  costoReposicion: string;
  alicuotaIva: string;
}

/** Producto bloqueado dentro de la transacción que aplica o deshace. */
interface FilaBloqueada {
  id: string;
  codigo: string;
  nombre: string;
  precioVenta: string;
  alicuotaIva: string;
  activo: boolean;
}

const INCLUIR_LOTE = {
  usuario: { select: { id: true, nombre: true } },
  revertidoPor: { select: { id: true, nombre: true } },
} satisfies Prisma.RemarcacionInclude;

type LoteRow = Prisma.RemarcacionGetPayload<{ include: typeof INCLUIR_LOTE }>;

const MENSAJE_NO_ENCONTRADO = 'No encontramos esa remarcación en tu comercio.';
const dinero = (v: string | number | Prisma.Decimal) => Number(v).toFixed(2);

function aLote(l: LoteRow): LoteRemarcacion {
  return {
    id: l.id,
    criterio: l.criterio,
    parametros: (l.parametros ?? {}) as ParametrosRemarcacion,
    cantidad: l.cantidad,
    usuario: l.usuario,
    creadoEn: l.creadoEn.toISOString(),
    revertidoEn: l.revertidoEn?.toISOString() ?? null,
    revertidoPor: l.revertidoPor,
    revertidos: l.revertidos,
    omitidos: l.omitidos,
  };
}

/** Parámetros que quedan guardados en el lote: sólo los que aplican al criterio. */
function parametrosDe(dto: RemarcacionPreview): ParametrosRemarcacion {
  return {
    ...(dto.criterio === 'PORCENTAJE' ? { porcentaje: dto.porcentaje } : {}),
    ...(dto.criterio === 'MARGEN_OBJETIVO' ? { margen: dto.margen } : {}),
    redondeo: dto.redondeo,
    permitirBajas: dto.permitirBajas,
    ...(dto.desde ? { desde: dto.desde } : {}),
    ...(dto.hasta ? { hasta: dto.hasta } : {}),
  };
}

/**
 * Remarcación asistida (HU-17, RN-12). La vista previa no escribe; aplicar y deshacer son
 * atómicos y dejan rastro en el historial de precios y en el lote.
 */
@Injectable()
export class RepricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
  ) {}

  /** Precio nuevo de cada producto según el criterio (CP-17.1 a CP-17.2). Sólo lectura. */
  async vistaPrevia(dto: RemarcacionPreview): Promise<VistaPreviaRemarcacion> {
    const { comercioId } = TenantContext.requerido();
    const usaInflacion =
      dto.criterio === 'INFLACION' || dto.criterio === 'MARGEN' || dto.estado !== undefined;
    const comparacion = usaInflacion
      ? await this.insights.inflacion({ desde: dto.desde, hasta: dto.hasta })
      : null;
    const frenteAInflacion = new Map<string, ProductoInflacion>(
      comparacion?.productos.map((p) => [p.producto.id, p]) ?? [],
    );

    const productos = await this.prisma.transaccionTenant((tx) =>
      tx.$queryRaw<FilaProducto[]>(Prisma.sql`
        SELECT p.id, p.codigo, p.nombre, p.precio_venta::text AS "precioVenta",
               p.costo_reposicion::text AS "costoReposicion", p.alicuota_iva::text AS "alicuotaIva"
        FROM producto p
        WHERE p.comercio_id = ${comercioId}::uuid AND p.activo
          ${dto.productoIds ? Prisma.sql`AND p.id = ANY(${dto.productoIds}::uuid[])` : Prisma.empty}
        ORDER BY p.nombre ASC, p.id ASC`),
    );

    const items: ItemRemarcacion[] = [];
    for (const p of productos) {
      const inflacion = frenteAInflacion.get(p.id);
      const estado: EstadoPrecio | null = inflacion?.estado ?? null;
      if (dto.estado !== undefined && estado !== dto.estado) continue;
      items.push({
        producto: { id: p.id, codigo: p.codigo, nombre: p.nombre },
        precioActual: dinero(p.precioVenta),
        costo: dinero(p.costoReposicion),
        alicuotaIva: Number(p.alicuotaIva).toString(),
        estado,
        ...calcularItem({
          precioActual: p.precioVenta,
          costo: p.costoReposicion,
          alicuotaIva: p.alicuotaIva,
          precioCalculado: this.precioSegunCriterio(dto, p, inflacion),
          redondeo: dto.redondeo,
          permitirBajas: dto.permitirBajas,
        }),
      });
    }

    return {
      criterio: dto.criterio,
      parametros: {
        ...parametrosDe(dto),
        ...(comparacion ? { desde: comparacion.desde, hasta: comparacion.hasta } : {}),
      },
      items,
      resumen: resumirRemarcacion(items),
      motivo:
        dto.criterio === 'INFLACION' && comparacion?.variaciones.ipc === null ? 'SIN_IPC' : null,
    };
  }

  private precioSegunCriterio(
    dto: RemarcacionPreview,
    p: FilaProducto,
    inflacion: ProductoInflacion | undefined,
  ): number | null {
    switch (dto.criterio) {
      case 'INFLACION':
        return inflacion?.precioSugeridoInflacion
          ? Number(inflacion.precioSugeridoInflacion)
          : null;
      case 'MARGEN':
        return inflacion ? Number(inflacion.precioSugeridoMargen) : null;
      case 'PORCENTAJE':
        return precioPorPorcentaje(p.precioVenta, dto.porcentaje);
      case 'MARGEN_OBJETIVO':
        return precioPorMargenObjetivo(p.costoReposicion, dto.margen, p.alicuotaIva);
    }
  }

  /**
   * Aplica la remarcación completa o no aplica nada (RN-12, CP-17.3). El precio actual enviado
   * tiene que coincidir con el de la base: si cambió desde la vista previa, responde 409.
   */
  async aplicar(dto: RemarcacionApply): Promise<LoteRemarcacionDetalle> {
    const { comercioId, usuarioId } = TenantContext.requerido();
    const id = await this.prisma.transaccionTenant(async (tx) => {
      const ids = dto.items.map((i) => i.productoId);
      const porId = await this.bloquearProductos(tx, comercioId, ids);
      if (porId.size !== ids.length) {
        throw noEncontrado('Alguno de los productos no existe en tu comercio.');
      }
      const inactivos = dto.items.filter((i) => !porId.get(i.productoId)!.activo);
      if (inactivos.length > 0) {
        throw validacion('Hay productos dados de baja en la remarcación.', {
          items: `Quitá los productos dados de baja: ${inactivos
            .slice(0, 5)
            .map((i) => porId.get(i.productoId)!.codigo)
            .join(', ')}.`,
        });
      }
      const cambiados: ProductoCambiado[] = dto.items
        .map((i) => ({ item: i, p: porId.get(i.productoId)! }))
        .filter(({ item, p }) => Number(p.precioVenta) !== Number(item.precioActual))
        .map(({ p }) => ({
          productoId: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          precioActual: dinero(p.precioVenta),
        }));
      if (cambiados.length > 0) {
        throw conflicto(
          cambiados.length === 1
            ? `El precio de ${cambiados[0]!.nombre} cambió desde la vista previa. No se aplicó nada: volvé a calcular.`
            : `El precio de ${cambiados.length} productos cambió desde la vista previa. No se aplicó nada: volvé a calcular.`,
          { productos: cambiados },
        );
      }
      // El control anterior garantiza que el precio nuevo difiere del de la base.
      await this.escribirPrecios(
        tx,
        comercioId,
        usuarioId,
        dto.items.map((i) => ({
          productoId: i.productoId,
          precio: dinero(i.precioNuevo),
          alicuotaIva: porId.get(i.productoId)!.alicuotaIva,
        })),
      );
      const lote = await tx.remarcacion.create({
        data: {
          comercioId,
          usuarioId,
          criterio: dto.criterio,
          parametros: dto.parametros,
          cantidad: dto.items.length,
        },
        select: { id: true },
      });
      await tx.$executeRaw`
        INSERT INTO remarcacion_item
          (id, comercio_id, remarcacion_id, producto_id, precio_anterior, precio_nuevo)
        SELECT gen_random_uuid(), ${comercioId}::uuid, ${lote.id}::uuid, v.producto,
               v.anterior::numeric, v.nuevo::numeric
        FROM unnest(
          ${dto.items.map((i) => i.productoId)}::uuid[],
          ${dto.items.map((i) => dinero(i.precioActual))}::text[],
          ${dto.items.map((i) => dinero(i.precioNuevo))}::text[]
        ) AS v(producto, anterior, nuevo)`;
      return lote.id;
    });
    return this.obtener(id);
  }

  /** Lotes del comercio, del más reciente al más antiguo (CP-17.4). */
  async listar(q: LotesQuery): Promise<ListaLotes> {
    const filas = await this.prisma.tenant.remarcacion.findMany({
      include: INCLUIR_LOTE,
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hayMas = filas.length > q.limit;
    const pagina = hayMas ? filas.slice(0, q.limit) : filas;
    const ultimo = pagina[pagina.length - 1];
    return { items: pagina.map(aLote), siguienteCursor: hayMas && ultimo ? ultimo.id : null };
  }

  async obtener(id: string): Promise<LoteRemarcacionDetalle> {
    const lote = await this.prisma.tenant.remarcacion.findFirst({
      where: { id },
      include: {
        ...INCLUIR_LOTE,
        items: {
          include: { producto: { select: { id: true, codigo: true, nombre: true } } },
          orderBy: [{ producto: { nombre: 'asc' } }, { id: 'asc' }],
        },
      },
    });
    if (!lote) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
    return {
      ...aLote(lote),
      items: lote.items.map((i) => ({
        producto: i.producto,
        precioAnterior: dinero(i.precioAnterior),
        precioNuevo: dinero(i.precioNuevo),
        revertido: i.revertido,
      })),
    };
  }

  /**
   * Deshace un lote una sola vez (RN-12, CP-17.4b): vuelven al precio anterior los productos
   * que siguen con el precio remarcado; los que cambiaron después no se tocan.
   */
  async deshacer(id: string): Promise<ResultadoReversion> {
    const { comercioId, usuarioId } = TenantContext.requerido();
    const productosOmitidos = await this.prisma.transaccionTenant(async (tx) => {
      const lote = await tx.remarcacion.findFirst({
        where: { id, comercioId },
        include: { items: true },
      });
      if (!lote) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
      const ahora = new Date();
      // updateMany con condición: dos pedidos simultáneos no deshacen los dos.
      const tomado = await tx.remarcacion.updateMany({
        where: { id, comercioId, revertidoEn: null },
        data: { revertidoEn: ahora, revertidoPorId: usuarioId },
      });
      if (tomado.count === 0) throw conflicto('Esta remarcación ya se deshizo.');

      const porId = await this.bloquearProductos(
        tx,
        comercioId,
        lote.items.map((i) => i.productoId),
      );
      const revertir: typeof lote.items = [];
      const omitidos: ResultadoReversion['productosOmitidos'] = [];
      for (const item of lote.items) {
        const p = porId.get(item.productoId);
        if (!p) continue;
        if (!p.activo || Number(p.precioVenta) !== Number(item.precioNuevo)) {
          omitidos.push({
            producto: { id: p.id, codigo: p.codigo, nombre: p.nombre },
            precioActual: dinero(p.precioVenta),
            motivo: p.activo ? 'El precio cambió después de la remarcación.' : 'Está dado de baja.',
          });
        } else {
          revertir.push(item);
        }
      }
      if (revertir.length > 0) {
        await this.escribirPrecios(
          tx,
          comercioId,
          usuarioId,
          revertir.map((i) => ({
            productoId: i.productoId,
            precio: dinero(i.precioAnterior),
            alicuotaIva: porId.get(i.productoId)!.alicuotaIva,
          })),
        );
        await tx.remarcacionItem.updateMany({
          where: { comercioId, id: { in: revertir.map((i) => i.id) } },
          data: { revertido: true },
        });
      }
      await tx.remarcacion.updateMany({
        where: { id, comercioId },
        data: { revertidos: revertir.length, omitidos: lote.items.length - revertir.length },
      });
      return omitidos;
    });
    return { ...(await this.obtener(id)), productosOmitidos };
  }

  /** Bloquea los productos en una sola consulta: serializa remarcaciones simultáneas. */
  private async bloquearProductos(
    tx: TransaccionRaw,
    comercioId: string,
    ids: string[],
  ): Promise<Map<string, FilaBloqueada>> {
    const filas = await tx.$queryRaw<FilaBloqueada[]>`
      SELECT p.id, p.codigo, p.nombre, p.precio_venta::text AS "precioVenta",
             p.alicuota_iva::text AS "alicuotaIva", p.activo
      FROM producto p
      WHERE p.comercio_id = ${comercioId}::uuid AND p.id = ANY(${ids}::uuid[])
      ORDER BY p.id
      FOR UPDATE`;
    return new Map(filas.map((f) => [f.id, f]));
  }

  /** Actualiza los precios en una sentencia y deja su fila en el historial (CP-15.2e). */
  private async escribirPrecios(
    tx: TransaccionRaw,
    comercioId: string,
    usuarioId: string,
    cambios: { productoId: string; precio: string; alicuotaIva: string }[],
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE producto p
      SET precio_venta = v.precio::numeric, actualizado_en = now()
      FROM unnest(
        ${cambios.map((c) => c.productoId)}::uuid[],
        ${cambios.map((c) => c.precio)}::text[]
      ) AS v(id, precio)
      WHERE p.id = v.id AND p.comercio_id = ${comercioId}::uuid`;
    await registrarPreciosVenta(
      tx,
      { comercioId, origen: 'REMARCACION', usuarioId },
      cambios.map((c) => ({
        productoId: c.productoId,
        precioVenta: c.precio,
        alicuotaIva: c.alicuotaIva,
      })),
    );
  }
}
