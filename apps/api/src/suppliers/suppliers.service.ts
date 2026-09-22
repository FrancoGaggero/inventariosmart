import { Injectable } from '@nestjs/common';
import type {
  ListaProveedores,
  Proveedor,
  ProveedorCreate,
  ProveedorPatch,
  ProveedoresQuery,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { codificarCursor, decodificarCursor } from '../common/cursor';
import { conflicto, noEncontrado } from '../common/errors';
import { Prisma, type Proveedor as ProveedorRow } from '../generated/prisma/client';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';

/** Nombre normalizado para la unicidad por comercio sin distinguir mayúsculas. */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().toUpperCase();
}

export function aProveedor(p: ProveedorRow): Proveedor {
  return {
    id: p.id,
    nombre: p.nombre,
    contacto: p.contacto,
    email: p.email,
    telefono: p.telefono,
    cuit: p.cuit,
    leadTimeDias: p.leadTimeDias,
    confiabilidad: p.confiabilidad,
    notas: p.notas,
    activo: p.activo,
    creadoEn: p.creadoEn.toISOString(),
    actualizadoEn: p.actualizadoEn.toISOString(),
  };
}

const MENSAJE_NO_ENCONTRADO = 'No encontramos ese proveedor en tu comercio.';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listado con búsqueda por nombre, filtro activo y cursor (nombre, id). */
  async listar(q: ProveedoresQuery): Promise<ListaProveedores> {
    const { comercioId } = TenantContext.requerido();
    const cursor = q.cursor ? decodificarCursor(q.cursor, 2) : null;

    const condiciones: Prisma.Sql[] = [
      Prisma.sql`comercio_id = ${comercioId}::uuid`,
      Prisma.sql`activo = ${q.activo}`,
    ];
    if (q.q) {
      condiciones.push(Prisma.sql`nombre ILIKE ${`%${q.q}%`}`);
    }
    if (cursor) {
      condiciones.push(Prisma.sql`(nombre, id) > (${cursor[0]}, ${cursor[1]}::uuid)`);
    }

    const filas = await this.prisma.transaccionTenant((tx) =>
      tx.$queryRaw<ProveedorRow[]>(
        Prisma.sql`SELECT id, comercio_id AS "comercioId", nombre,
            nombre_normalizado AS "nombreNormalizado", contacto, email, telefono, cuit,
            lead_time_dias AS "leadTimeDias", confiabilidad, notas, activo,
            creado_en AS "creadoEn", actualizado_en AS "actualizadoEn"
          FROM proveedor
          WHERE ${Prisma.join(condiciones, ' AND ')}
          ORDER BY nombre ASC, id ASC
          LIMIT ${q.limit + 1}`,
      ),
    );

    const hayMas = filas.length > q.limit;
    const pagina = hayMas ? filas.slice(0, q.limit) : filas;
    const ultimo = pagina[pagina.length - 1];
    return {
      items: pagina.map(aProveedor),
      siguienteCursor: hayMas && ultimo ? codificarCursor([ultimo.nombre, ultimo.id]) : null,
    };
  }

  async obtener(id: string): Promise<Proveedor> {
    const p = await this.prisma.tenant.proveedor.findFirst({ where: { id } });
    if (!p) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
    return aProveedor(p);
  }

  /** Alta (CP-02.1, CP-02.1b). */
  async crear(dto: ProveedorCreate): Promise<Proveedor> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const nombreNormalizado = normalizarNombre(dto.nombre);
      await this.verificarNombreLibre(tx, comercioId, nombreNormalizado);
      const creado = await tx.proveedor.create({
        data: {
          comercioId,
          nombre: dto.nombre,
          nombreNormalizado,
          contacto: dto.contacto ?? null,
          email: dto.email ?? null,
          telefono: dto.telefono ?? null,
          cuit: dto.cuit ?? null,
          leadTimeDias: dto.leadTimeDias,
          confiabilidad: dto.confiabilidad,
          notas: dto.notas ?? null,
        },
      });
      return aProveedor(creado);
    });
  }

  /** Edición, lead time, confiabilidad y reactivación (CP-02.1, CP-02.1c, CP-02.2, CP-02.3). */
  async actualizar(id: string, patch: ProveedorPatch): Promise<Proveedor> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const actual = await tx.proveedor.findFirst({ where: { id, comercioId } });
      if (!actual) throw noEncontrado(MENSAJE_NO_ENCONTRADO);

      const data: Prisma.ProveedorUpdateInput = {};
      if (patch.nombre !== undefined) {
        const nombreNormalizado = normalizarNombre(patch.nombre);
        if (nombreNormalizado !== actual.nombreNormalizado) {
          await this.verificarNombreLibre(tx, comercioId, nombreNormalizado);
        }
        data.nombre = patch.nombre;
        data.nombreNormalizado = nombreNormalizado;
      }
      if (patch.contacto !== undefined) data.contacto = patch.contacto;
      if (patch.email !== undefined) data.email = patch.email;
      if (patch.telefono !== undefined) data.telefono = patch.telefono;
      if (patch.cuit !== undefined) data.cuit = patch.cuit;
      if (patch.leadTimeDias !== undefined) data.leadTimeDias = patch.leadTimeDias;
      if (patch.confiabilidad !== undefined) data.confiabilidad = patch.confiabilidad;
      if (patch.notas !== undefined) data.notas = patch.notas;
      if (patch.activo !== undefined) data.activo = patch.activo;

      const actualizado = await tx.proveedor.update({ where: { id }, data });
      return aProveedor(actualizado);
    });
  }

  /** Baja lógica (CP-02.1c): conserva el historial de precios. */
  async darDeBaja(id: string): Promise<Proveedor> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const actual = await tx.proveedor.findFirst({ where: { id, comercioId } });
      if (!actual) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
      const bajado = await tx.proveedor.update({ where: { id }, data: { activo: false } });
      return aProveedor(bajado);
    });
  }

  private async verificarNombreLibre(
    tx: TransaccionRaw,
    comercioId: string,
    nombreNormalizado: string,
  ): Promise<void> {
    const existente = await tx.proveedor.findUnique({
      where: { comercioId_nombreNormalizado: { comercioId, nombreNormalizado } },
      select: { id: true, nombre: true, activo: true },
    });
    if (!existente) return;
    throw conflicto(
      existente.activo
        ? `Ya existe un proveedor llamado ${existente.nombre}.`
        : `${existente.nombre} es un proveedor dado de baja. Reactivalo en lugar de crear otro.`,
      { proveedorId: existente.id, activo: existente.activo },
    );
  }
}
