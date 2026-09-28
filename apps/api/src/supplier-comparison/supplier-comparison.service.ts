import { Injectable } from '@nestjs/common';
import {
  compararInsumo,
  redondear2,
  type CandidatoComparador,
  type ComparacionProducto,
  type ComparadorQuery,
  type InsumoComparado,
  type ResumenComparador,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { codificarCursor, decodificarCursor } from '../common/cursor';
import { noEncontrado, validacion } from '../common/errors';
import { Prisma } from '../generated/prisma/client';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';

/** Último costo de un proveedor para un producto. */
interface FilaCosto {
  productoId: string;
  proveedorId: string;
  costoNeto: string;
  vigenteDesde: Date;
}

interface FilaProveedor {
  id: string;
  nombre: string;
  leadTimeDias: number;
  confiabilidad: number;
}

interface FilaProducto {
  id: string;
  codigo: string;
  nombre: string;
  proveedorPrincipalId: string | null;
}

const DIAS_VENTAS = 30;
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Comparador de precios entre proveedores (HU-12, RN-13). Nada se guarda: se calcula al leer con
 * el último costo de cada proveedor activo, así una lista recién importada ya cuenta (CP-12.4).
 * Cada consulta recorre una sola tabla y el cruce se hace en memoria, para que el plan no
 * dependa de las estadísticas de la base.
 */
@Injectable()
export class SupplierComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  /** Proveedores de un insumo, de mayor a menor puntaje (CP-12.1). */
  async producto(id: string): Promise<ComparacionProducto> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const [producto] = await tx.$queryRaw<FilaProducto[]>`
        SELECT p.id, p.codigo, p.nombre, p.proveedor_principal_id AS "proveedorPrincipalId"
        FROM producto p
        WHERE p.comercio_id = ${comercioId}::uuid AND p.id = ${id}::uuid`;
      if (!producto) throw noEncontrado('No encontramos ese producto en tu comercio.');
      const [costos, proveedores, unidades] = [
        await this.ultimosCostos(tx, comercioId, id),
        await this.proveedoresActivos(tx, comercioId),
        await this.unidadesVendidas(tx, comercioId, id),
      ];
      return compararInsumo(
        { id: producto.id, codigo: producto.codigo, nombre: producto.nombre },
        this.candidatos(costos, proveedores),
        producto.proveedorPrincipalId,
        unidades.get(id) ?? 0,
      );
    });
  }

  /** Insumos con dos o más proveedores, por ahorro estimado (CP-12.3). */
  async resumen(q: ComparadorQuery): Promise<ResumenComparador> {
    const { comercioId } = TenantContext.requerido();
    const desde = q.cursor ? this.posicion(q.cursor) : 0;
    const comparables = await this.prisma.transaccionTenant(async (tx) => {
      const costos = await this.ultimosCostos(tx, comercioId);
      if (costos.length === 0) return [];
      const proveedores = await this.proveedoresActivos(tx, comercioId);
      const productos = await tx.$queryRaw<FilaProducto[]>`
        SELECT p.id, p.codigo, p.nombre, p.proveedor_principal_id AS "proveedorPrincipalId"
        FROM producto p
        WHERE p.comercio_id = ${comercioId}::uuid AND p.activo`;
      const unidades = await this.unidadesVendidas(tx, comercioId);

      const porProducto = new Map<string, FilaCosto[]>();
      for (const c of costos) {
        const lista = porProducto.get(c.productoId);
        if (lista) lista.push(c);
        else porProducto.set(c.productoId, [c]);
      }
      const insumos: InsumoComparado[] = [];
      for (const p of productos) {
        const c = compararInsumo(
          { id: p.id, codigo: p.codigo, nombre: p.nombre },
          this.candidatos(porProducto.get(p.id) ?? [], proveedores),
          p.proveedorPrincipalId,
          unidades.get(p.id) ?? 0,
        );
        if (!c.comparable || !c.recomendado || !c.masBarato) continue;
        insumos.push({
          producto: c.producto,
          proveedores: c.proveedores.length,
          recomendado: c.recomendado,
          masBarato: c.masBarato,
          principal: c.principal,
          cambiaProveedor: c.cambiaProveedor,
          unidades30d: c.unidades30d,
          ahorroEstimado: c.ahorroEstimado,
        });
      }
      return insumos;
    });

    const ahorro = (i: InsumoComparado) =>
      i.ahorroEstimado === null ? -1 : Number(i.ahorroEstimado);
    const busqueda = q.q?.toLocaleLowerCase('es');
    const filtrados = comparables
      .filter((i) => !q.soloOportunidades || i.cambiaProveedor)
      .filter(
        (i) =>
          !busqueda ||
          i.producto.codigo.toLocaleLowerCase('es').includes(busqueda) ||
          i.producto.nombre.toLocaleLowerCase('es').includes(busqueda),
      )
      .sort(
        (a, b) =>
          ahorro(b) - ahorro(a) ||
          Number(b.cambiaProveedor) - Number(a.cambiaProveedor) ||
          a.producto.nombre.localeCompare(b.producto.nombre, 'es') ||
          a.producto.id.localeCompare(b.producto.id),
      );
    const pagina = filtrados.slice(desde, desde + q.limit);
    const hayMas = desde + q.limit < filtrados.length;
    return {
      items: pagina,
      siguienteCursor: hayMas ? codificarCursor([String(desde + q.limit)]) : null,
      totales: {
        comparables: comparables.length,
        conCambio: comparables.filter((i) => i.cambiaProveedor).length,
        ahorroEstimado: redondear2(
          comparables.reduce((acc, i) => acc + Number(i.ahorroEstimado ?? 0), 0),
        ),
      },
    };
  }

  /** El resumen se ordena por ahorro, que se calcula en memoria: el cursor es la posición. */
  private posicion(cursor: string): number {
    const n = Number(decodificarCursor(cursor, 1)[0]);
    if (!Number.isInteger(n) || n < 0) {
      throw validacion('El cursor de paginación no es válido.', { cursor: 'Cursor inválido.' });
    }
    return n;
  }

  private candidatos(costos: FilaCosto[], proveedores: Map<string, FilaProveedor>) {
    const candidatos: CandidatoComparador[] = [];
    for (const c of costos) {
      // Un proveedor dado de baja no está en el mapa: no se compara (CP-12.1c).
      const proveedor = proveedores.get(c.proveedorId);
      if (!proveedor) continue;
      candidatos.push({
        proveedorId: proveedor.id,
        nombre: proveedor.nombre,
        costo: Number(c.costoNeto),
        leadTimeDias: proveedor.leadTimeDias,
        confiabilidad: proveedor.confiabilidad,
        vigenteDesde: c.vigenteDesde.toISOString(),
      });
    }
    return candidatos;
  }

  /**
   * Último costo de cada proveedor por producto: una pasada sobre `precio_proveedor`, en el
   * orden de su índice (comercio, proveedor, producto, vigencia), sin ordenar aparte.
   */
  private ultimosCostos(
    tx: TransaccionRaw,
    comercioId: string,
    productoId?: string,
  ): Promise<FilaCosto[]> {
    return tx.$queryRaw<FilaCosto[]>(Prisma.sql`
      SELECT DISTINCT ON (pp.proveedor_id, pp.producto_id)
             pp.producto_id AS "productoId", pp.proveedor_id AS "proveedorId",
             pp.costo_neto::text AS "costoNeto", pp.vigente_desde AS "vigenteDesde"
      FROM precio_proveedor pp
      WHERE pp.comercio_id = ${comercioId}::uuid
        ${productoId ? Prisma.sql`AND pp.producto_id = ${productoId}::uuid` : Prisma.empty}
      ORDER BY pp.proveedor_id, pp.producto_id, pp.vigente_desde DESC, pp.creado_en DESC`);
  }

  private async proveedoresActivos(
    tx: TransaccionRaw,
    comercioId: string,
  ): Promise<Map<string, FilaProveedor>> {
    const filas = await tx.$queryRaw<FilaProveedor[]>`
      SELECT pr.id, pr.nombre, pr.lead_time_dias AS "leadTimeDias", pr.confiabilidad
      FROM proveedor pr
      WHERE pr.comercio_id = ${comercioId}::uuid AND pr.activo`;
    return new Map(filas.map((f) => [f.id, f]));
  }

  /** Unidades vendidas en los últimos 30 días, para estimar el ahorro. */
  private async unidadesVendidas(
    tx: TransaccionRaw,
    comercioId: string,
    productoId?: string,
  ): Promise<Map<string, number>> {
    const desde = new Date(Date.now() - DIAS_VENTAS * DIA_MS);
    const filas = await tx.$queryRaw<{ productoId: string; unidades: number }[]>(Prisma.sql`
      SELECT m.producto_id AS "productoId", COALESCE(SUM(m.cantidad), 0)::int AS unidades
      FROM movimiento m
      WHERE m.comercio_id = ${comercioId}::uuid AND m.tipo = 'VENTA'
        AND m.anulado_por_id IS NULL AND m.fecha >= ${desde}
        ${productoId ? Prisma.sql`AND m.producto_id = ${productoId}::uuid` : Prisma.empty}
      GROUP BY m.producto_id`);
    return new Map(filas.map((f) => [f.productoId, f.unidades]));
  }
}
