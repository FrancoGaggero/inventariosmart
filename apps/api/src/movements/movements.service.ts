import { Injectable } from '@nestjs/common';
import {
  calcularEstadoStock,
  efectoStockDe,
  type Anulacion,
  type ListaMovimientos,
  type Movimiento,
  type MovimientoCreate,
  type MovimientosQuery,
  type MotivoMovimiento,
  type TipoMovimiento,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { conflicto, noEncontrado, validacion } from '../common/errors';
import { Prisma } from '../generated/prisma/client';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';

/** Fila del historial con los datos del producto y del usuario ya unidos (D7). */
interface FilaMovimiento {
  id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  efectoStock: number;
  stockResultante: number;
  precioUnitario: string | null;
  motivo: MotivoMovimiento | null;
  observacion: string | null;
  fecha: Date;
  corrigeAId: string | null;
  anuladoPorId: string | null;
  creadoEn: Date;
  productoId: string;
  productoCodigo: string;
  productoNombre: string;
  stockSeguridad: number;
  usuarioId: string;
  usuarioNombre: string | null;
}

/** Producto bloqueado para el registro (D3). */
interface ProductoBloqueado {
  id: string;
  codigo: string;
  nombre: string;
  precioVenta: string;
  stockActual: number;
  stockSeguridad: number;
  activo: boolean;
}

/** Datos internos de un registro: los del cliente más los que fija el sistema. */
export interface DatosRegistro {
  productoId: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivo?: MotivoMovimiento | null;
  observacion?: string | null;
  fecha?: string | null;
  corrigeAId?: string | null;
  claveIdempotencia?: string | null;
}

export interface ResultadoRegistro {
  movimiento: Movimiento;
  /** false cuando la Idempotency-Key ya existía y se devolvió el movimiento original. */
  creado: boolean;
}

export function aMovimiento(f: FilaMovimiento): Movimiento {
  return {
    id: f.id,
    tipo: f.tipo,
    producto: { id: f.productoId, codigo: f.productoCodigo, nombre: f.productoNombre },
    usuario: { id: f.usuarioId, nombre: f.usuarioNombre },
    cantidad: f.cantidad,
    efectoStock: f.efectoStock,
    stockResultante: f.stockResultante,
    estadoStock: calcularEstadoStock(f.stockResultante, f.stockSeguridad),
    precioUnitario: f.precioUnitario === null ? null : Number(f.precioUnitario).toFixed(2),
    motivo: f.motivo,
    observacion: f.observacion,
    fecha: f.fecha.toISOString(),
    corrigeAId: f.corrigeAId,
    anuladoPorId: f.anuladoPorId,
    creadoEn: f.creadoEn.toISOString(),
  };
}

/** Cursor opaco sobre (fecha, id), del más reciente al más antiguo (D7). */
export function codificarCursor(fecha: Date, id: string): string {
  return Buffer.from(JSON.stringify([fecha.toISOString(), id]), 'utf8').toString('base64url');
}

export function decodificarCursor(cursor: string): { fecha: Date; id: string } {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
      const fecha = new Date(parsed[0]);
      if (!Number.isNaN(fecha.getTime())) return { fecha, id: parsed[1] };
    }
  } catch {
    // cae al error de abajo
  }
  throw validacion('El cursor de paginación no es válido.', { cursor: 'Cursor inválido.' });
}

const COLUMNAS = Prisma.sql`
  m.id, m.tipo, m.cantidad,
  m.efecto_stock AS "efectoStock",
  m.stock_resultante AS "stockResultante",
  m.precio_unitario::text AS "precioUnitario",
  m.motivo, m.observacion, m.fecha,
  m.corrige_a_id AS "corrigeAId",
  m.anulado_por_id AS "anuladoPorId",
  m.creado_en AS "creadoEn",
  p.id AS "productoId", p.codigo AS "productoCodigo", p.nombre AS "productoNombre",
  p.stock_seguridad AS "stockSeguridad",
  u.id AS "usuarioId", u.nombre AS "usuarioNombre"`;

const DESDE = Prisma.sql`
  FROM movimiento m
  JOIN producto p ON p.id = m.producto_id
  JOIN usuario u ON u.id = m.usuario_id`;

const MENSAJE_NO_ENCONTRADO = 'No encontramos ese movimiento en tu comercio.';

