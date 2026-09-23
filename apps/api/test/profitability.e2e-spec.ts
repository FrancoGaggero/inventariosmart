import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

describe('profitability: motor de rentabilidad (e2e)', () => {
  let t: AppDePrueba;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const empleada = persona('empleada');
  const contador = persona('contador');
  let comercioA: string;
  let filtroId: string;
  let aceiteId: string;
  const MES = '2026-08';

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const listar = (query = `periodo=${MES}`, quien = duenioA) =>
    t.http().get(`/api/v1/profitability/products?${query}`).set(auth(quien));
  const resumen = (periodo = MES, quien = duenioA) =>
    t.http().get(`/api/v1/profitability/summary?periodo=${periodo}`).set(auth(quien));
  const fila = async (id: string, query = `periodo=${MES}`) =>
    (await listar(query).expect(200)).body.items.find(
      (i: { producto: { id: string } }) => i.producto.id === id,
    );

  const crearProducto = async (
    quien: { token: string },
    datos: {
      codigo: string;
      nombre: string;
      precioVenta: number;
      costoReposicion: number;
      alicuotaIva?: number;
    },
  ): Promise<string> =>
    (
      await t
        .http()
        .post('/api/v1/products')
        .set(auth(quien))
        .send({ alicuotaIva: 21, stockInicial: 100, ...datos })
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
    filtroId = await crearProducto(duenioA, {
      codigo: 'FA-220',
      nombre: 'Filtro Aire FA-220',
      precioVenta: 12100,
      costoReposicion: 6000,
    });
    aceiteId = await crearProducto(duenioA, {
      codigo: 'AM-1L',
      nombre: 'Aceite Mineral 1L',
      precioVenta: 1105,
      costoReposicion: 800,
      alicuotaIva: 10.5,
    });
  });

  afterAll(async () => {
    await t.limpiar();
  });

  it('CP-03.1 y CP-03.3 margen bruto en pesos y porcentaje con la alícuota de cada producto', async () => {
    const filtro = await fila(filtroId);
    expect(filtro).toMatchObject({
      producto: { codigo: 'FA-220' },
      precioVenta: '12100.00',
      alicuotaIva: '21',
      precioNeto: '10000.00',
      costoReposicion: '6000.00',
      margenBruto: '4000.00',
      margenBrutoPct: '40.00',
      unidadesVendidas: 0,
      margenBrutoMes: '0.00',
    });
    const aceite = await fila(aceiteId);
    expect(aceite).toMatchObject({
      precioNeto: '1000.00',
      margenBruto: '200.00',
      margenBrutoPct: '20.00',
    });
  });

  it('CP-03.2b sin gastos el neto no es calculable', async () => {
    const res = await listar().expect(200);
    expect(res.body).toMatchObject({
      periodo: MES,
      gastoPorUnidad: null,
      motivoNeto: 'SIN_GASTOS',
    });
    for (const i of res.body.items) {
      expect(i.margenNeto).toBeNull();
      expect(i.margenNetoPct).toBeNull();
    }
    const cons = await resumen().expect(200);
    expect(cons.body).toMatchObject({
      unidadesVendidas: 0,
      ventasNetas: '0.00',
      margenBruto: '0.00',
      margenBrutoPct: null,
      gastos: '0.00',
      margenNeto: null,
      margenNetoPct: null,
      motivo: 'SIN_GASTOS',
    });
  });

  it('CP-03.2c con gastos pero sin ventas', async () => {
    await t
      .http()
      .post('/api/v1/expenses')
      .set(auth(duenioA))
      .send({
        concepto: 'Comisiones',
        tipo: 'VARIABLE',
        importe: 30000,
        periodo: MES,
        periodicidad: 'UNICO',
      })
      .expect(201);
    const res = await listar().expect(200);
    expect(res.body).toMatchObject({ gastoPorUnidad: null, motivoNeto: 'SIN_VENTAS' });
    const cons = await resumen().expect(200);
    expect(cons.body).toMatchObject({ gastos: '30000.00', margenNeto: null, motivo: 'SIN_VENTAS' });
  });

  it('CP-03.5 y CP-03.5c consolidado con ventas y gastos, sin contar la anulada', async () => {
    await venta(filtroId, 10, `${MES}-10T12:00:00-03:00`).expect(201);
    await venta(aceiteId, 5, `${MES}-12T12:00:00-03:00`).expect(201);
    const anulada = await venta(filtroId, 3, `${MES}-15T12:00:00-03:00`).expect(201);
    await t
      .http()
      .post(`/api/v1/movements/${anulada.body.id}/anular`)
      .set(auth(duenioA))
      .expect(201);

    const cons = await resumen().expect(200);
    expect(cons.body).toEqual({
      periodo: MES,
      unidadesVendidas: 15,
      ventasNetas: '105000.00',
      costoVendido: '64000.00',
      margenBruto: '41000.00',
      margenBrutoPct: '39.05',
      gastos: '30000.00',
      margenNeto: '11000.00',
      margenNetoPct: '10.48',
      motivo: null,
    });
    const filtro = await fila(filtroId);
    expect(filtro).toMatchObject({ unidadesVendidas: 10, margenBrutoMes: '40000.00' });
  });

  it('CP-03.2 margen neto por producto con el gasto por unidad del mes', async () => {
    // 30000 de gastos / 15 unidades = 2000 por unidad.
    const res = await listar().expect(200);
    expect(res.body).toMatchObject({ gastoPorUnidad: '2000.00', motivoNeto: null });
    const filtro = await fila(filtroId);
    expect(filtro).toMatchObject({ margenNeto: '2000.00', margenNetoPct: '20.00' });
    const aceite = await fila(aceiteId);
    expect(aceite).toMatchObject({ margenNeto: '-1800.00', margenNetoPct: '-180.00' });
  });

  it('CP-03.4 el margen se recalcula al cambiar el precio o el costo', async () => {
    await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .send({ precioVenta: 14520 })
      .expect(200);
    const proveedor = await t
      .http()
      .post('/api/v1/suppliers')
      .set(auth(duenioA))
      .send({ nombre: 'Norte' })
      .expect(201);
    await t
      .http()
      .post(`/api/v1/suppliers/${proveedor.body.id}/prices`)
      .set(auth(duenioA))
      .send({ items: [{ productoId: filtroId, costoNeto: 7000 }] })
      .expect(201);
    const filtro = await fila(filtroId);
    expect(filtro).toMatchObject({
      precioNeto: '12000.00',
      costoReposicion: '7000.00',
      margenBruto: '5000.00',
      margenBrutoPct: '41.67',
    });
  });

  it('CP-03.1b margen negativo y precio cero', async () => {
    const caro = await crearProducto(duenioA, {
      codigo: 'CARO',
      nombre: 'Caro de comprar',
      precioVenta: 1210,
      costoReposicion: 1500,
    });
    const gratis = await crearProducto(duenioA, {
      codigo: 'GRATIS',
      nombre: 'Muestra gratis',
      precioVenta: 0,
      costoReposicion: 600,
    });
    expect(await fila(caro)).toMatchObject({
      precioNeto: '1000.00',
      margenBruto: '-500.00',
      margenBrutoPct: '-50.00',
    });
    expect(await fila(gratis)).toMatchObject({
      precioNeto: '0.00',
      margenBruto: '-600.00',
      margenBrutoPct: null,
    });
  });

  it('CP-03.5b consolidado de un mes sin ventas ni gastos', async () => {
    const cons = await resumen('2026-05').expect(200);
    expect(cons.body).toMatchObject({
      ventasNetas: '0.00',
      margenBrutoPct: null,
      margenNeto: null,
      motivo: 'SIN_GASTOS',
    });
  });

  it('CP-03.6 sólo activos, búsqueda y paginación; mes inválido', async () => {
    const baja = await crearProducto(duenioA, {
      codigo: 'BAJA',
      nombre: 'Dado de baja',
      precioVenta: 100,
      costoReposicion: 50,
    });
    await t.http().delete(`/api/v1/products/${baja}`).set(auth(duenioA)).expect(200);
    const todos = await listar(`periodo=${MES}&limit=100`).expect(200);
    const esperados: string[] = todos.body.items.map(
      (i: { producto: { id: string } }) => i.producto.id,
    );
    expect(esperados).toHaveLength(4);
    expect(esperados).not.toContain(baja);

    const vistos: string[] = [];
    let cursor: string | null = null;
    do {
      const sufijo: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const res: {
        body: { items: { producto: { id: string } }[]; siguienteCursor: string | null };
      } = await listar(`periodo=${MES}&limit=2${sufijo}`).expect(200);
      vistos.push(...res.body.items.map((i) => i.producto.id));
      cursor = res.body.siguienteCursor;
    } while (cursor);
    expect(vistos).toEqual(esperados);

    const busqueda = await listar(`periodo=${MES}&q=am-`).expect(200);
    expect(
      busqueda.body.items.map((i: { producto: { codigo: string } }) => i.producto.codigo),
    ).toEqual(['AM-1L']);
    await listar('periodo=2026-13').expect(400);
  });

  it('CP-03.7 dueño y contador consultan; el empleado no', async () => {
    await listar(`periodo=${MES}`, contador).expect(200);
    await resumen(MES, contador).expect(200);
    const l = await listar(`periodo=${MES}`, empleada).expect(403);
    expect(l.body.code).toBe('SIN_PERMISO');
    await resumen(MES, empleada).expect(403);
  });

  it('CP-03.7b aislamiento: los números de A no incluyen a B', async () => {
    const deB = await crearProducto(duenioB, {
      codigo: 'FA-220',
      nombre: 'Filtro de B',
      precioVenta: 2420,
      costoReposicion: 1000,
    });
    await venta(deB, 4, `${MES}-20T12:00:00-03:00`, duenioB).expect(201);
    await t
      .http()
      .post('/api/v1/expenses')
      .set(auth(duenioB))
      .send({
        concepto: 'Gasto de B',
        tipo: 'FIJO',
        importe: 999,
        periodo: MES,
        periodicidad: 'UNICO',
      })
      .expect(201);

    const listaA = await listar(`periodo=${MES}&limit=100`).expect(200);
    expect(listaA.body.items.map((i: { producto: { id: string } }) => i.producto.id)).not.toContain(
      deB,
    );
    const consA = await resumen().expect(200);
    expect(consA.body).toMatchObject({ unidadesVendidas: 15, gastos: '30000.00' });
    const consB = await resumen(MES, duenioB).expect(200);
    expect(consB.body).toMatchObject({
      unidadesVendidas: 4,
      ventasNetas: '8000.00',
      costoVendido: '4000.00',
      gastos: '999.00',
    });
  });
});
