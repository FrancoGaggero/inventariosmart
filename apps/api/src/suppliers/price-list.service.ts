import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  resumirVistaPrevia,
  type FilaVistaPrevia,
  type ImportacionConfirm,
  type ResultadoImportacion,
  type VistaPrevia,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { normalizarCodigo } from '../products/products.service';
import { type FilaPlanilla, parsearMonto, parsearPlanilla } from './price-list.parser';
import { PricesService } from './prices.service';
import { PrismaService } from '../prisma/prisma.service';

interface ProductoPorCodigo {
  id: string;
  codigoNormalizado: string;
  nombre: string;
  activo: boolean;
}

/** Importación de listas de precios en dos pasos: vista previa y confirmación (design D5). */
@Injectable()
export class PriceListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: PricesService,
  ) {}

  /** Lee la planilla y clasifica cada fila sin registrar nada (CP-02.4d). */
  async vistaPrevia(proveedorId: string, archivo: Buffer, nombre: string): Promise<VistaPrevia> {
    const { comercioId } = TenantContext.requerido();
    const filas = await parsearPlanilla(archivo, nombre);

    return this.prisma.transaccionTenant(async (tx) => {
      await this.prices.proveedorActivo(tx, comercioId, proveedorId);

      const codigos = [...new Set(filas.map((f) => normalizarCodigo(f.codigo)).filter(Boolean))];
      const productos = await tx.producto.findMany({
        where: { comercioId, codigoNormalizado: { in: codigos } },
        select: { id: true, codigoNormalizado: true, nombre: true, activo: true },
      });
      const porCodigo = new Map<string, ProductoPorCodigo>(
        productos.map((p) => [p.codigoNormalizado, p]),
      );
      const ultimos = await this.prices.ultimosCostos(
        tx,
        comercioId,
        proveedorId,
        productos.map((p) => p.id),
      );

      // Códigos repetidos: la última fila gana, las anteriores quedan inválidas.
      const ultimaFilaPorCodigo = new Map<string, number>();
      for (const f of filas) {
        const c = normalizarCodigo(f.codigo);
        if (c) ultimaFilaPorCodigo.set(c, f.fila);
      }

      const resultado = filas.map((f) =>
        this.clasificar(f, porCodigo, ultimos, ultimaFilaPorCodigo),
      );
      return { filas: resultado, resumen: resumirVistaPrevia(resultado) };
    });
  }

  /** Registra los costos confirmados como un lote IMPORT, ignorando los que ya son vigentes (CP-02.4e). */
  async confirmar(proveedorId: string, dto: ImportacionConfirm): Promise<ResultadoImportacion> {
    const { comercioId } = TenantContext.requerido();
    const loteId = randomUUID();
    return this.prisma.transaccionTenant(async (tx) => {
      await this.prices.proveedorActivo(tx, comercioId, proveedorId);
      const ultimos = await this.prices.ultimosCostos(
        tx,
        comercioId,
        proveedorId,
        dto.items.map((i) => i.productoId),
      );
      const items = dto.items.filter((i) => ultimos.get(i.productoId) !== i.costoNeto);
      if (items.length === 0) return { loteId, insertados: 0, productosActualizados: 0 };
      const r = await this.prices.registrarEnTransaccion(tx, {
        proveedorId,
        items,
        origen: 'IMPORT',
        loteId,
      });
      return { loteId, insertados: r.filas.length, productosActualizados: r.productosActualizados };
    });
  }

  private clasificar(
    f: FilaPlanilla,
    porCodigo: Map<string, ProductoPorCodigo>,
    ultimos: Map<string, string>,
    ultimaFilaPorCodigo: Map<string, number>,
  ): FilaVistaPrevia {
    const base = {
      fila: f.fila,
      codigo: f.codigo,
      costoNeto: null as string | null,
      productoId: null as string | null,
      nombre: null as string | null,
      costoAnterior: null as string | null,
      error: null as string | null,
    };
    const codigo = normalizarCodigo(f.codigo);
    if (!codigo) return { ...base, estado: 'INVALIDA', error: 'Falta el código de producto.' };
    const costoNeto = parsearMonto(f.costoTexto);
    if (costoNeto === null) {
      return {
        ...base,
        estado: 'INVALIDA',
        error: `Costo inválido: "${f.costoTexto}". Ingresá un número sin signo.`,
      };
    }
    const ultimaFila = ultimaFilaPorCodigo.get(codigo);
    if (ultimaFila !== undefined && ultimaFila !== f.fila) {
      return {
        ...base,
        costoNeto,
        estado: 'INVALIDA',
        error: `Código repetido: se usa la fila ${ultimaFila}.`,
      };
    }
    const producto = porCodigo.get(codigo);
    if (!producto) return { ...base, costoNeto, estado: 'SIN_PRODUCTO' };
    if (!producto.activo) {
      return {
        ...base,
        costoNeto,
        productoId: producto.id,
        nombre: producto.nombre,
        estado: 'INVALIDA',
        error: 'El producto está dado de baja.',
      };
    }
    const anterior = ultimos.get(producto.id) ?? null;
    const estado = anterior === null ? 'NUEVO' : anterior === costoNeto ? 'IGUAL' : 'CAMBIA';
    return {
      ...base,
      costoNeto,
      productoId: producto.id,
      nombre: producto.nombre,
      costoAnterior: anterior,
      estado,
    };
  }
}
