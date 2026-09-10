import { Injectable } from '@nestjs/common';
import {
  calcularEstadoStock,
  LIMITES_PLAN,
  type ListaProductos,
  type Plan,
  type Producto,
  type ProductoCreate,
  type ProductoPatch,
  type ProductosQuery,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { conflicto, noEncontrado, planRequerido, validacion } from '../common/errors';
import { Prisma, type Producto as ProductoRow } from '../generated/prisma/client';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';

/** Código normalizado para la unicidad por comercio sin distinguir mayúsculas (RN-05). */
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

/** Fila tal como la devuelve el listado en SQL (montos ya como texto). */
interface FilaProducto {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string | null;
  precioVenta: string;
  alicuotaIva: string;
  costoReposicion: string;
  stockActual: number;
  stockSeguridad: number;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

type Origen = ProductoRow | FilaProducto;

export function aProducto(p: Origen): Producto {
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    categoria: p.categoria,
    precioVenta: Number(p.precioVenta).toFixed(2),
    alicuotaIva: Number(p.alicuotaIva).toString(),
    costoReposicion: Number(p.costoReposicion).toFixed(2),
    stockActual: p.stockActual,
    stockSeguridad: p.stockSeguridad,
    estadoStock: calcularEstadoStock(p.stockActual, p.stockSeguridad),
    activo: p.activo,
    creadoEn: p.creadoEn.toISOString(),
    actualizadoEn: p.actualizadoEn.toISOString(),
  };
}

/** Cursor opaco sobre (nombre, id) para la paginación (D3). */
export function codificarCursor(nombre: string, id: string): string {
  return Buffer.from(JSON.stringify([nombre, id]), 'utf8').toString('base64url');
}

export function decodificarCursor(cursor: string): { nombre: string; id: string } {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
      return { nombre: parsed[0], id: parsed[1] };
    }
  } catch {
    // cae al error de abajo
  }
  throw validacion('El cursor de paginación no es válido.', { cursor: 'Cursor inválido.' });
}

