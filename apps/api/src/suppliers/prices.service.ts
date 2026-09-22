import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  ItemPrecio,
  ListaPrecios,
  OrigenPrecio,
  PrecioProveedor,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { codificarCursor, decodificarCursor } from '../common/cursor';
import { conflicto, noEncontrado } from '../common/errors';
import { Prisma } from '../generated/prisma/client';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';

/** Fila del historial con producto, proveedor y usuario unidos. */
interface FilaPrecio {
  id: string;
  costoNeto: string;
  vigenteDesde: Date;
  origen: OrigenPrecio;
  loteId: string | null;
  creadoEn: Date;
  productoId: string;
  productoCodigo: string;
  productoNombre: string;
  proveedorId: string;
  proveedorNombre: string;
  usuarioId: string;
  usuarioNombre: string | null;
}

interface ProductoBloqueado {
  id: string;
  proveedorPrincipalId: string | null;
}

export interface Paginacion {
  cursor?: string | undefined;
  limit: number;
}

export interface RegistroPrecios {
  proveedorId: string;
  items: ItemPrecio[];
  origen: OrigenPrecio;
  loteId?: string | null;
  vigenteDesde?: string | null;
}

export interface ResultadoRegistroPrecios {
  filas: PrecioProveedor[];
  productosActualizados: number;
}

export function aPrecio(f: FilaPrecio): PrecioProveedor {
  return {
    id: f.id,
    producto: { id: f.productoId, codigo: f.productoCodigo, nombre: f.productoNombre },
    proveedor: { id: f.proveedorId, nombre: f.proveedorNombre },
    costoNeto: Number(f.costoNeto).toFixed(2),
    vigenteDesde: f.vigenteDesde.toISOString(),
    origen: f.origen,
    loteId: f.loteId,
    usuario: { id: f.usuarioId, nombre: f.usuarioNombre },
    creadoEn: f.creadoEn.toISOString(),
  };
}

const COLUMNAS = Prisma.sql`
  pp.id, pp.costo_neto::text AS "costoNeto", pp.vigente_desde AS "vigenteDesde",
  pp.origen, pp.lote_id AS "loteId", pp.creado_en AS "creadoEn",
  p.id AS "productoId", p.codigo AS "productoCodigo", p.nombre AS "productoNombre",
  pr.id AS "proveedorId", pr.nombre AS "proveedorNombre",
  u.id AS "usuarioId", u.nombre AS "usuarioNombre"`;

const DESDE = Prisma.sql`
  FROM precio_proveedor pp
  JOIN producto p ON p.id = pp.producto_id
  JOIN proveedor pr ON pr.id = pp.proveedor_id
  JOIN usuario u ON u.id = pp.usuario_id`;

/**
 * Historial de costos y regla RN-08 (design D4). Es el único lugar que escribe
 * `producto.costo_reposicion` a partir de HU-02.
 */
