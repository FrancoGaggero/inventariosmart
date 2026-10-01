import { NOMBRES_HERRAMIENTA } from '@inventariosmart/shared';
import { noEncontrado } from '../common/errors';
import { HerramientasAsistente, mesCompleto } from './herramientas';

const UUID = '3f0e2a54-6a59-4a0e-9d0f-0d1a5f1f3c11';
const UUID_2 = '8b1d7c10-4c2e-4f6a-9a55-2f0b7f3e9d22';

function armar() {
  const servicios = {
    profitability: { resumenEntre: jest.fn(), topEntre: jest.fn(), ventasEntre: jest.fn() },
    products: { listar: jest.fn() },
    alerts: { listar: jest.fn(), resumen: jest.fn() },
    expenses: { resumen: jest.fn() },
    insights: { inflacion: jest.fn() },
    indicators: { obtener: jest.fn() },
    suppliers: { listar: jest.fn() },
    comparador: { producto: jest.fn() },
    orders: { crear: jest.fn() },
  };
  const herramientas = new HerramientasAsistente(
    servicios.profitability as never,
    servicios.products as never,
    servicios.alerts as never,
    servicios.expenses as never,
    servicios.insights as never,
    servicios.indicators as never,
    servicios.suppliers as never,
    servicios.comparador as never,
    servicios.orders as never,
  );
  return { herramientas, servicios };
}

const leer = (contenido: string) => JSON.parse(contenido) as Record<string, unknown>;

