import { Injectable, Logger } from '@nestjs/common';
import {
  type CandidatoProveedor,
  type EstadoOrden,
  type GrupoSugerido,
  type ItemOrden,
  type ItemOrdenCreate,
  type ListaOrdenes,
  type MotivoEleccion,
  type OrdenCompra,
  type OrdenCreate,
  type OrdenPatch,
  type OrdenResumen,
  type OrdenesQuery,
  type SeveridadAlerta,
  type SugerenciaOrdenes,
  type SugerenciaQuery,
  elegirProveedor,
  formatearNumeroOrden,
  subtotalItem,
  totalOrden,
} from '@inventariosmart/shared';
import { AlertsService } from '../alerts/alerts.service';
import { Mailer } from '../alerts/mailer';
import { armarOrden, htmlDeOrden } from '../alerts/plantillas/orden';
import { TenantContext } from '../auth/tenant-context';
import { conflicto, noEncontrado, validacion } from '../common/errors';
import { Prisma } from '../generated/prisma/client';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';

/** Fila de la consulta de sugerencia (design D3): una alerta con su producto y sus candidatos. */
interface FilaSugerencia {
  alertaId: string;
  severidad: SeveridadAlerta;
  diasCobertura: number | null;
  cantidadSugerida: number;
  productoId: string;
  codigo: string;
  nombre: string;
  stockActual: number;
  costoReposicion: string;
  proveedorPrincipalId: string | null;
  candidatos: { proveedorId: string; costo: string; leadTimeDias: number; confiabilidad: number }[];
}

const INCLUIR_ORDEN = {
  proveedor: true,
  creadaPor: { select: { id: true, nombre: true } },
  confirmadaPor: { select: { id: true, nombre: true } },
  items: {
    include: {
      producto: { select: { id: true, codigo: true, nombre: true, stockActual: true } },
    },
    orderBy: [{ producto: { nombre: 'asc' } }, { id: 'asc' }],
  },
} satisfies Prisma.OrdenCompraInclude;

type OrdenRow = Prisma.OrdenCompraGetPayload<{ include: typeof INCLUIR_ORDEN }>;

