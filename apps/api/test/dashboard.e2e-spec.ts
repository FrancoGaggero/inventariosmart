import { randomUUID } from 'node:crypto';
import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

describe('financial-dashboard: panel financiero (e2e)', () => {
  let t: AppDePrueba;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const duenioC = persona('duenio-c');
  const empleada = persona('empleada');
  const contador = persona('contador');
  let comercioA: string;
  let comercioC: string;
  let usuarioC: string;
  let productoA: string;
  let productoB: string;
  let productoC: string;
  const MES = '2026-08';
  const ANTERIOR = '2026-07';

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const panel = (periodo = MES, quien = duenioA) =>
    t.http().get(`/api/v1/dashboard?periodo=${periodo}`).set(auth(quien));
  const crearProducto = async (
    quien: { token: string },
    datos: {
      codigo: string;
      nombre: string;
      precioVenta: number;
      costoReposicion: number;
      stockInicial: number;
      stockSeguridad?: number;
    },
  ): Promise<string> =>
    (
      await t
        .http()
        .post('/api/v1/products')
        .set(auth(quien))
        .send({ alicuotaIva: 21, stockSeguridad: 0, ...datos })
        .expect(201)
    ).body.id;
  const venta = (productoId: string, cantidad: number, fecha: string, quien = duenioA) =>
    t
      .http()
      .post('/api/v1/movements')
      .set(auth(quien))
      .send({ tipo: 'VENTA', productoId, cantidad, fecha });

  beforeAll(async () => {
    t = await crearAppDePrueba();
    comercioA = (await t.http().get('/api/v1/me').set(auth(duenioA)).expect(200)).body.comercio.id;
    await t.http().get('/api/v1/me').set(auth(duenioB)).expect(200);
    const meC = (await t.http().get('/api/v1/me').set(auth(duenioC)).expect(200)).body;
    comercioC = meC.comercio.id;
    usuarioC = meC.usuario.id;
    await t.prisma.comoSistema((tx) =>
      tx.comercio.update({ where: { id: comercioA }, data: { plan: 'PRO' } }),
    );
    for (const [p, rol] of [
      [empleada, 'EMPLEADO'],
      [contador, 'CONTADOR'],
    ] as const) {
      await t
        .http()
        .post('/api/v1/users')
        .set(auth(duenioA))
        .send({ email: p.email, rol })
        .expect(201);
      await t.http().get('/api/v1/me').set(auth(p)).expect(200);
    }
    // CP-04.1: A (stock final 10, costo 100, precio 121 → neto 100), B (sin stock), C (bajo: 3 de 5).
    productoA = await crearProducto(duenioA, {
      codigo: 'A',
      nombre: 'Producto A',
      precioVenta: 121,
      costoReposicion: 100,
      stockInicial: 26,
    });
    productoB = await crearProducto(duenioA, {
      codigo: 'B',
      nombre: 'Producto B',
      precioVenta: 60.5,
      costoReposicion: 50,
      stockInicial: 0,
    });
    productoC = await crearProducto(duenioA, {
      codigo: 'C',
      nombre: 'Producto C',
      precioVenta: 24.2,
      costoReposicion: 20,
      stockInicial: 3,
      stockSeguridad: 5,
    });
    await venta(productoA, 12, `${MES}-10T12:00:00-03:00`).expect(201);
    await venta(productoA, 4, `${ANTERIOR}-10T12:00:00-03:00`).expect(201);
    await t
      .http()
      .post('/api/v1/expenses')
      .set(auth(duenioA))
      .send({
        concepto: 'Comisiones',
        tipo: 'VARIABLE',
        importe: 60,
        periodo: MES,
        periodicidad: 'UNICO',
      })
      .expect(201);
  });

  afterAll(async () => {
    await t.limpiar();
  });

  it('CP-04.1 panel con datos del mes', async () => {
    const res = await panel().expect(200);
    expect(res.body.periodo).toBe(MES);
    expect(res.body.stock).toEqual({
      productosActivos: 3,
      unidades: 13,
      valorizacion: '1060.00',
      sinStock: 1,
      stockBajo: 1,
    });
    expect(res.body.ventas).toEqual({
      unidadesVendidas: 12,
      ventasNetas: '1200.00',
      costoVendido: '1200.00',
      margenBruto: '0.00',
      margenBrutoPct: '0.00',
      gastos: '60.00',
      margenNeto: '-60.00',
      margenNetoPct: '-5.00',
      motivo: null,
    });
    expect(res.body.mesAnterior).toEqual({
      periodo: ANTERIOR,
      unidadesVendidas: 4,
      ventasNetas: '400.00',
      variacionVentasPct: '200.00',
    });
    expect(res.body.topRentables).toEqual([
      {
        producto: { id: productoA, codigo: 'A', nombre: 'Producto A' },
        unidadesVendidas: 12,
        margenBruto: '0.00',
        margenBrutoPct: '0.00',
        margenBrutoMes: '0.00',
      },
    ]);
    expect(res.body.alertas).toEqual({
      sinStock: {
        total: 1,
        items: [
          { id: productoB, codigo: 'B', nombre: 'Producto B', stockActual: 0, stockSeguridad: 0 },
        ],
      },
      stockBajo: {
        total: 1,
        items: [
          { id: productoC, codigo: 'C', nombre: 'Producto C', stockActual: 3, stockSeguridad: 5 },
        ],
      },
      faltanGastos: false,
      // Plan PRO sin productos en alerta de reposición todavía (HU-06).
      reposicion: { total: 0, criticas: 0, items: [] },
    });
  });

  it('CP-04.2 una venta nueva se refleja en la siguiente consulta', async () => {
    await venta(productoA, 3, `${MES}-20T12:00:00-03:00`).expect(201);
    const res = await panel().expect(200);
    expect(res.body.ventas.unidadesVendidas).toBe(15);
    expect(res.body.stock.unidades).toBe(10);
  });

  it('CP-04.1c mes sin ventas ni gastos', async () => {
    const res = await panel('2026-05').expect(200);
    expect(res.body.ventas).toMatchObject({
      unidadesVendidas: 0,
      margenNeto: null,
      motivo: 'SIN_GASTOS',
    });
    expect(res.body.topRentables).toEqual([]);
    expect(res.body.mesAnterior.variacionVentasPct).toBeNull();
    expect(res.body.alertas.faltanGastos).toBe(true);
    expect(res.body.stock.productosActivos).toBe(3);
  });

  it('CP-04.1d mes inválido', async () => {
    const res = await panel('2026-13').expect(400);
    expect(res.body.details).toHaveProperty('periodo');
  });

  it('CP-04.1b top rentables ordenado por margen generado, sólo con ventas', async () => {
    // Comercio B: márgenes unitarios 50, 90 y 10 con 10 ventas cada uno → 500, 900, 100; uno sin ventas.
    const p500 = await crearProducto(duenioB, {
      codigo: 'P500',
      nombre: 'Medio',
      precioVenta: 121,
      costoReposicion: 50,
      stockInicial: 20,
    });
    const p900 = await crearProducto(duenioB, {
      codigo: 'P900',
      nombre: 'Estrella',
      precioVenta: 242,
      costoReposicion: 110,
      stockInicial: 20,
    });
    const p100 = await crearProducto(duenioB, {
      codigo: 'P100',
      nombre: 'Flojo',
      precioVenta: 121,
      costoReposicion: 90,
      stockInicial: 20,
    });
    await crearProducto(duenioB, {
      codigo: 'P0',
      nombre: 'Sin ventas',
      precioVenta: 121,
      costoReposicion: 10,
      stockInicial: 20,
    });
    for (const id of [p500, p900, p100])
      await venta(id, 10, `${MES}-05T12:00:00-03:00`, duenioB).expect(201);
    const res = await panel(MES, duenioB).expect(200);
    expect(
      res.body.topRentables.map((x: { producto: { codigo: string }; margenBrutoMes: string }) => [
        x.producto.codigo,
        x.margenBrutoMes,
      ]),
    ).toEqual([
      ['P900', '900.00'],
      ['P500', '500.00'],
      ['P100', '100.00'],
    ]);
    expect(res.body.topRentables[0]).toMatchObject({
      unidadesVendidas: 10,
      margenBruto: '90.00',
      margenBrutoPct: '45.00',
    });
  });

  it('CP-04.5 dueño y contador acceden; el empleado no', async () => {
    await panel(MES, contador).expect(200);
    const res = await panel(MES, empleada).expect(403);
    expect(res.body.code).toBe('SIN_PERMISO');
  });

  it('CP-04.5b aislamiento: el panel de A no incluye nada de B', async () => {
    const res = await panel().expect(200);
    expect(res.body.stock.productosActivos).toBe(3);
    expect(res.body.ventas.unidadesVendidas).toBe(15);
    expect(
      res.body.topRentables.map((x: { producto: { codigo: string } }) => x.producto.codigo),
    ).toEqual(['A']);
  });

  it('CP-04.1e alertas de reposición en el panel (PRO) y null en FREE', async () => {
    // Dos productos con ventas recientes que dejan el stock por debajo del umbral (RN-04):
    // D cobertura 3 días, E cobertura 9 días.
    const productoD = await crearProducto(duenioA, {
      codigo: 'D',
      nombre: 'Producto D',
      precioVenta: 121,
      costoReposicion: 100,
      stockInicial: 33,
    });
    const productoE = await crearProducto(duenioA, {
      codigo: 'E',
      nombre: 'Producto E',
      precioVenta: 121,
      costoReposicion: 100,
      stockInicial: 39,
    });
    const reciente = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await venta(productoD, 30, reciente).expect(201);
    await venta(productoE, 30, reciente).expect(201);
    await t.http().post('/api/v1/alerts/recalculate').set(auth(duenioA)).expect(200);

    const res = await panel(MES, duenioA).expect(200);
    expect(res.body.alertas.reposicion).toMatchObject({ total: 2, criticas: 1 });
    expect(
      res.body.alertas.reposicion.items.map(
        (i: { producto: { codigo: string } }) => i.producto.codigo,
      ),
    ).toEqual(['D', 'E']);
    expect(res.body.alertas.reposicion.items[0]).toMatchObject({
      severidad: 'CRITICA',
      stock: 3,
      diasCobertura: 3,
      cantidadSugerida: 34,
    });
    const free = await panel(MES, duenioB).expect(200);
    expect(free.body.alertas.reposicion).toBeNull();
  });

  it('CP-04.3 carga sintética: 5.000 productos y 50.000 movimientos en menos de 3 s', async () => {
    const productos = Array.from({ length: 5000 }, (_, i) => ({
      id: randomUUID(),
      comercioId: comercioC,
      codigo: `PERF-${i}`,
      codigoNormalizado: `PERF-${i}`,
      nombre: `Producto de carga ${String(i).padStart(4, '0')}`,
      precioVenta: 121,
      alicuotaIva: 21,
      costoReposicion: 70,
      stockActual: 100,
      stockSeguridad: 10,
    }));
    await t.prisma.comoSistema(async (tx) => {
      await tx.producto.createMany({ data: productos });
    });
    const LOTE = 5000;
    for (let lote = 0; lote < 50000 / LOTE; lote += 1) {
      const movimientos = Array.from({ length: LOTE }, (_, j) => {
        const n = lote * LOTE + j;
        const dia = (n % 28) + 1;
        return {
          comercioId: comercioC,
          productoId: productos[n % productos.length]!.id,
          usuarioId: usuarioC,
          tipo: 'VENTA' as const,
          cantidad: 1,
          efectoStock: -1,
          stockResultante: 99,
          precioUnitario: 121,
          fecha: new Date(`${MES}-${String(dia).padStart(2, '0')}T12:00:00-03:00`),
        };
      });
      await t.prisma.comoSistema((tx) => tx.movimiento.createMany({ data: movimientos }));
    }

    await panel(MES, duenioC).expect(200); // calentamiento
    const inicio = Date.now();
    const res = await panel(MES, duenioC).expect(200);
    const ms = Date.now() - inicio;
    expect(res.body.stock.productosActivos).toBe(5000);
    expect(res.body.ventas.unidadesVendidas).toBe(50000);
    expect(res.body.topRentables).toHaveLength(5);
    expect(ms).toBeLessThan(3000);
  }, 600_000);
});