describe('herramientas del asistente (design D2)', () => {
  it('define las once consultas con su esquema de entrada', () => {
    const { herramientas } = armar();
    const definiciones = herramientas.definiciones();
    expect(definiciones.map((d) => d.nombre)).toEqual(NOMBRES_HERRAMIENTA);
    for (const d of definiciones) {
      expect(d.descripcion.length).toBeGreaterThan(20);
      expect(d.esquema).toMatchObject({ type: 'object' });
      expect(d.esquema).not.toHaveProperty('$schema');
      // El modelo nunca indica el comercio: lo fija el request.
      expect(JSON.stringify(d.esquema)).not.toMatch(/comercio/i);
    }
    const top = definiciones.find((d) => d.nombre === 'productos_mas_rentables');
    expect(top?.esquema).toMatchObject({ required: ['desde', 'hasta'] });
    expect(top?.descripcion).toMatch(/no por unidades/);
    const vendidos = definiciones.find((d) => d.nombre === 'productos_mas_vendidos');
    expect(vendidos?.esquema).toMatchObject({
      required: ['desde', 'hasta'],
      properties: { criterio: { enum: ['UNIDADES', 'FACTURACION'] } },
    });
    expect(vendidos?.descripcion).toMatch(/no por ganancia/);
  });

  it('CP-08.7e los más vendidos con un período inválido vuelven como error, sin consultar ventas', async () => {
    const { herramientas, servicios } = armar();
    for (const entrada of [
      { desde: '2026-09-16', hasta: '2026-09-01' },
      { desde: '2026-02-30', hasta: '2026-03-01' },
      { desde: '2025-09-01', hasta: '2026-09-30' },
      { desde: '2026-09-01', hasta: '2026-09-15', criterio: 'GANANCIA' },
    ]) {
      const r = await herramientas.ejecutar('productos_mas_vendidos', entrada);
      expect(r.error).toBe(true);
      expect(leer(r.contenido)['error']).toMatch(/no son válidos/);
    }
    expect(servicios.profitability.ventasEntre).not.toHaveBeenCalled();
  });

  it('los más vendidos traen totales y participación, por unidades si no se indica', async () => {
    const { herramientas, servicios } = armar();
    servicios.profitability.ventasEntre.mockResolvedValue([
      {
        id: UUID,
        codigo: 'FA-220',
        nombre: 'Filtro',
        activo: true,
        unidades: 40,
        importeConIva: '484000.00',
        alicuotaIva: '21',
      },
      {
        id: UUID_2,
        codigo: 'AC-5L',
        nombre: 'Aceite',
        activo: true,
        unidades: 120,
        importeConIva: '290400.00',
        alicuotaIva: '21',
      },
    ]);
    const r = await herramientas.ejecutar('productos_mas_vendidos', {
      desde: '2026-09-16',
      hasta: '2026-09-30',
    });
    expect(r.error).toBe(false);
    expect(servicios.profitability.ventasEntre).toHaveBeenCalledWith(
      new Date('2026-09-16T03:00:00.000Z'),
      new Date('2026-10-01T03:00:00.000Z'),
    );
    expect(leer(r.contenido)).toMatchObject({
      desde: '2026-09-16',
      hasta: '2026-09-30',
      criterio: 'UNIDADES',
      totalUnidades: 160,
      totalFacturacionNeta: '640000.00',
      productos: [
        {
          codigo: 'AC-5L',
          unidadesVendidas: 120,
          participacionUnidadesPct: 75,
          participacionFacturacionPct: 37.5,
        },
        {
          codigo: 'FA-220',
          unidadesVendidas: 40,
          participacionUnidadesPct: 25,
          participacionFacturacionPct: 62.5,
        },
      ],
    });
    const f = await herramientas.ejecutar('productos_mas_vendidos', {
      desde: '2026-09-16',
      hasta: '2026-09-30',
      criterio: 'FACTURACION',
      cantidad: 1,
    });
    expect(leer(f.contenido)).toMatchObject({
      criterio: 'FACTURACION',
      productos: [
        {
          codigo: 'FA-220',
          facturacionNeta: '400000.00',
          participacionFacturacionPct: 62.5,
          participacionUnidadesPct: 25,
        },
      ],
    });
  });

  it('una consulta que no existe o con datos inválidos vuelve como error, sin llamar al servicio', async () => {
    const { herramientas, servicios } = armar();
    const inexistente = await herramientas.ejecutar('borrar_todo', {});
    expect(inexistente.error).toBe(true);
    expect(leer(inexistente.contenido)['error']).toMatch(/No existe la consulta/);

    for (const entrada of [
      { desde: '2026-09-16', hasta: '2026-09-01' },
      { desde: '2026-02-30', hasta: '2026-03-01' },
      { desde: '2024-01-01', hasta: '2026-09-01' },
      { desde: '16/09/2026', hasta: '30/09/2026' },
      { desde: '2026-09-01', hasta: '2026-09-15', cantidad: 50 },
      null,
    ]) {
      const r = await herramientas.ejecutar('productos_mas_rentables', entrada);
      expect(r.error).toBe(true);
      expect(leer(r.contenido)['error']).toMatch(/no son válidos/);
    }
    expect(servicios.profitability.topEntre).not.toHaveBeenCalled();

    const orden = await herramientas.ejecutar('preparar_orden', {
      proveedorId: UUID,
      items: [{ productoId: UUID_2, cantidad: 0 }],
    });
    expect(orden.error).toBe(true);
    expect(servicios.orders.crear).not.toHaveBeenCalled();
  });

  it('convierte las fechas a instantes de Buenos Aires, con el último día inclusive', async () => {
    const { herramientas, servicios } = armar();
    servicios.profitability.topEntre.mockResolvedValue([]);
    const r = await herramientas.ejecutar('productos_mas_rentables', {
      desde: '2026-09-16',
      hasta: '2026-09-30',
    });
    expect(r.error).toBe(false);
    expect(servicios.profitability.topEntre).toHaveBeenCalledWith(
      new Date('2026-09-16T03:00:00.000Z'),
      new Date('2026-10-01T03:00:00.000Z'),
      5,
    );
  });

  it('el resumen usa los gastos del mes sólo si el rango es un mes calendario', async () => {
    const { herramientas, servicios } = armar();
    servicios.profitability.resumenEntre.mockResolvedValue({ unidadesVendidas: 0 });
    await herramientas.ejecutar('resumen_rentabilidad', {
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    await herramientas.ejecutar('resumen_rentabilidad', {
      desde: '2026-09-16',
      hasta: '2026-10-02',
    });
    expect(servicios.profitability.resumenEntre.mock.calls.map((c) => [c[2], c[3]])).toEqual([
      ['2026-09', 'mes'],
      ['2026-10', 'porUnidad'],
    ]);
    expect(mesCompleto('2026-02-01', '2026-02-28')).toBe('2026-02');
    expect(mesCompleto('2028-02-01', '2028-02-28')).toBeNull();
    expect(mesCompleto('2026-09-01', '2026-10-31')).toBeNull();
  });

  it('recorta los resultados a 10 filas', async () => {
    const { herramientas, servicios } = armar();
    servicios.insights.inflacion.mockResolvedValue({
      desde: '2026-04',
      hasta: '2026-09',
      recortado: false,
      variaciones: {},
      brechas: {},
      motivo: null,
      productos: Array.from({ length: 25 }, (_, i) => ({
        producto: { id: UUID, codigo: `P-${i}`, nombre: `Producto ${i}` },
        precioInicial: '100.00',
        precioFinal: '110.00',
        variacionPrecio: '10.00',
        variacionCosto: '12.00',
        variacionReal: String(-i),
        estado: i > 2 ? 'ATRASADO' : 'ALINEADO',
        precioSugeridoInflacion: '120.00',
      })),
    });
    const r = await herramientas.ejecutar('precios_frente_a_inflacion', {});
    const datos = leer(r.contenido) as {
      productos: { codigo: string }[];
      productosAtrasados: number;
    };
    expect(datos.productos).toHaveLength(10);
    // Los más atrasados primero.
    expect(datos.productos[0]?.codigo).toBe('P-24');
    expect(datos.productosAtrasados).toBe(22);

    servicios.products.listar.mockResolvedValue({ items: [], siguienteCursor: null });
    await herramientas.ejecutar('buscar_productos', { q: 'filtro' });
    expect(servicios.products.listar).toHaveBeenCalledWith({
      q: 'filtro',
      estado: undefined,
      activo: true,
      limit: 10,
    });
  });

  it('buscar_proveedores no devuelve correo, teléfono ni CUIT', async () => {
    const { herramientas, servicios } = armar();
    servicios.suppliers.listar.mockResolvedValue({
      items: [
        {
          id: UUID,
          nombre: 'Distribuidora Norte',
          contacto: 'Marta',
          email: 'ventas@norte.com',
          telefono: '11-5555-0001',
          whatsapp: '5491155550001',
          cuit: '30-12345678-9',
          canal: 'EMAIL',
          canalPreferido: null,
          leadTimeDias: 5,
          confiabilidad: 3,
          notas: 'Cobra los martes',
          activo: true,
        },
      ],
      siguienteCursor: null,
    });
    const r = await herramientas.ejecutar('buscar_proveedores', { q: 'norte' });
    expect(leer(r.contenido)).toEqual({
      proveedores: [
        {
          id: UUID,
          nombre: 'Distribuidora Norte',
          plazoEntregaDias: 5,
          confiabilidad: 3,
          puedeRecibirOrdenes: true,
        },
      ],
      hayMas: false,
    });
    expect(r.contenido).not.toMatch(/ventas@norte|5555|12345678|Marta|martes/);
  });

  it('preparar_orden crea el borrador y devuelve la acción para el dueño', async () => {
    const { herramientas, servicios } = armar();
    servicios.orders.crear.mockResolvedValue({
      id: UUID,
      numero: 'OC-0007',
      estado: 'BORRADOR',
      proveedor: { id: UUID_2, nombre: 'Norte', email: 'ventas@norte.com' },
      items: [{ cantidad: 20 }],
      totalNeto: '46800.00',
    });
    const r = await herramientas.ejecutar('preparar_orden', {
      proveedorId: UUID_2,
      items: [{ productoId: UUID, cantidad: 20 }],
    });
    expect(servicios.orders.crear).toHaveBeenCalledWith({
      proveedorId: UUID_2,
      items: [{ productoId: UUID, cantidad: 20 }],
      notas: null,
    });
    expect(r.accion).toEqual({
      tipo: 'ORDEN_BORRADOR',
      ordenId: UUID,
      numero: 'OC-0007',
      proveedor: 'Norte',
    });
    expect(leer(r.contenido)).toMatchObject({ estado: 'BORRADOR', numero: 'OC-0007' });
    expect(r.contenido).not.toMatch(/ventas@norte/);
  });

  it('un error del servicio vuelve al modelo con su mensaje; uno inesperado, sin detalles', async () => {
    const { herramientas, servicios } = armar();
    servicios.comparador.producto.mockRejectedValue(
      noEncontrado('No encontramos ese producto en tu comercio.'),
    );
    const r = await herramientas.ejecutar('comparar_proveedores', { productoId: UUID });
    expect(r).toEqual({
      contenido: JSON.stringify({ error: 'No encontramos ese producto en tu comercio.' }),
      error: true,
    });

    servicios.expenses.resumen.mockRejectedValue(new Error('connection terminated: host db-7'));
    const roto = await herramientas.ejecutar('gastos_del_periodo', { mes: '2026-09' });
    expect(roto.error).toBe(true);
    expect(roto.contenido).not.toMatch(/db-7/);
  });
});