@Injectable()
export class PricesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Carga manual desde la API (CP-02.4). */
  async registrar(datos: RegistroPrecios): Promise<ResultadoRegistroPrecios> {
    return this.prisma.transaccionTenant((tx) => this.registrarEnTransaccion(tx, datos));
  }

  /**
   * Núcleo del registro, reutilizable dentro de otra transacción de tenant (edición del
   * costo desde el producto, importación).
   */
  async registrarEnTransaccion(
    tx: TransaccionRaw,
    datos: RegistroPrecios,
  ): Promise<ResultadoRegistroPrecios> {
    const { comercioId, usuarioId } = TenantContext.requerido();
    const proveedor = await this.proveedorActivo(tx, comercioId, datos.proveedorId);
    const ids = datos.items.map((i) => i.productoId);

    // Bloqueo de los productos afectados: serializa importaciones y ediciones manuales.
    const productos = await tx.$queryRaw<ProductoBloqueado[]>`
      SELECT id, proveedor_principal_id AS "proveedorPrincipalId"
      FROM producto WHERE comercio_id = ${comercioId}::uuid AND id = ANY(${ids}::uuid[])
      FOR UPDATE`;
    if (productos.length !== ids.length) {
      throw noEncontrado('Alguno de los productos no existe en tu comercio.');
    }
    const porId = new Map(productos.map((p) => [p.id, p]));

    // Última vigencia ya registrada por este proveedor para cada producto.
    const vigencias = await tx.$queryRaw<{ productoId: string; maxima: Date }[]>`
      SELECT producto_id AS "productoId", max(vigente_desde) AS maxima
      FROM precio_proveedor
      WHERE comercio_id = ${comercioId}::uuid AND proveedor_id = ${proveedor.id}::uuid
        AND producto_id = ANY(${ids}::uuid[])
      GROUP BY producto_id`;
    const maxima = new Map(vigencias.map((v) => [v.productoId, v.maxima]));

    const vigenteDesde = datos.vigenteDesde ? new Date(datos.vigenteDesde) : new Date();
    const filas = datos.items.map((item) => ({
      id: randomUUID(),
      comercioId,
      productoId: item.productoId,
      proveedorId: proveedor.id,
      costoNeto: item.costoNeto,
      vigenteDesde,
      origen: datos.origen,
      loteId: datos.loteId ?? null,
      usuarioId,
    }));
    await tx.precioProveedor.createMany({ data: filas });

    // RN-08: el costo vigente sigue a la última lista del proveedor principal.
    let productosActualizados = 0;
    for (const item of datos.items) {
      const producto = porId.get(item.productoId)!;
      const anterior = maxima.get(item.productoId);
      if (producto.proveedorPrincipalId === null) {
        await tx.producto.update({
          where: { id: producto.id },
          data: { proveedorPrincipalId: proveedor.id, costoReposicion: item.costoNeto },
          select: { id: true },
        });
        productosActualizados += 1;
      } else if (
        producto.proveedorPrincipalId === proveedor.id &&
        (!anterior || vigenteDesde.getTime() >= anterior.getTime())
      ) {
        await tx.producto.update({
          where: { id: producto.id },
          data: { costoReposicion: item.costoNeto },
          select: { id: true },
        });
        productosActualizados += 1;
      }
    }

    const creadas = await tx.$queryRaw<FilaPrecio[]>(
      Prisma.sql`SELECT ${COLUMNAS} ${DESDE}
        WHERE pp.id = ANY(${filas.map((f) => f.id)}::uuid[])
        ORDER BY p.nombre ASC, p.id ASC`,
    );
    return { filas: creadas.map(aPrecio), productosActualizados };
  }

  /** Lista vigente del proveedor: último costo por producto (CP-02.4). */
  async listaVigente(proveedorId: string, pag: Paginacion): Promise<ListaPrecios> {
    const { comercioId } = TenantContext.requerido();
    const cursor = pag.cursor ? decodificarCursor(pag.cursor, 2) : null;
    const filas = await this.prisma.transaccionTenant(async (tx) => {
      await this.proveedorDelComercio(tx, comercioId, proveedorId);
      const condicion = cursor
        ? Prisma.sql`WHERE (v."productoNombre", v."productoId") > (${cursor[0]}, ${cursor[1]}::uuid)`
        : Prisma.empty;
      return tx.$queryRaw<FilaPrecio[]>(
        Prisma.sql`SELECT * FROM (
            SELECT DISTINCT ON (pp.producto_id) ${COLUMNAS} ${DESDE}
            WHERE pp.comercio_id = ${comercioId}::uuid AND pp.proveedor_id = ${proveedorId}::uuid
            ORDER BY pp.producto_id, pp.vigente_desde DESC, pp.creado_en DESC
          ) v
          ${condicion}
          ORDER BY v."productoNombre" ASC, v."productoId" ASC
          LIMIT ${pag.limit + 1}`,
      );
    });
    return this.paginar(filas, pag.limit, (u) => [u.productoNombre, u.productoId]);
  }

  /** Historial de costos de un producto, del más reciente al más antiguo (CP-02.4b). */
  async historialProducto(productoId: string, pag: Paginacion): Promise<ListaPrecios> {
    const { comercioId } = TenantContext.requerido();
    const cursor = pag.cursor ? decodificarCursor(pag.cursor, 2) : null;
    const filas = await this.prisma.transaccionTenant(async (tx) => {
      const producto = await tx.producto.findFirst({
        where: { id: productoId, comercioId },
        select: { id: true },
      });
      if (!producto) throw noEncontrado('No encontramos ese producto en tu comercio.');
      const condiciones: Prisma.Sql[] = [
        Prisma.sql`pp.comercio_id = ${comercioId}::uuid`,
        Prisma.sql`pp.producto_id = ${productoId}::uuid`,
      ];
      if (cursor) {
        const fecha = new Date(cursor[0]!);
        condiciones.push(Prisma.sql`(pp.vigente_desde, pp.id) < (${fecha}, ${cursor[1]}::uuid)`);
      }
      return tx.$queryRaw<FilaPrecio[]>(
        Prisma.sql`SELECT ${COLUMNAS} ${DESDE}
          WHERE ${Prisma.join(condiciones, ' AND ')}
          ORDER BY pp.vigente_desde DESC, pp.id DESC
          LIMIT ${pag.limit + 1}`,
      );
    });
    return this.paginar(filas, pag.limit, (u) => [u.vigenteDesde.toISOString(), u.id]);
  }

  /** Último costo informado por un proveedor para un producto, o null. */
  async ultimoCosto(
    tx: TransaccionRaw,
    comercioId: string,
    proveedorId: string,
    productoId: string,
  ): Promise<string | null> {
    const [fila] = await tx.$queryRaw<{ costoNeto: string }[]>`
      SELECT costo_neto::text AS "costoNeto" FROM precio_proveedor
      WHERE comercio_id = ${comercioId}::uuid AND proveedor_id = ${proveedorId}::uuid
        AND producto_id = ${productoId}::uuid
      ORDER BY vigente_desde DESC, creado_en DESC LIMIT 1`;
    return fila ? Number(fila.costoNeto).toFixed(2) : null;
  }

  /** Último costo de un proveedor para varios productos (vista previa e importación). */
  async ultimosCostos(
    tx: TransaccionRaw,
    comercioId: string,
    proveedorId: string,
    productoIds: string[],
  ): Promise<Map<string, string>> {
    if (productoIds.length === 0) return new Map();
    const filas = await tx.$queryRaw<{ productoId: string; costoNeto: string }[]>`
      SELECT DISTINCT ON (producto_id) producto_id AS "productoId", costo_neto::text AS "costoNeto"
      FROM precio_proveedor
      WHERE comercio_id = ${comercioId}::uuid AND proveedor_id = ${proveedorId}::uuid
        AND producto_id = ANY(${productoIds}::uuid[])
      ORDER BY producto_id, vigente_desde DESC, creado_en DESC`;
    return new Map(filas.map((f) => [f.productoId, Number(f.costoNeto).toFixed(2)]));
  }

  async proveedorActivo(
    tx: TransaccionRaw,
    comercioId: string,
    proveedorId: string,
  ): Promise<{ id: string; nombre: string }> {
    const p = await this.proveedorDelComercio(tx, comercioId, proveedorId);
    if (!p.activo) {
      throw conflicto(`${p.nombre} está dado de baja. Reactivalo antes de cargar costos.`, {
        proveedorId: p.id,
        activo: false,
      });
    }
    return { id: p.id, nombre: p.nombre };
  }

  async proveedorDelComercio(
    tx: TransaccionRaw,
    comercioId: string,
    proveedorId: string,
  ): Promise<{ id: string; nombre: string; activo: boolean }> {
    const p = await tx.proveedor.findFirst({
      where: { id: proveedorId, comercioId },
      select: { id: true, nombre: true, activo: true },
    });
    if (!p) throw noEncontrado('No encontramos ese proveedor en tu comercio.');
    return p;
  }

  private paginar(
    filas: FilaPrecio[],
    limit: number,
    clave: (ultimo: FilaPrecio) => string[],
  ): ListaPrecios {
    const hayMas = filas.length > limit;
    const pagina = hayMas ? filas.slice(0, limit) : filas;
    const ultimo = pagina[pagina.length - 1];
    return {
      items: pagina.map(aPrecio),
      siguienteCursor: hayMas && ultimo ? codificarCursor(clave(ultimo)) : null,
    };
  }
}