@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Historial con filtros y paginación por cursor (CP-10.5). */
  async listar(q: MovimientosQuery): Promise<ListaMovimientos> {
    const { comercioId } = TenantContext.requerido();
    const cursor = q.cursor ? decodificarCursor(q.cursor) : null;

    const condiciones: Prisma.Sql[] = [Prisma.sql`m.comercio_id = ${comercioId}::uuid`];
    if (q.productoId) condiciones.push(Prisma.sql`m.producto_id = ${q.productoId}::uuid`);
    if (q.tipo) condiciones.push(Prisma.sql`m.tipo = ${q.tipo}::tipo_movimiento`);
    if (q.desde) condiciones.push(Prisma.sql`m.fecha >= ${new Date(q.desde)}`);
    if (q.hasta) condiciones.push(Prisma.sql`m.fecha <= ${new Date(q.hasta)}`);
    if (cursor) {
      condiciones.push(Prisma.sql`(m.fecha, m.id) < (${cursor.fecha}, ${cursor.id}::uuid)`);
    }

    const filas = await this.prisma.transaccionTenant((tx) =>
      tx.$queryRaw<FilaMovimiento[]>(
        Prisma.sql`SELECT ${COLUMNAS} ${DESDE}
          WHERE ${Prisma.join(condiciones, ' AND ')}
          ORDER BY m.fecha DESC, m.id DESC
          LIMIT ${q.limit + 1}`,
      ),
    );

    const hayMas = filas.length > q.limit;
    const pagina = hayMas ? filas.slice(0, q.limit) : filas;
    const ultimo = pagina[pagina.length - 1];
    return {
      items: pagina.map(aMovimiento),
      siguienteCursor: hayMas && ultimo ? codificarCursor(ultimo.fecha, ultimo.id) : null,
    };
  }

  async obtener(id: string): Promise<Movimiento> {
    const { comercioId } = TenantContext.requerido();
    const m = await this.prisma.transaccionTenant((tx) => this.obtenerEnTx(tx, comercioId, id));
    if (!m) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
    return m;
  }

  /** Registro desde la API (CP-10.1, CP-10.2, CP-10.3, CP-10.8). */
  async registrar(dto: MovimientoCreate, claveIdempotencia?: string): Promise<ResultadoRegistro> {
    const { comercioId } = TenantContext.requerido();
    const datos: DatosRegistro = {
      productoId: dto.productoId,
      tipo: dto.tipo,
      cantidad: dto.cantidad,
      motivo: dto.tipo === 'VENTA' ? null : (dto.motivo ?? null),
      observacion: dto.observacion ?? null,
      fecha: dto.fecha ?? null,
      claveIdempotencia: claveIdempotencia ?? null,
    };

    const existente = claveIdempotencia
      ? await this.buscarPorClave(comercioId, claveIdempotencia)
      : null;
    if (existente) return { movimiento: existente, creado: false };

    try {
      const movimiento = await this.prisma.transaccionTenant((tx) =>
        this.registrarEnTransaccion(tx, datos),
      );
      return { movimiento, creado: true };
    } catch (err) {
      // Dos requests con la misma clave en paralelo: la segunda choca con el índice único
      // y devuelve el movimiento que creó la primera (D5).
      if (claveIdempotencia && esConflictoDeClave(err)) {
        const repetido = await this.buscarPorClave(comercioId, claveIdempotencia);
        if (repetido) return { movimiento: repetido, creado: false };
      }
      throw err;
    }
  }

  /** Anulación: AJUSTE inverso que referencia al original (CP-10.4, RN-07). */
  async anular(id: string, dto: Anulacion): Promise<Movimiento> {
    const { comercioId } = TenantContext.requerido();
    try {
      return await this.prisma.transaccionTenant(async (tx) => {
        const [original] = await tx.$queryRaw<
          {
            id: string;
            productoId: string;
            efectoStock: number;
            corrigeAId: string | null;
            anuladoPorId: string | null;
          }[]
        >`SELECT id, producto_id AS "productoId", efecto_stock AS "efectoStock",
            corrige_a_id AS "corrigeAId", anulado_por_id AS "anuladoPorId"
          FROM movimiento WHERE id = ${id}::uuid AND comercio_id = ${comercioId}::uuid
          FOR UPDATE`;
        if (!original) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
        if (original.anuladoPorId) {
          throw conflicto('Este movimiento ya fue anulado.', {
            anuladoPorId: original.anuladoPorId,
          });
        }
        if (original.corrigeAId) {
          throw conflicto('Una anulación no se puede anular. Registrá un nuevo movimiento.');
        }

        const ajuste = await this.registrarEnTransaccion(tx, {
          productoId: original.productoId,
          tipo: 'AJUSTE',
          cantidad: -original.efectoStock,
          motivo: 'ANULACION',
          observacion: dto.observacion ?? null,
          corrigeAId: original.id,
        });
        await tx.$executeRaw`UPDATE movimiento SET anulado_por_id = ${ajuste.id}::uuid
          WHERE id = ${original.id}::uuid`;
        return ajuste;
      });
    } catch (err) {
      if (esConflictoDeClave(err)) throw conflicto('Este movimiento ya fue anulado.');
      throw err;
    }
  }

  /**
   * Núcleo del registro (D3), reutilizable dentro de otra transacción de tenant
   * (el alta de producto registra acá su stock inicial, D6).
   */
  async registrarEnTransaccion(tx: TransaccionRaw, datos: DatosRegistro): Promise<Movimiento> {
    const { comercioId, usuarioId } = TenantContext.requerido();

    const [producto] = await tx.$queryRaw<ProductoBloqueado[]>`
      SELECT id, codigo, nombre, precio_venta::text AS "precioVenta",
             stock_actual AS "stockActual", stock_seguridad AS "stockSeguridad", activo
      FROM producto WHERE id = ${datos.productoId}::uuid AND comercio_id = ${comercioId}::uuid
      FOR UPDATE`;
    if (!producto) throw noEncontrado('No encontramos ese producto en tu comercio.');
    if (!producto.activo) {
      throw conflicto(
        `${producto.nombre} está dado de baja. Reactivalo antes de registrar movimientos.`,
        { productoId: producto.id, activo: false },
      );
    }

    const efectoStock = efectoStockDe(datos.tipo, datos.cantidad);
    const stockResultante = producto.stockActual + efectoStock;
    if (stockResultante < 0) {
      throw conflicto(
        `No hay stock suficiente de ${producto.nombre}: quedan ${producto.stockActual} unidades y el movimiento resta ${Math.abs(efectoStock)}.`,
        { stockActual: producto.stockActual, cantidad: datos.cantidad },
      );
    }

    const creado = await tx.movimiento.create({
      data: {
        comercioId,
        productoId: producto.id,
        usuarioId,
        tipo: datos.tipo,
        cantidad: datos.cantidad,
        efectoStock,
        stockResultante,
        precioUnitario: datos.tipo === 'VENTA' ? producto.precioVenta : null,
        motivo: datos.motivo ?? null,
        observacion: datos.observacion ?? null,
        fecha: datos.fecha ? new Date(datos.fecha) : undefined,
        corrigeAId: datos.corrigeAId ?? null,
        claveIdempotencia: datos.claveIdempotencia ?? null,
      },
      select: { id: true },
    });
    await tx.producto.update({
      where: { id: producto.id },
      data: { stockActual: stockResultante },
      select: { id: true },
    });

    const movimiento = await this.obtenerEnTx(tx, comercioId, creado.id);
    if (!movimiento) throw new Error('El movimiento recién creado no se pudo leer.');
    return movimiento;
  }

  private async obtenerEnTx(
    tx: TransaccionRaw,
    comercioId: string,
    id: string,
  ): Promise<Movimiento | null> {
    const [fila] = await tx.$queryRaw<FilaMovimiento[]>(
      Prisma.sql`SELECT ${COLUMNAS} ${DESDE}
        WHERE m.id = ${id}::uuid AND m.comercio_id = ${comercioId}::uuid`,
    );
    return fila ? aMovimiento(fila) : null;
  }

  private async buscarPorClave(comercioId: string, clave: string): Promise<Movimiento | null> {
    return this.prisma.transaccionTenant(async (tx) => {
      const [fila] = await tx.$queryRaw<FilaMovimiento[]>(
        Prisma.sql`SELECT ${COLUMNAS} ${DESDE}
          WHERE m.comercio_id = ${comercioId}::uuid AND m.clave_idempotencia = ${clave}`,
      );
      return fila ? aMovimiento(fila) : null;
    });
  }
}

/** Violación de índice único (Idempotency-Key repetida o doble anulación en paralelo). */
function esConflictoDeClave(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