const COLUMNAS = Prisma.sql`
  id, codigo, nombre, categoria,
  precio_venta::text AS "precioVenta",
  alicuota_iva::text AS "alicuotaIva",
  costo_reposicion::text AS "costoReposicion",
  stock_actual AS "stockActual",
  stock_seguridad AS "stockSeguridad",
  activo, creado_en AS "creadoEn", actualizado_en AS "actualizadoEn"`;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listado con búsqueda, filtros y paginación por cursor (CP-01.3). */
  async listar(q: ProductosQuery): Promise<ListaProductos> {
    const { comercioId } = TenantContext.requerido();
    const cursor = q.cursor ? decodificarCursor(q.cursor) : null;

    const condiciones: Prisma.Sql[] = [
      Prisma.sql`comercio_id = ${comercioId}::uuid`,
      Prisma.sql`activo = ${q.activo}`,
    ];
    if (q.q) {
      const prefijo = `${normalizarCodigo(q.q)}%`;
      const contiene = `%${q.q}%`;
      condiciones.push(
        Prisma.sql`(codigo_normalizado LIKE ${prefijo} OR nombre ILIKE ${contiene})`,
      );
    }
    switch (q.estado) {
      case 'SIN_STOCK':
        condiciones.push(Prisma.sql`stock_actual <= 0`);
        break;
      case 'BAJO':
        condiciones.push(Prisma.sql`stock_actual > 0 AND stock_actual <= stock_seguridad`);
        break;
      case 'OK':
        condiciones.push(Prisma.sql`stock_actual > stock_seguridad`);
        break;
      default:
        break;
    }
    if (cursor) {
      condiciones.push(Prisma.sql`(nombre, id) > (${cursor.nombre}, ${cursor.id}::uuid)`);
    }

    const filas = await this.prisma.transaccionTenant((tx) =>
      tx.$queryRaw<FilaProducto[]>(
        Prisma.sql`SELECT ${COLUMNAS} FROM producto
          WHERE ${Prisma.join(condiciones, ' AND ')}
          ORDER BY nombre ASC, id ASC
          LIMIT ${q.limit + 1}`,
      ),
    );

    const hayMas = filas.length > q.limit;
    const pagina = hayMas ? filas.slice(0, q.limit) : filas;
    const ultimo = pagina[pagina.length - 1];
    return {
      items: pagina.map(aProducto),
      siguienteCursor: hayMas && ultimo ? codificarCursor(ultimo.nombre, ultimo.id) : null,
    };
  }

  async obtener(id: string): Promise<Producto> {
    const p = await this.prisma.tenant.producto.findFirst({ where: { id } });
    if (!p) throw noEncontrado('No encontramos ese producto en tu comercio.');
    return aProducto(p);
  }

  /** Alta (CP-01.1, CP-01.2, CP-01.6). */
  async crear(dto: ProductoCreate): Promise<Producto> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const { plan, ivaDefault } = await this.bloquearComercio(tx, comercioId);
      await this.verificarLimite(tx, comercioId, plan);

      const codigoNormalizado = normalizarCodigo(dto.codigo);
      await this.verificarCodigoLibre(tx, comercioId, codigoNormalizado);

      const creado = await tx.producto.create({
        data: {
          comercioId,
          codigo: dto.codigo,
          codigoNormalizado,
          nombre: dto.nombre,
          categoria: dto.categoria ?? null,
          precioVenta: dto.precioVenta,
          alicuotaIva: dto.alicuotaIva ?? ivaDefault,
          costoReposicion: dto.costoReposicion,
          stockActual: dto.stockInicial,
          stockSeguridad: dto.stockSeguridad,
        },
      });
      return aProducto(creado);
    });
  }

  /** Edición y reactivación (CP-01.4, CP-01.5b). El stock actual no se toca (RN-07). */
  async actualizar(id: string, patch: ProductoPatch): Promise<Producto> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const actual = await tx.producto.findFirst({ where: { id, comercioId } });
      if (!actual) throw noEncontrado('No encontramos ese producto en tu comercio.');

      const data: Prisma.ProductoUpdateInput = {};
      if (patch.codigo !== undefined) {
        const codigoNormalizado = normalizarCodigo(patch.codigo);
        if (codigoNormalizado !== actual.codigoNormalizado) {
          await this.verificarCodigoLibre(tx, comercioId, codigoNormalizado);
        }
        data.codigo = patch.codigo;
        data.codigoNormalizado = codigoNormalizado;
      }
      if (patch.nombre !== undefined) data.nombre = patch.nombre;
      if (patch.categoria !== undefined) data.categoria = patch.categoria;
      if (patch.precioVenta !== undefined) data.precioVenta = patch.precioVenta;
      if (patch.alicuotaIva !== undefined) data.alicuotaIva = patch.alicuotaIva;
      if (patch.costoReposicion !== undefined) data.costoReposicion = patch.costoReposicion;
      if (patch.stockSeguridad !== undefined) data.stockSeguridad = patch.stockSeguridad;
      if (patch.activo !== undefined) {
        if (patch.activo && !actual.activo) {
          const { plan } = await this.bloquearComercio(tx, comercioId);
          await this.verificarLimite(tx, comercioId, plan);
        }
        data.activo = patch.activo;
      }

      const actualizado = await tx.producto.update({ where: { id }, data });
      return aProducto(actualizado);
    });
  }

  /** Baja lógica (CP-01.5): el producto conserva código e historial. */
  async darDeBaja(id: string): Promise<Producto> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const actual = await tx.producto.findFirst({ where: { id, comercioId } });
      if (!actual) throw noEncontrado('No encontramos ese producto en tu comercio.');
      const bajado = await tx.producto.update({ where: { id }, data: { activo: false } });
      return aProducto(bajado);
    });
  }

  /** Bloquea la fila del comercio para serializar altas concurrentes (D6) y lee plan e IVA. */
  private async bloquearComercio(
    tx: TransaccionRaw,
    comercioId: string,
  ): Promise<{ plan: Plan; ivaDefault: string }> {
    const filas = await tx.$queryRaw<{ plan: Plan; ivaDefault: string }[]>`
      SELECT plan, iva_default::text AS "ivaDefault" FROM comercio
      WHERE id = ${comercioId}::uuid FOR UPDATE`;
    const fila = filas[0];
    if (!fila) throw noEncontrado('No encontramos tu comercio.');
    return fila;
  }

  private async verificarLimite(tx: TransaccionRaw, comercioId: string, plan: Plan): Promise<void> {
    const limite = LIMITES_PLAN[plan].productos;
    if (limite === null) return;
    const activos = await tx.producto.count({ where: { comercioId, activo: true } });
    if (activos >= limite) {
      throw planRequerido(
        'PRO',
        `El plan ${plan} admite hasta ${limite} productos activos. Pasá al plan PRO para seguir cargando.`,
      );
    }
  }

  private async verificarCodigoLibre(
    tx: TransaccionRaw,
    comercioId: string,
    codigoNormalizado: string,
  ): Promise<void> {
    const existente = await tx.producto.findUnique({
      where: { comercioId_codigoNormalizado: { comercioId, codigoNormalizado } },
      select: { id: true, activo: true, codigo: true },
    });
    if (!existente) return;
    throw conflicto(
      existente.activo
        ? `Ya existe un producto con el código ${existente.codigo}.`
        : `El código ${existente.codigo} pertenece a un producto dado de baja. Reactivalo en lugar de crear otro.`,
      { productoId: existente.id, activo: existente.activo },
    );
  }
}
