import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  COLUMNAS_IMPORTACION,
  contarFilas,
  DatosFilaProductoSchema,
  LIMITES_PLAN,
  type ColumnaImportacion,
  type DatosFilaProducto,
  type FilaImportacion,
  type ImportacionProductosConfirm,
  type ResultadoImportacionProductos,
  type VistaPreviaImportacion,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { noEncontrado, planRequerido, validacion } from '../common/errors';
import {
  leerMatriz,
  parsearEntero,
  parsearMonto,
  resolverColumnas,
  verificarTope,
} from '../common/planillas';
import { Prisma } from '../generated/prisma/client';
import { normalizarCodigo, ProductsService } from '../products/products.service';
import { PrismaService } from '../prisma/prisma.service';

interface ExistenteRow {
  id: string;
  codigoNormalizado: string;
  activo: boolean;
  stockActual: number;
}

const DEFINICION = Object.fromEntries(
  Object.entries(COLUMNAS_IMPORTACION).map(([campo, c]) => [campo, c.alias]),
) as unknown as Record<ColumnaImportacion, readonly string[]>;

const OBLIGATORIAS: ColumnaImportacion[] = ['codigo', 'nombre', 'precioVenta'];

/** Importación de productos desde planilla: vista previa y confirmación (HU-05). */
@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  /** Lee, valida y clasifica cada fila sin registrar nada (CP-05.1 a CP-05.3). */
  async vistaPrevia(archivo: Buffer, nombre: string): Promise<VistaPreviaImportacion> {
    const { comercioId } = TenantContext.requerido();
    const matriz = await leerMatriz(archivo, nombre);
    const columnas = resolverColumnas(matriz[0]!, DEFINICION);
    const faltan = OBLIGATORIAS.filter((c) => columnas[c] === null);
    if (faltan.length > 0) {
      throw validacion(
        `No encontramos las columnas obligatorias: ${faltan.map((c) => COLUMNAS_IMPORTACION[c].alias[0]).join(', ')}. Descargá la plantilla para ver el formato.`,
        { archivo: `Faltan las columnas: ${faltan.join(', ')}.` },
      );
    }
    const datos = matriz.slice(1);
    verificarTope(datos.length);

    const comercio = await this.prisma.tenant.comercio.findFirst({
      where: { id: comercioId },
      select: { plan: true, ivaDefault: true },
    });
    if (!comercio) throw noEncontrado('No encontramos tu comercio.');

    const celda = (fila: string[], campo: ColumnaImportacion): string => {
      const i = columnas[campo];
      return i === null ? '' : (fila[i] ?? '').trim();
    };

    // Códigos repetidos: la última fila gana (como en las listas de precios).
    const ultimaFilaPorCodigo = new Map<string, number>();
    datos.forEach((fila, i) => {
      const c = normalizarCodigo(celda(fila, 'codigo'));
      if (c) ultimaFilaPorCodigo.set(c, i + 1);
    });

    const existentes = await this.prisma.tenant.producto.findMany({
      where: { codigoNormalizado: { in: [...ultimaFilaPorCodigo.keys()] } },
      select: { id: true, codigoNormalizado: true, activo: true, stockActual: true },
    });
    const porCodigo = new Map(existentes.map((p) => [p.codigoNormalizado, p]));

    const filas: FilaImportacion[] = datos.map((fila, i) => {
      const numero = i + 1;
      const codigo = celda(fila, 'codigo');
      const base = {
        fila: numero,
        codigo,
        datos: null,
        productoId: null,
        stockActual: null,
        error: null,
      };
      const parsed = this.validarFila(fila, celda, comercio.ivaDefault);
      if (!parsed.ok) return { ...base, estado: 'INVALIDA', error: parsed.error };
      const normalizado = normalizarCodigo(codigo);
      const ultima = ultimaFilaPorCodigo.get(normalizado);
      if (ultima !== undefined && ultima !== numero) {
        return { ...base, estado: 'INVALIDA', error: `Código repetido: se usa la fila ${ultima}.` };
      }
      const existente = porCodigo.get(normalizado);
      if (!existente) return { ...base, estado: 'NUEVO', datos: parsed.datos };
      if (!existente.activo) {
        return {
          ...base,
          estado: 'INVALIDA',
          productoId: existente.id,
          error: 'El código pertenece a un producto dado de baja: reactivalo primero.',
        };
      }
      return {
        ...base,
        estado: 'ACTUALIZA',
        datos: parsed.datos,
        productoId: existente.id,
        stockActual: existente.stockActual,
      };
    });

    const conteos = contarFilas(filas);
    const activos = await this.prisma.tenant.producto.count({ where: { activo: true } });
    const limite = LIMITES_PLAN[comercio.plan].productos;
    const resultantes = activos + conteos.nuevos;
    return {
      filas,
      resumen: {
        ...conteos,
        productosActualesActivos: activos,
        productosResultantes: resultantes,
        limitePlan: limite,
        superaLimite: limite !== null && resultantes > limite,
      },
    };
  }

  /** Aplica las filas confirmadas en una transacción (CP-05.4). */
  async confirmar(dto: ImportacionProductosConfirm): Promise<ResultadoImportacionProductos> {
    const { comercioId, usuarioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const { plan, ivaDefault } = await this.products.bloquearComercio(tx, comercioId);
      const codigos = dto.filas.map((f) => normalizarCodigo(f.datos.codigo));
      const existentes = await tx.producto.findMany({
        where: { comercioId, codigoNormalizado: { in: codigos } },
        select: { id: true, codigoNormalizado: true, activo: true, stockActual: true },
      });
      const porCodigo = new Map<string, ExistenteRow>(
        existentes.map((p) => [p.codigoNormalizado, p]),
      );

      const crear: { fila: (typeof dto.filas)[number]; datos: DatosFilaProducto }[] = [];
      const actualizar: { id: string; datos: DatosFilaProducto }[] = [];
      const detalles: ResultadoImportacionProductos['detalles'] = [];
      for (const fila of dto.filas) {
        const parsed = DatosFilaProductoSchema.safeParse({
          ...fila.datos,
          alicuotaIva: fila.datos.alicuotaIva ?? Number(ivaDefault),
        });
        if (!parsed.success) {
          detalles.push({
            fila: fila.fila,
            codigo: fila.codigo,
            motivo: parsed.error.issues[0]?.message ?? 'Fila inválida.',
          });
          continue;
        }
        const existente = porCodigo.get(normalizarCodigo(parsed.data.codigo));
        if (existente && !existente.activo) {
          detalles.push({
            fila: fila.fila,
            codigo: fila.codigo,
            motivo: 'El código pertenece a un producto dado de baja: reactivalo primero.',
          });
          continue;
        }
        if (existente) actualizar.push({ id: existente.id, datos: parsed.data });
        else crear.push({ fila, datos: parsed.data });
      }

      const limite = LIMITES_PLAN[plan].productos;
      if (limite !== null && crear.length > 0) {
        const activos = await tx.producto.count({ where: { comercioId, activo: true } });
        if (activos + crear.length > limite) {
          throw planRequerido(
            'PRO',
            `El plan ${plan} admite hasta ${limite} productos activos y la importación dejaría ${activos + crear.length}. Pasá al plan PRO o importá menos productos.`,
          );
        }
      }

      if (crear.length > 0) {
        const productos = crear.map(({ datos }) => ({
          id: randomUUID(),
          comercioId,
          codigo: datos.codigo,
          codigoNormalizado: normalizarCodigo(datos.codigo),
          nombre: datos.nombre,
          categoria: datos.categoria ?? null,
          precioVenta: datos.precioVenta,
          alicuotaIva: datos.alicuotaIva ?? Number(ivaDefault),
          costoReposicion: datos.costoReposicion,
          stockActual: datos.stockInicial,
          stockSeguridad: datos.stockSeguridad,
        }));
        await tx.producto.createMany({ data: productos });
        // El stock inicial entra como INGRESO STOCK_INICIAL, igual que en el alta manual (HU-10).
        const ingresos = productos
          .filter((p) => p.stockActual > 0)
          .map((p) => ({
            comercioId,
            productoId: p.id,
            usuarioId,
            tipo: 'INGRESO' as const,
            cantidad: p.stockActual,
            efectoStock: p.stockActual,
            stockResultante: p.stockActual,
            motivo: 'STOCK_INICIAL' as const,
          }));
        if (ingresos.length > 0) await tx.movimiento.createMany({ data: ingresos });
      }

      if (actualizar.length > 0) {
        // Una sola sentencia para hasta 5.000 filas (D4). El stock actual no se toca (RN-07).
        await tx.$executeRaw(
          Prisma.sql`UPDATE producto p SET
              nombre = v.nombre,
              precio_venta = v.precio::numeric,
              costo_reposicion = v.costo::numeric,
              categoria = v.categoria,
              alicuota_iva = v.iva::numeric,
              stock_seguridad = v.seguridad,
              actualizado_en = now()
            FROM unnest(
              ${actualizar.map((a) => a.id)}::uuid[],
              ${actualizar.map((a) => a.datos.nombre)}::text[],
              ${actualizar.map((a) => a.datos.precioVenta)}::text[],
              ${actualizar.map((a) => a.datos.costoReposicion)}::text[],
              ${actualizar.map((a) => a.datos.categoria ?? null)}::text[],
              ${actualizar.map((a) => String(a.datos.alicuotaIva ?? Number(ivaDefault)))}::text[],
              ${actualizar.map((a) => a.datos.stockSeguridad)}::int[]
            ) AS v(id, nombre, precio, costo, categoria, iva, seguridad)
            WHERE p.id = v.id AND p.comercio_id = ${comercioId}::uuid`,
        );
      }

      return {
        creados: crear.length,
        actualizados: actualizar.length,
        omitidos: detalles.length,
        detalles,
      };
    });
  }

  private validarFila(
    fila: string[],
    celda: (fila: string[], campo: ColumnaImportacion) => string,
    ivaDefault: Prisma.Decimal | string | number,
  ): { ok: true; datos: DatosFilaProducto } | { ok: false; error: string } {
    const texto = (campo: ColumnaImportacion) => celda(fila, campo);
    const monto = (campo: ColumnaImportacion, vacio: string | undefined) => {
      const t = texto(campo);
      if (t === '') return vacio;
      return parsearMonto(t) ?? t; // el texto crudo hace fallar al esquema con su mensaje
    };
    const entero = (campo: ColumnaImportacion) => {
      const t = texto(campo);
      if (t === '') return 0;
      return parsearEntero(t) ?? t;
    };
    const iva = texto('alicuotaIva');
    const alicuota =
      iva === ''
        ? Number(ivaDefault)
        : parsearMonto(iva) !== null
          ? Number(parsearMonto(iva))
          : iva;
    const parsed = DatosFilaProductoSchema.safeParse({
      codigo: texto('codigo'),
      nombre: texto('nombre'),
      precioVenta: monto('precioVenta', undefined),
      costoReposicion: monto('costoReposicion', '0'),
      stockInicial: entero('stockInicial'),
      stockSeguridad: entero('stockSeguridad'),
      categoria: texto('categoria'),
      alicuotaIva: alicuota,
    });
    if (parsed.success) return { ok: true, datos: parsed.data };
    const errores = parsed.error.issues
      .slice(0, 2)
      .map((i) => `${String(i.path[0] ?? 'fila')}: ${i.message}`);
    return { ok: false, error: errores.join(' ') };
  }
}
