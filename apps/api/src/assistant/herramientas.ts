import { HttpException, Injectable, Logger } from '@nestjs/common';
import {
  ASISTENTE_MAX_FILAS,
  HERRAMIENTAS_ASISTENTE,
  MesSchema,
  ordenarPorAtraso,
  type AccionAsistente,
  type ApiError,
  type HerramientaAsistente,
  type Mes,
} from '@inventariosmart/shared';
import { z } from 'zod';
import { AlertsService } from '../alerts/alerts.service';
import { ExpensesService } from '../expenses/expenses.service';
import { IndicatorsService } from '../indicators/indicators.service';
import { InsightsService } from '../insights/insights.service';
import { ProductsService } from '../products/products.service';
import { ProfitabilityService } from '../profitability/profitability.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { SupplierComparisonService } from '../supplier-comparison/supplier-comparison.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import type { DefinicionHerramienta } from './modelo';

/** Argentina no tiene horario de verano: el desfase con UTC es fijo (−03:00). */
const DESFASE_BUENOS_AIRES = '-03:00';
const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_DIAS_RANGO = 366;
const MAX_ITEMS_ORDEN = 50;

/** JavaScript acepta "2026-02-30" y lo corre a marzo: se compara contra el día pedido. */
function existe(fecha: string): boolean {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

const FechaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Indicá la fecha como AAAA-MM-DD.')
  .refine(existe, { message: 'La fecha no existe.' })
  .describe('Fecha en formato AAAA-MM-DD (día de Buenos Aires).');

const RangoSchema = z
  .object({
    desde: FechaSchema.describe('Primer día del período, inclusive (AAAA-MM-DD).'),
    hasta: FechaSchema.describe('Último día del período, inclusive (AAAA-MM-DD).'),
  })
  .refine((r) => r.desde <= r.hasta, {
    path: ['desde'],
    message: 'El primer día no puede ser posterior al último.',
  })
  .refine(
    (r) => instante(r.hasta).getTime() - instante(r.desde).getTime() < MAX_DIAS_RANGO * DIA_MS,
    {
      path: ['hasta'],
      message: 'El período no puede superar un año.',
    },
  );

const instante = (fecha: string) => new Date(`${fecha}T00:00:00${DESFASE_BUENOS_AIRES}`);
const diaSiguiente = (fecha: string) => new Date(instante(fecha).getTime() + DIA_MS);

/** Si el rango es exactamente un mes calendario, ese mes; si no, null. */
export function mesCompleto(desde: string, hasta: string): Mes | null {
  if (desde.slice(0, 7) !== hasta.slice(0, 7) || !desde.endsWith('-01')) return null;
  const [anio, mes] = desde.split('-').map(Number) as [number, number];
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return Number(hasta.slice(8)) === ultimoDia ? (desde.slice(0, 7) as Mes) : null;
}

const ENTRADAS = {
  resumen_rentabilidad: RangoSchema,
  productos_mas_rentables: RangoSchema.safeExtend({
    cantidad: z
      .number()
      .int()
      .min(1)
      .max(ASISTENTE_MAX_FILAS)
      .default(5)
      .describe('Cuántos productos traer, de 1 a 10.'),
  }),
  buscar_productos: z.object({
    q: z.string().trim().max(120).optional().describe('Parte del código o del nombre.'),
    estado: z
      .enum(['OK', 'BAJO', 'SIN_STOCK'])
      .optional()
      .describe(
        'Filtra por estado de stock: OK, BAJO (en o bajo el stock de seguridad) o SIN_STOCK.',
      ),
  }),
  alertas_de_reposicion: z.object({}),
  gastos_del_periodo: z.object({
    mes: MesSchema.describe('Mes en formato AAAA-MM.'),
  }),
  precios_frente_a_inflacion: z.object({
    desde: MesSchema.optional().describe(
      'Primer mes (AAAA-MM). Sin indicarlo, los últimos 6 meses.',
    ),
    hasta: MesSchema.optional().describe('Último mes (AAAA-MM).'),
  }),
  indicadores_economicos: z.object({}),
  buscar_proveedores: z.object({
    q: z.string().trim().max(120).optional().describe('Parte del nombre del proveedor.'),
  }),
  comparar_proveedores: z.object({
    productoId: z.uuid().describe('Identificador del producto, obtenido con buscar_productos.'),
  }),
  preparar_orden: z.object({
    proveedorId: z.uuid().describe('Identificador del proveedor, obtenido con buscar_proveedores.'),
    items: z
      .array(
        z.object({
          productoId: z.uuid().describe('Identificador del producto.'),
          cantidad: z.number().int().min(1).max(100_000).describe('Unidades a pedir.'),
        }),
      )
      .min(1)
      .max(MAX_ITEMS_ORDEN),
    notas: z.string().trim().max(500).optional().describe('Aclaraciones para el proveedor.'),
  }),
} satisfies Record<HerramientaAsistente, z.ZodType>;

const DESCRIPCIONES: Record<HerramientaAsistente, string> = {
  resumen_rentabilidad:
    'Resumen de rentabilidad del comercio entre dos fechas: unidades vendidas, ventas netas, costo de lo vendido, margen bruto, gastos y margen neto. Todos los montos son netos de IVA.',
  productos_mas_rentables:
    'Productos con ventas entre dos fechas, ordenados por el margen bruto total que dejaron. Sirve para saber cuál fue el producto más rentable de un período.',
  buscar_productos:
    'Busca productos activos por código o nombre, o por estado de stock. Devuelve precio de venta (con IVA), costo de reposición (sin IVA), stock y proveedor principal. Trae como máximo 10.',
  alertas_de_reposicion:
    'Alertas de reposición activas: productos que hay que reponer, con su stock, días de cobertura, cantidad sugerida y proveedor.',
  gastos_del_periodo:
    'Gastos operativos de un mes: fijos, variables, total y gasto por unidad vendida.',
  precios_frente_a_inflacion:
    'Compara la variación de los precios y costos del comercio con el índice de precios del INDEC, e indica qué productos quedaron atrasados.',
  indicadores_economicos:
    'Últimos indicadores oficiales: inflación mensual e interanual y dólar minorista.',
  buscar_proveedores:
    'Busca proveedores activos por nombre. Devuelve plazo de entrega, confiabilidad y si pueden recibir órdenes.',
  comparar_proveedores:
    'Compara a los proveedores que venden un producto: costo, plazo, confiabilidad, puntaje y cuál se recomienda.',
  preparar_orden:
    'Crea una orden de compra EN BORRADOR para un proveedor. No la envía: el dueño la revisa y la confirma desde la pantalla de órdenes. Usala sólo cuando el dueño pida armar un pedido.',
};

export interface ResultadoEjecucion {
  /** Lo que recibe el modelo. */
  contenido: string;
  error: boolean;
  accion?: AccionAsistente;
}

const recortar = <T>(items: T[]): T[] => items.slice(0, ASISTENTE_MAX_FILAS);

/**
 * Consultas que el asistente puede pedir (HU-08, design D2). Cada una reutiliza un servicio de
 * la API dentro del comercio del request: el modelo nunca indica el comercio.
 */
@Injectable()
export class HerramientasAsistente {
  private readonly logger = new Logger(HerramientasAsistente.name);

  constructor(
    private readonly profitability: ProfitabilityService,
    private readonly products: ProductsService,
    private readonly alerts: AlertsService,
    private readonly expenses: ExpensesService,
    private readonly insights: InsightsService,
    private readonly indicators: IndicatorsService,
    private readonly suppliers: SuppliersService,
    private readonly comparador: SupplierComparisonService,
    private readonly orders: PurchaseOrdersService,
  ) {}

  /** Definiciones para el modelo: fijas, en el mismo orden siempre. */
  definiciones(): DefinicionHerramienta[] {
    return (Object.keys(ENTRADAS) as HerramientaAsistente[]).map((nombre) => {
      const { $schema: _omitido, ...esquema } = z.toJSONSchema(ENTRADAS[nombre], {
        io: 'input',
      }) as Record<string, unknown>;
      return { nombre, descripcion: DESCRIPCIONES[nombre], esquema };
    });
  }

  esHerramienta(nombre: string): nombre is HerramientaAsistente {
    return Object.hasOwn(HERRAMIENTAS_ASISTENTE, nombre);
  }

  /** Nunca lanza: un error vuelve al modelo como resultado, para que lo explique. */
  async ejecutar(nombre: string, entrada: unknown): Promise<ResultadoEjecucion> {
    if (!this.esHerramienta(nombre)) {
      return this.fallo(`No existe la consulta "${nombre}".`);
    }
    const parsed = ENTRADAS[nombre].safeParse(entrada ?? {});
    if (!parsed.success) {
      const detalle = parsed.error.issues
        .map((i) => `${i.path.join('.') || 'entrada'}: ${i.message}`)
        .join('; ');
      return this.fallo(`Los datos de la consulta no son válidos. ${detalle}`);
    }
    try {
      const { resultado, accion } = await this.correr(nombre, parsed.data);
      return { contenido: JSON.stringify(resultado), error: false, accion };
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() < 500) {
        const cuerpo = err.getResponse() as Partial<ApiError>;
        return this.fallo(cuerpo.message ?? 'No se pudo completar la consulta.');
      }
      this.logger.error({ err, herramienta: nombre }, 'Falló una consulta del asistente');
      return this.fallo('No se pudo completar la consulta por un error del sistema.');
    }
  }

  private fallo(mensaje: string): ResultadoEjecucion {
    return { contenido: JSON.stringify({ error: mensaje }), error: true };
  }

  private async correr(
    nombre: HerramientaAsistente,
    entrada: unknown,
  ): Promise<{ resultado: unknown; accion?: AccionAsistente }> {
    switch (nombre) {
      case 'resumen_rentabilidad': {
        const { desde, hasta } = entrada as z.infer<typeof ENTRADAS.resumen_rentabilidad>;
        const mes = mesCompleto(desde, hasta);
        const r = await this.profitability.resumenEntre(
          instante(desde),
          diaSiguiente(hasta),
          mes ?? (hasta.slice(0, 7) as Mes),
          mes ? 'mes' : 'porUnidad',
        );
        return {
          resultado: {
            desde,
            hasta,
            ...r,
            aclaracion: mes
              ? 'Los gastos son el total del mes.'
              : 'Los gastos se prorratean por unidad vendida en el período (RN-02).',
          },
        };
      }
      case 'productos_mas_rentables': {
        const { desde, hasta, cantidad } = entrada as z.infer<
          typeof ENTRADAS.productos_mas_rentables
        >;
        const top = await this.profitability.topEntre(
          instante(desde),
          diaSiguiente(hasta),
          cantidad,
        );
        return {
          resultado: {
            desde,
            hasta,
            productos: recortar(top).map((t) => ({
              id: t.producto.id,
              codigo: t.producto.codigo,
              nombre: t.producto.nombre,
              unidadesVendidas: t.unidadesVendidas,
              margenBrutoPorUnidad: t.margenBruto,
              margenBrutoPct: t.margenBrutoPct,
              margenBrutoTotal: t.margenBrutoMes,
            })),
          },
        };
      }
      case 'buscar_productos': {
        const { q, estado } = entrada as z.infer<typeof ENTRADAS.buscar_productos>;
        const lista = await this.products.listar({
          q,
          estado,
          activo: true,
          limit: ASISTENTE_MAX_FILAS,
        });
        return {
          resultado: {
            productos: lista.items.map((p) => ({
              id: p.id,
              codigo: p.codigo,
              nombre: p.nombre,
              categoria: p.categoria,
              precioVentaConIva: p.precioVenta,
              costoReposicionSinIva: p.costoReposicion ?? null,
              stockActual: p.stockActual,
              stockSeguridad: p.stockSeguridad,
              estadoStock: p.estadoStock,
              proveedorPrincipal: p.proveedorPrincipal?.nombre ?? null,
            })),
            hayMas: lista.siguienteCursor !== null,
          },
        };
      }
      case 'alertas_de_reposicion': {
        const lista = await this.alerts.listar({ estado: 'ACTIVA', limit: ASISTENTE_MAX_FILAS });
        const resumen = await this.alerts.resumen();
        return {
          resultado: {
            activas: resumen.activas,
            criticas: resumen.criticas,
            pospuestas: resumen.pospuestas,
            calculadasEn: resumen.calculadasEn,
            alertas: lista.items.map((a) => ({
              productoId: a.producto.id,
              codigo: a.producto.codigo,
              nombre: a.producto.nombre,
              severidad: a.severidad,
              stock: a.stock,
              diasCobertura: a.diasCobertura,
              puntoReposicion: a.puntoReposicion,
              cantidadSugerida: a.cantidadSugerida,
              proveedorId: a.proveedor?.id ?? null,
              proveedor: a.proveedor?.nombre ?? null,
            })),
            hayMas: lista.siguienteCursor !== null,
          },
        };
      }
      case 'gastos_del_periodo': {
        const { mes } = entrada as z.infer<typeof ENTRADAS.gastos_del_periodo>;
        return { resultado: await this.expenses.resumen(mes) };
      }
      case 'precios_frente_a_inflacion': {
        const q = entrada as z.infer<typeof ENTRADAS.precios_frente_a_inflacion>;
        const c = await this.insights.inflacion(q);
        return {
          resultado: {
            desde: c.desde,
            hasta: c.hasta,
            recortadoAlUltimoMesConIpc: c.recortado,
            variaciones: c.variaciones,
            brechas: c.brechas,
            motivo: c.motivo,
            productosAtrasados: c.productos.filter((p) => p.estado === 'ATRASADO').length,
            productos: recortar(ordenarPorAtraso(c.productos)).map((p) => ({
              id: p.producto.id,
              codigo: p.producto.codigo,
              nombre: p.producto.nombre,
              precioInicial: p.precioInicial,
              precioFinal: p.precioFinal,
              variacionPrecio: p.variacionPrecio,
              variacionCosto: p.variacionCosto,
              variacionReal: p.variacionReal,
              estado: p.estado,
              precioSugeridoInflacion: p.precioSugeridoInflacion,
            })),
          },
        };
      }
      case 'indicadores_economicos':
        return { resultado: await this.indicators.obtener() };
      case 'buscar_proveedores': {
        const { q } = entrada as z.infer<typeof ENTRADAS.buscar_proveedores>;
        const lista = await this.suppliers.listar({
          q,
          activo: true,
          limit: ASISTENTE_MAX_FILAS,
        });
        return {
          resultado: {
            // Sin correo, teléfono ni CUIT: el asistente no los necesita para responder.
            proveedores: lista.items.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              plazoEntregaDias: p.leadTimeDias,
              confiabilidad: p.confiabilidad,
              puedeRecibirOrdenes: p.canal !== null,
            })),
            hayMas: lista.siguienteCursor !== null,
          },
        };
      }
      case 'comparar_proveedores': {
        const { productoId } = entrada as z.infer<typeof ENTRADAS.comparar_proveedores>;
        const c = await this.comparador.producto(productoId);
        return {
          resultado: {
            producto: c.producto,
            proveedores: recortar(c.proveedores).map((p) => ({
              id: p.proveedor.id,
              nombre: p.proveedor.nombre,
              costoNeto: p.costoNeto,
              plazoEntregaDias: p.leadTimeDias,
              confiabilidad: p.confiabilidad,
              diferenciaPctContraElMasBarato: p.diferenciaPct,
              puntaje: p.puntaje,
              esPrincipal: p.esPrincipal,
            })),
            recomendado: c.recomendado?.nombre ?? null,
            masBarato: c.masBarato?.nombre ?? null,
            principal: c.principal?.nombre ?? null,
            convieneCambiar: c.cambiaProveedor,
            ahorroMensualEstimado: c.ahorroEstimado,
          },
        };
      }
      case 'preparar_orden': {
        const dto = entrada as z.infer<typeof ENTRADAS.preparar_orden>;
        const orden = await this.orders.crear({
          proveedorId: dto.proveedorId,
          items: dto.items,
          notas: dto.notas ?? null,
        });
        return {
          resultado: {
            ordenId: orden.id,
            numero: orden.numero,
            estado: orden.estado,
            proveedor: orden.proveedor.nombre,
            items: orden.items.length,
            totalNeto: orden.totalNeto,
            aviso:
              'La orden quedó en borrador y no se envió. El dueño la revisa y la confirma desde Órdenes.',
          },
          accion: {
            tipo: 'ORDEN_BORRADOR',
            ordenId: orden.id,
            numero: orden.numero,
            proveedor: orden.proveedor.nombre,
          },
        };
      }
    }
  }
}
