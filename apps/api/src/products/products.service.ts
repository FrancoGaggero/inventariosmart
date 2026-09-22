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
import { MovementsService } from '../movements/movements.service';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';
import { PricesService } from '../suppliers/prices.service';

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
  proveedorPrincipalId: string | null;
  proveedorPrincipalNombre: string | null;
}

type Origen = ProductoRow | FilaProducto;
export type ProveedorResumen = { id: string; nombre: string } | null;

/** Proveedor principal: del JOIN del listado, o del `include` de Prisma pasado aparte. */
function proveedorDe(p: Origen, dado: ProveedorResumen | undefined): ProveedorResumen {
  if (dado !== undefined) return dado;
  if ('proveedorPrincipalNombre' in p && p.proveedorPrincipalId && p.proveedorPrincipalNombre) {
    return { id: p.proveedorPrincipalId, nombre: p.proveedorPrincipalNombre };
  }
  return null;
}

/** `include` para devolver el proveedor principal desde las consultas Prisma. */
export const INCLUIR_PROVEEDOR = {
  proveedorPrincipal: { select: { id: true, nombre: true } },
} as const;

export function aProducto(p: Origen, proveedor?: ProveedorResumen): Producto {
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
    proveedorPrincipal: proveedorDe(p, proveedor),
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
  p.id, p.codigo, p.nombre, p.categoria,
  p.precio_venta::text AS "precioVenta",
  p.alicuota_iva::text AS "alicuotaIva",
  p.costo_reposicion::text AS "costoReposicion",
  p.stock_actual AS "stockActual",
  p.stock_seguridad AS "stockSeguridad",
  p.activo, p.creado_en AS "creadoEn", p.actualizado_en AS "actualizadoEn",
  p.proveedor_principal_id AS "proveedorPrincipalId",
  pr.nombre AS "proveedorPrincipalNombre"`;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: MovementsService,
    private readonly prices: PricesService,
  ) {}

  /** Listado con búsqueda, filtros y paginación por cursor (CP-01.3). */
  async listar(q: ProductosQuery): Promise<ListaProductos> {
    const { comercioId } = TenantContext.requerido();
    const cursor = q.cursor ? decodificarCursor(q.cursor) : null;

    const condiciones: Prisma.Sql[] = [
      Prisma.sql`p.comercio_id = ${comercioId}::uuid`,
      Prisma.sql`p.activo = ${q.activo}`,
    ];
    if (q.q) {
      const prefijo = `${normalizarCodigo(q.q)}%`;
      const contiene = `%${q.q}%`;
      condiciones.push(
        Prisma.sql`(p.codigo_normalizado LIKE ${prefijo} OR p.nombre ILIKE ${contiene})`,
      );
    }
    switch (q.estado) {
      case 'SIN_STOCK':
        condiciones.push(Prisma.sql`p.stock_actual <= 0`);
        break;
      case 'BAJO':
        condiciones.push(Prisma.sql`p.stock_actual > 0 AND p.stock_actual <= p.stock_seguridad`);
        break;
      case 'OK':
        condiciones.push(Prisma.sql`p.stock_actual > p.stock_seguridad`);
        break;
      default:
        break;
    }
    if (cursor) {
      condiciones.push(Prisma.sql`(p.nombre, p.id) > (${cursor.nombre}, ${cursor.id}::uuid)`);
    }

    const filas = await this.prisma.transaccionTenant((tx) =>
      tx.$queryRaw<FilaProducto[]>(
        Prisma.sql`SELECT ${COLUMNAS} FROM producto p
          LEFT JOIN proveedor pr ON pr.id = p.proveedor_principal_id
          WHERE ${Prisma.join(condiciones, ' AND ')}
          ORDER BY p.nombre ASC, p.id ASC
          LIMIT ${q.limit + 1}`,
      ),
    );

    const hayMas = filas.length > q.limit;
    const pagina = hayMas ? filas.slice(0, q.limit) : filas;
    const ultimo = pagina[pagina.length - 1];
    return {
      items: pagina.map((f) => aProducto(f)),
      siguienteCursor: hayMas && ultimo ? codificarCursor(ultimo.nombre, ultimo.id) : null,
    };
  }

  async obtener(id: string): Promise<Producto> {
    const p = await this.prisma.tenant.producto.findFirst({
      where: { id },
      include: INCLUIR_PROVEEDOR,
    });
    if (!p) throw noEncontrado('No encontramos ese producto en tu comercio.');
    return aProducto(p, p.proveedorPrincipal);
  }

  /** Alta (CP-01.1, CP-01.2, CP-01.6). */
  async crear(dto: ProductoCreate): Promise<Producto> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const { plan, ivaDefault } = await this.bloquearComercio(tx, comercioId);
      await this.verificarLimite(tx, comercioId, plan);

      const codigoNormalizado = normalizarCodigo(dto.codigo);
      await this.verificarCodigoLibre(tx, comercioId, codigoNormalizado);

      // El stock inicial entra como un INGRESO (STOCK_INICIAL) en la misma transacción,
      // así el historial de todo producto empieza en su primer movimiento (HU-10, CP-10.9).
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
          stockActual: 0,
          stockSeguridad: dto.stockSeguridad,
        },
      });
      if (dto.stockInicial > 0) {
        const ingreso = await this.movements.registrarEnTransaccion(tx, {
          productoId: creado.id,
          tipo: 'INGRESO',
          cantidad: dto.stockInicial,
          motivo: 'STOCK_INICIAL',
        });
        return aProducto({ ...creado, stockActual: ingreso.stockResultante });
      }
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
      if (patch.stockSeguridad !== undefined) data.stockSeguridad = patch.stockSeguridad;
      if (patch.activo !== undefined) {
        if (patch.activo && !actual.activo) {
          const { plan } = await this.bloquearComercio(tx, comercioId);
          await this.verificarLimite(tx, comercioId, plan);
        }
        data.activo = patch.activo;
      }

      // Proveedor principal (HU-02, CP-01.4d): al cambiarlo, el costo vigente pasa al último
      // costo de ese proveedor (RN-08), salvo que el mismo PATCH traiga un costo explícito.
      let principalId = actual.proveedorPrincipalId;
      let principalActivo = true;
      if (patch.proveedorPrincipalId !== undefined) {
        principalId = patch.proveedorPrincipalId;
        data.proveedorPrincipal =
          principalId === null ? { disconnect: true } : { connect: { id: principalId } };
        if (principalId !== null && principalId !== actual.proveedorPrincipalId) {
          const proveedor = await this.prices.proveedorDelComercio(tx, comercioId, principalId);
          if (!proveedor.activo) {
            throw conflicto(
              `${proveedor.nombre} está dado de baja. Reactivalo para usarlo como proveedor principal.`,
              {
                proveedorId: proveedor.id,
                activo: false,
              },
            );
          }
          if (patch.costoReposicion === undefined) {
            const ultimo = await this.prices.ultimoCosto(tx, comercioId, principalId, id);
            if (ultimo !== null) data.costoReposicion = ultimo;
          }
        }
      } else if (principalId !== null) {
        const proveedor = await tx.proveedor.findFirst({
          where: { id: principalId },
          select: { activo: true },
        });
        principalActivo = proveedor?.activo ?? false;
      }

      // Costo editado a mano (CP-02.5e): queda en el historial como fila MANUAL del principal.
      const registrarManual =
        patch.costoReposicion !== undefined && principalId !== null && principalActivo;
      if (patch.costoReposicion !== undefined && !registrarManual) {
        data.costoReposicion = patch.costoReposicion;
      }

      await tx.producto.update({ where: { id }, data, select: { id: true } });
      if (registrarManual) {
        await this.prices.registrarEnTransaccion(tx, {
          proveedorId: principalId!,
          items: [{ productoId: id, costoNeto: patch.costoReposicion! }],
          origen: 'MANUAL',
        });
      }
      const actualizado = await tx.producto.findUniqueOrThrow({
        where: { id },
        include: INCLUIR_PROVEEDOR,
      });
      return aProducto(actualizado, actualizado.proveedorPrincipal);
    });
  }

  /** Baja lógica (CP-01.5): el producto conserva código e historial. */
  async darDeBaja(id: string): Promise<Producto> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const actual = await tx.producto.findFirst({ where: { id, comercioId } });
      if (!actual) throw noEncontrado('No encontramos ese producto en tu comercio.');
      const bajado = await tx.producto.update({
        where: { id },
        data: { activo: false },
        include: INCLUIR_PROVEEDOR,
      });
      return aProducto(bajado, bajado.proveedorPrincipal);
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