const INCLUIR_RESUMEN = {
  proveedor: { select: { id: true, nombre: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrdenCompraInclude;

type ResumenRow = Prisma.OrdenCompraGetPayload<{ include: typeof INCLUIR_RESUMEN }>;

const SIN_COBERTURA = 999_999;
const MENSAJE_NO_ENCONTRADO = 'No encontramos esa orden de compra en tu comercio.';

function decimal(d: Prisma.Decimal | null): string | null {
  return d === null ? null : Number(d).toFixed(2);
}

/** El costo de reposición vale como estimación sólo si está cargado (mayor a cero). */
function costoReposicionOmitiendoCero(costo: string): string | null {
  return Number(costo) > 0 ? Number(costo).toFixed(2) : null;
}

function aProveedorOrden(p: OrdenRow['proveedor']) {
  return {
    id: p.id,
    nombre: p.nombre,
    contacto: p.contacto,
    email: p.email,
    leadTimeDias: p.leadTimeDias,
    confiabilidad: p.confiabilidad,
  };
}

function aItem(i: OrdenRow['items'][number]): ItemOrden {
  const costo = decimal(i.costoUnitarioNeto);
  return {
    id: i.id,
    producto: i.producto,
    alertaId: i.alertaId,
    cantidad: i.cantidad,
    costoUnitarioNeto: costo,
    subtotal: subtotalItem(i.cantidad, costo),
  };
}

export function aOrden(o: OrdenRow): OrdenCompra {
  return {
    id: o.id,
    numero: formatearNumeroOrden(o.numero),
    estado: o.estado,
    proveedor: aProveedorOrden(o.proveedor),
    items: o.items.map(aItem),
    totalNeto: Number(o.totalNeto).toFixed(2),
    asunto: o.asunto,
    texto: o.texto,
    textoEditado: o.textoEditado,
    notas: o.notas,
    motivoNoEnvio: o.motivoNoEnvio,
    creadaPor: o.creadaPor,
    confirmadaPor: o.confirmadaPor,
    confirmadaEn: o.confirmadaEn?.toISOString() ?? null,
    enviadaEn: o.enviadaEn?.toISOString() ?? null,
    enviadaA: o.enviadaA,
    canceladaEn: o.canceladaEn?.toISOString() ?? null,
    creadoEn: o.creadoEn.toISOString(),
    actualizadoEn: o.actualizadoEn.toISOString(),
  };
}

function aResumen(o: ResumenRow): OrdenResumen {
  return {
    id: o.id,
    numero: formatearNumeroOrden(o.numero),
    estado: o.estado,
    proveedor: o.proveedor,
    cantidadItems: o._count.items,
    totalNeto: Number(o.totalNeto).toFixed(2),
    motivoNoEnvio: o.motivoNoEnvio,
    confirmadaEn: o.confirmadaEn?.toISOString() ?? null,
    enviadaEn: o.enviadaEn?.toISOString() ?? null,
    creadoEn: o.creadoEn.toISOString(),
  };
}

/**
 * Órdenes de compra en modo copiloto (HU-07). La sugerencia es de sólo lectura, el borrador se
 * edita libremente y nada sale sin `confirmar()` (RN-06, design D3 y D4).
 */
@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    private readonly mailer: Mailer,
  ) {}

  /** Alertas abiertas agrupadas por proveedor más conveniente (CP-07.1, CP-07.1b, CP-07.1c). */
  async sugerir(q: SugerenciaQuery): Promise<SugerenciaOrdenes> {
    await this.alerts.recalcular({ soloSiVencido: true });
    const { comercioId } = TenantContext.requerido();
    const soloCriticas = q.severidad === 'CRITICA';
    const { filas, calculadasEn } = await this.prisma.transaccionTenant(async (tx) => {
      const filas = await tx.$queryRaw<FilaSugerencia[]>`
        SELECT a.id AS "alertaId", a.severidad, a.dias_cobertura AS "diasCobertura",
               a.cantidad_sugerida AS "cantidadSugerida",
               p.id AS "productoId", p.codigo, p.nombre, p.stock_actual AS "stockActual",
               p.costo_reposicion::text AS "costoReposicion",
               p.proveedor_principal_id AS "proveedorPrincipalId",
               COALESCE(c.candidatos, '[]'::json) AS candidatos
        FROM alerta a
        JOIN producto p ON p.id = a.producto_id
        LEFT JOIN LATERAL (
          SELECT json_agg(json_build_object(
                   'proveedorId', x.proveedor_id, 'costo', x.costo_neto::text,
                   'leadTimeDias', x.lead_time_dias, 'confiabilidad', x.confiabilidad)) AS candidatos
          FROM (
            SELECT DISTINCT ON (pp.proveedor_id) pp.proveedor_id, pp.costo_neto,
                   pr.lead_time_dias, pr.confiabilidad
            FROM precio_proveedor pp
            JOIN proveedor pr ON pr.id = pp.proveedor_id AND pr.activo
            WHERE pp.comercio_id = a.comercio_id AND pp.producto_id = p.id
            ORDER BY pp.proveedor_id, pp.vigente_desde DESC, pp.creado_en DESC
          ) x
        ) c ON true
        WHERE a.comercio_id = ${comercioId}::uuid AND a.estado = 'ACTIVA' AND p.activo
          AND (${!soloCriticas} OR a.severidad = 'CRITICA')
        ORDER BY COALESCE(a.dias_cobertura, ${SIN_COBERTURA}) ASC, a.id ASC`;
      const comercio = await tx.comercio.findUniqueOrThrow({
        where: { id: comercioId },
        select: { alertasCalculadasEn: true },
      });
      return { filas, calculadasEn: comercio.alertasCalculadasEn?.toISOString() ?? null };
    });

    const porProveedor = new Map<string, GrupoSugerido['items']>();
    const sinProveedor: SugerenciaOrdenes['sinProveedor'] = [];
    for (const f of filas) {
      const candidatos: CandidatoProveedor[] = f.candidatos.map((c) => ({
        proveedorId: c.proveedorId,
        costo: Number(c.costo),
        leadTimeDias: c.leadTimeDias,
        confiabilidad: c.confiabilidad,
      }));
      const eleccion = elegirProveedor(candidatos, f.proveedorPrincipalId);
      const producto = {
        id: f.productoId,
        codigo: f.codigo,
        nombre: f.nombre,
        stockActual: f.stockActual,
      };
      const cantidad = Math.max(1, f.cantidadSugerida);
      if (!eleccion) {
        sinProveedor.push({ producto, alertaId: f.alertaId, severidad: f.severidad, cantidad });
        continue;
      }
      const costo =
        eleccion.costo !== null
          ? eleccion.costo.toFixed(2)
          : costoReposicionOmitiendoCero(f.costoReposicion);
      const items = porProveedor.get(eleccion.proveedorId) ?? [];
      items.push({
        producto,
        alertaId: f.alertaId,
        severidad: f.severidad,
        diasCobertura: f.diasCobertura,
        cantidad,
        costoUnitarioNeto: costo,
        subtotal: subtotalItem(cantidad, costo),
        motivoEleccion: eleccion.motivo as MotivoEleccion,
      });
      porProveedor.set(eleccion.proveedorId, items);
    }

    // El proveedor principal elegido sin precio puede estar dado de baja: se excluye del pedido.
    const proveedores = await this.prisma.tenant.proveedor.findMany({
      where: { id: { in: [...porProveedor.keys()] }, activo: true },
    });
    const grupos: GrupoSugerido[] = [];
    for (const pr of proveedores) {
      const items = porProveedor.get(pr.id) ?? [];
      grupos.push({ proveedor: aProveedorOrden(pr), items, totalNeto: totalOrden(items) });
    }
    for (const [proveedorId, items] of porProveedor) {
      if (proveedores.some((p) => p.id === proveedorId)) continue;
      for (const i of items) {
        sinProveedor.push({
          producto: i.producto,
          alertaId: i.alertaId,
          severidad: i.severidad,
          cantidad: i.cantidad,
        });
      }
    }
    grupos.sort(
      (a, b) =>
        Number(b.totalNeto) - Number(a.totalNeto) ||
        a.proveedor.nombre.localeCompare(b.proveedor.nombre),
    );
    return { severidad: q.severidad, grupos, sinProveedor, calculadasEn };
  }

  /** Listado por cursor (creado_en DESC, id DESC) con filtro por estado (CP-07.5). */
  async listar(q: OrdenesQuery): Promise<ListaOrdenes> {
    const filas = await this.prisma.tenant.ordenCompra.findMany({
      where: q.estado === 'TODAS' ? {} : { estado: q.estado },
      include: INCLUIR_RESUMEN,
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hayMas = filas.length > q.limit;
    const pagina = hayMas ? filas.slice(0, q.limit) : filas;
    const ultimo = pagina[pagina.length - 1];
    return { items: pagina.map(aResumen), siguienteCursor: hayMas && ultimo ? ultimo.id : null };
  }

  async obtener(id: string): Promise<OrdenCompra> {
    const o = await this.prisma.tenant.ordenCompra.findFirst({
      where: { id },
      include: INCLUIR_ORDEN,
    });
    if (!o) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
    return aOrden(o);
  }

  /** Borrador nuevo con número correlativo por comercio y texto generado (CP-07.2, CP-07.2b). */
  async crear(dto: OrdenCreate): Promise<OrdenCompra> {
    const { comercioId, usuarioId } = TenantContext.requerido();
    const id = await this.prisma.transaccionTenant(async (tx) => {
      const proveedor = await this.proveedorValido(tx, comercioId, dto.proveedorId);
      const items = await this.itemsConCosto(tx, comercioId, proveedor.id, dto.items);
      // Un número por comercio a la vez: el lock evita dos OC-0007 con pedidos simultáneos.
      const [fila] = await tx.$queryRaw<{ siguiente: number }[]>`
        SELECT pg_advisory_xact_lock(hashtext(${`oc:${comercioId}`}))::text AS lock,
               COALESCE(max(numero), 0)::int + 1 AS siguiente
        FROM orden_compra WHERE comercio_id = ${comercioId}::uuid`;
      const numero = fila?.siguiente ?? 1;
      const totalNeto = totalOrden(items);
      const { asunto, texto } = await this.redactar(tx, comercioId, usuarioId, {
        numero,
        proveedor,
        items,
        totalNeto,
      });
      const creada = await tx.ordenCompra.create({
        data: {
          comercioId,
          numero,
          proveedorId: proveedor.id,
          asunto,
          texto,
          notas: dto.notas ?? null,
          totalNeto,
          creadaPorId: usuarioId,
          items: {
            create: items.map((i) => ({
              comercioId,
              productoId: i.productoId,
              alertaId: i.alertaId ?? null,
              cantidad: i.cantidad,
              costoUnitarioNeto: i.costoUnitarioNeto,
            })),
          },
        },
        select: { id: true },
      });
      return creada.id;
    });
    return this.obtener(id);
  }

  /** Edición de un BORRADOR: proveedor, ítems, notas, asunto y texto (CP-07.2, CP-07.3b). */
  async editar(id: string, dto: OrdenPatch): Promise<OrdenCompra> {
    const { comercioId, usuarioId } = TenantContext.requerido();
    await this.prisma.transaccionTenant(async (tx) => {
      const orden = await tx.ordenCompra.findFirst({
        where: { id, comercioId },
        include: { proveedor: true, items: true },
      });
      if (!orden) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
      this.exigirBorrador(orden.estado);

      const proveedor =
        dto.proveedorId && dto.proveedorId !== orden.proveedorId
          ? await this.proveedorValido(tx, comercioId, dto.proveedorId)
          : orden.proveedor;
      const cambianItems = dto.items !== undefined || proveedor.id !== orden.proveedorId;
      const items = cambianItems
        ? await this.itemsConCosto(
            tx,
            comercioId,
            proveedor.id,
            dto.items ??
              orden.items.map((i) => ({
                productoId: i.productoId,
                cantidad: i.cantidad,
                alertaId: i.alertaId,
              })),
          )
        : orden.items.map((i) => ({
            productoId: i.productoId,
            cantidad: i.cantidad,
            alertaId: i.alertaId,
            costoUnitarioNeto: decimal(i.costoUnitarioNeto),
          }));
      const totalNeto = totalOrden(items);

      const data: Prisma.OrdenCompraUncheckedUpdateInput = {
        proveedorId: proveedor.id,
        totalNeto,
        actualizadoEn: new Date(),
      };
      if (dto.notas !== undefined) data.notas = dto.notas;
      // El texto: el del dueño manda hasta que pida regenerarlo (HU-07 criterio 2).
      const editaTexto = dto.texto !== undefined || dto.asunto !== undefined;
      if (editaTexto && !dto.regenerarTexto) {
        if (dto.texto !== undefined) data.texto = dto.texto;
        if (dto.asunto !== undefined) data.asunto = dto.asunto;
        data.textoEditado = true;
      } else if (dto.regenerarTexto || (!orden.textoEditado && cambianItems)) {
        const redactado = await this.redactar(tx, comercioId, usuarioId, {
          numero: orden.numero,
          proveedor,
          items,
          totalNeto,
        });
        data.asunto = redactado.asunto;
        data.texto = redactado.texto;
        data.textoEditado = false;
      }

      if (cambianItems) {
        await tx.ordenCompraItem.deleteMany({ where: { ordenId: id, comercioId } });
        await tx.ordenCompraItem.createMany({
          data: items.map((i) => ({
            comercioId,
            ordenId: id,
            productoId: i.productoId,
            alertaId: i.alertaId ?? null,
            cantidad: i.cantidad,
            costoUnitarioNeto: i.costoUnitarioNeto,
          })),
        });
      }
      await tx.ordenCompra.update({ where: { id }, data });
    });
    return this.obtener(id);
  }

  /**
   * Confirmación explícita (RN-06, CP-07.4): registra quién y cuándo, atiende las alertas abiertas
   * de los productos y envía el correo después del commit; el estado final se escribe aparte.
   */
  async confirmar(id: string): Promise<OrdenCompra> {
    const { comercioId, usuarioId } = TenantContext.requerido();
    const ahora = new Date();
    const paraEnviar = await this.prisma.transaccionTenant(async (tx) => {
      const orden = await tx.ordenCompra.findFirst({
        where: { id, comercioId },
        include: INCLUIR_ORDEN,
      });
      if (!orden) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
      this.exigirBorrador(orden.estado);
      const email = orden.proveedor.email;
      // updateMany con condición de estado: dos confirmaciones simultáneas no pasan las dos.
      const r = await tx.ordenCompra.updateMany({
        where: { id, comercioId, estado: 'BORRADOR' },
        data: {
          estado: 'CONFIRMADA',
          confirmadaPorId: usuarioId,
          confirmadaEn: ahora,
          motivoNoEnvio: email ? null : 'SIN_EMAIL',
          actualizadoEn: ahora,
        },
      });
      if (r.count === 0) throw conflicto('La orden ya fue confirmada.');
      // Por producto y no por alerta_id del ítem: cubre alertas generadas después del borrador (D4).
      const productos = orden.items.map((i) => i.productoId);
      await tx.$executeRaw`
        UPDATE alerta
        SET estado = 'ATENDIDA', atendida_en = ${ahora}, pospuesta_hasta = NULL,
            actualizada_en = ${ahora}, orden_compra_id = ${id}::uuid
        WHERE comercio_id = ${comercioId}::uuid AND producto_id = ANY(${productos}::uuid[])
          AND estado IN ('ACTIVA', 'POSPUESTA')`;
      if (!email) return null;
      const quien = await tx.usuario.findFirst({
        where: { id: usuarioId, comercioId },
        select: { email: true },
      });
      return { email, responderA: quien?.email, asunto: orden.asunto, texto: orden.texto };
    });

    if (paraEnviar) {
      const enviado = await this.mailer.enviar({
        para: [paraEnviar.email],
        asunto: paraEnviar.asunto,
        html: htmlDeOrden(paraEnviar.texto),
        texto: paraEnviar.texto,
        ...(paraEnviar.responderA ? { responderA: paraEnviar.responderA } : {}),
      });
      await this.prisma.tenant.ordenCompra.update({
        where: { id },
        data: enviado
          ? { estado: 'ENVIADA', enviadaEn: new Date(), enviadaA: paraEnviar.email }
          : { motivoNoEnvio: 'ENVIO_FALLIDO' },
      });
      if (!enviado) {
        this.logger.warn({ orden: id, para: paraEnviar.email }, 'Orden confirmada sin enviar');
      }
    }
    return this.obtener(id);
  }

  /** Un BORRADOR pasa a CANCELADA y se conserva (CP-07.5b). */
  async cancelar(id: string): Promise<OrdenCompra> {
    const { comercioId } = TenantContext.requerido();
    await this.prisma.transaccionTenant(async (tx) => {
      const orden = await tx.ordenCompra.findFirst({ where: { id, comercioId } });
      if (!orden) throw noEncontrado(MENSAJE_NO_ENCONTRADO);
      this.exigirBorrador(orden.estado);
      const ahora = new Date();
      await tx.ordenCompra.update({
        where: { id },
        data: { estado: 'CANCELADA', canceladaEn: ahora, actualizadoEn: ahora },
      });
    });
    return this.obtener(id);
  }

  private exigirBorrador(estado: EstadoOrden): void {
    if (estado !== 'BORRADOR') {
      throw conflicto('Sólo se puede modificar una orden en borrador.', { estado });
    }
  }

  private async proveedorValido(tx: TransaccionRaw, comercioId: string, proveedorId: string) {
    const proveedor = await tx.proveedor.findFirst({ where: { id: proveedorId, comercioId } });
    if (!proveedor) throw noEncontrado('No encontramos ese proveedor en tu comercio.');
    if (!proveedor.activo) {
      throw validacion('El proveedor está dado de baja.', {
        proveedorId: 'Elegí un proveedor activo.',
      });
    }
    return proveedor;
  }

  /**
   * Valida los productos y les asigna el costo vigente del proveedor; sin precio de ese
   * proveedor, el costo de reposición del producto; sin ninguno, null ("a confirmar").
   */
  private async itemsConCosto(
    tx: TransaccionRaw,
    comercioId: string,
    proveedorId: string,
    items: ItemOrdenCreate[],
  ): Promise<(ItemOrdenCreate & { costoUnitarioNeto: string | null })[]> {
    const ids = items.map((i) => i.productoId);
    const productos = await tx.producto.findMany({
      where: { id: { in: ids }, comercioId },
      select: { id: true, activo: true, costoReposicion: true },
    });
    const porId = new Map(productos.map((p) => [p.id, p]));
    if (productos.length !== ids.length) {
      throw noEncontrado('Alguno de los productos no existe en tu comercio.');
    }
    const inactivos = productos.filter((p) => !p.activo);
    if (inactivos.length > 0) {
      throw validacion('Hay productos dados de baja en la orden.', {
        items: 'Quitá los productos dados de baja.',
      });
    }
    const alertas = items.map((i) => i.alertaId).filter((a): a is string => !!a);
    if (alertas.length > 0) {
      const encontradas = await tx.alerta.count({ where: { id: { in: alertas }, comercioId } });
      if (encontradas !== new Set(alertas).size) {
        throw noEncontrado('Alguna de las alertas no existe en tu comercio.');
      }
    }
    const precios = await tx.$queryRaw<{ productoId: string; costo: string }[]>`
      SELECT DISTINCT ON (pp.producto_id) pp.producto_id AS "productoId", pp.costo_neto::text AS costo
      FROM precio_proveedor pp
      WHERE pp.comercio_id = ${comercioId}::uuid AND pp.proveedor_id = ${proveedorId}::uuid
        AND pp.producto_id = ANY(${ids}::uuid[])
      ORDER BY pp.producto_id, pp.vigente_desde DESC, pp.creado_en DESC`;
    const costoDe = new Map(precios.map((p) => [p.productoId, Number(p.costo).toFixed(2)]));
    return items.map((i) => ({
      ...i,
      costoUnitarioNeto:
        costoDe.get(i.productoId) ??
        costoReposicionOmitiendoCero(Number(porId.get(i.productoId)!.costoReposicion).toFixed(2)),
    }));
  }

  /** Texto generado con la plantilla (D4): nombres de productos, comercio y dueño desde la base. */
  private async redactar(
    tx: TransaccionRaw,
    comercioId: string,
    usuarioId: string,
    o: {
      numero: number;
      proveedor: { nombre: string; contacto: string | null; leadTimeDias: number };
      items: (ItemOrdenCreate & { costoUnitarioNeto: string | null })[];
      totalNeto: string;
    },
  ): Promise<{ asunto: string; texto: string }> {
    const [comercio, duenio, productos] = await Promise.all([
      tx.comercio.findUniqueOrThrow({ where: { id: comercioId }, select: { nombre: true } }),
      tx.usuario.findFirst({
        where: { id: usuarioId, comercioId },
        select: { nombre: true, email: true },
      }),
      tx.producto.findMany({
        where: { id: { in: o.items.map((i) => i.productoId) }, comercioId },
        select: { id: true, codigo: true, nombre: true },
      }),
    ]);
    const porId = new Map(productos.map((p) => [p.id, p]));
    return armarOrden({
      numero: formatearNumeroOrden(o.numero),
      comercio,
      proveedor: o.proveedor,
      items: o.items.map((i) => {
        const p = porId.get(i.productoId)!;
        return {
          codigo: p.codigo,
          nombre: p.nombre,
          cantidad: i.cantidad,
          costoUnitarioNeto: i.costoUnitarioNeto,
        };
      }),
      totalNeto: o.totalNeto,
      duenio: { nombre: duenio?.nombre ?? null, email: duenio?.email ?? '' },
    });
  }
}
