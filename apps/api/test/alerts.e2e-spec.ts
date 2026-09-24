import { randomUUID } from 'node:crypto';
import { LogMailer, Mailer } from '../src/alerts/mailer';
import { type AppDePrueba, conCargaExclusiva, crearAppDePrueba, persona } from './helpers';

const DIA = 24 * 60 * 60 * 1000;
const haceDias = (n: number) => new Date(Date.now() - n * DIA).toISOString();

describe('restock-alerts: alertas predictivas de reposición (e2e)', () => {
  let t: AppDePrueba;
  let mailer: LogMailer;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const duenioF = persona('duenio-free');
  const empleada = persona('empleada');
  const contador = persona('contador');
  let comercioA: string;
  let filtroId: string;
  let alertaFiltroId: string;

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const recalcular = (quien = duenioA) =>
    t.http().post('/api/v1/alerts/recalculate').set(auth(quien));
  const listar = (query = 'estado=ACTIVA', quien = duenioA) =>
    t.http().get(`/api/v1/alerts?${query}`).set(auth(quien));
  const resumen = (quien = duenioA) => t.http().get('/api/v1/alerts/summary').set(auth(quien));
  const accion = (id: string, accion: string, quien = duenioA) =>
    t.http().patch(`/api/v1/alerts/${id}`).set(auth(quien)).send({ accion });
  const movimiento = (body: object, quien = duenioA) =>
    t.http().post('/api/v1/movements').set(auth(quien)).send(body);
  const crearProducto = async (
    datos: {
      codigo: string;
      nombre: string;
      stockInicial: number;
      stockSeguridad?: number;
      diasAnticipacionAlerta?: number;
    },
    quien = duenioA,
  ): Promise<string> =>
    (
      await t
        .http()
        .post('/api/v1/products')
        .set(auth(quien))
        .send({ precioVenta: 3900, costoReposicion: 2100, alicuotaIva: 21, ...datos })
        .expect(201)
    ).body.id;
  const alertaDe = async (productoId: string, query = 'estado=TODAS') =>
    (await listar(query).expect(200)).body.items.filter(
      (a: { producto: { id: string } }) => a.producto.id === productoId,
    );

  beforeAll(async () => {
    t = await crearAppDePrueba();
    mailer = t.app.get(Mailer) as LogMailer;
    comercioA = (await t.http().get('/api/v1/me').set(auth(duenioA)).expect(200)).body.comercio.id;
    const comercioB = (await t.http().get('/api/v1/me').set(auth(duenioB)).expect(200)).body
      .comercio.id;
    await t.http().get('/api/v1/me').set(auth(duenioF)).expect(200);
    await t.prisma.comoSistema((tx) =>
      tx.comercio.updateMany({
        where: { id: { in: [comercioA, comercioB] } },
        data: { plan: 'PRO' },
      }),
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
    // CP-06.1: proveedor Norte (lead time 5), FA-220 con seguridad 4, 60 unidades vendidas en 30 días
    // (stock inicial 78 → 18) y anticipación 3 (default).
    const norteId = (
      await t
        .http()
        .post('/api/v1/suppliers')
        .set(auth(duenioA))
        .send({ nombre: 'Norte', leadTimeDias: 5 })
        .expect(201)
    ).body.id;
    filtroId = await crearProducto({
      codigo: 'FA-220',
      nombre: 'Filtro Aire FA-220',
      stockInicial: 108,
      stockSeguridad: 4,
    });
    await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .send({ proveedorPrincipalId: norteId })
      .expect(200);
    // Fuera de la ventana de 30 días: no cuenta para la velocidad (RN-04).
    await movimiento({
      tipo: 'VENTA',
      productoId: filtroId,
      cantidad: 30,
      fecha: haceDias(40),
    }).expect(201);
    for (const [cantidad, dias] of [
      [20, 25],
      [20, 12],
      [20, 2],
    ] as const) {
      await movimiento({
        tipo: 'VENTA',
        productoId: filtroId,
        cantidad,
        fecha: haceDias(dias),
      }).expect(201);
    }
  });

  afterAll(async () => {
    await t.limpiar();
  });

  it('CP-06.1 / CP-06.2 punto de reposición, umbral y alerta antes del quiebre', async () => {
    const r = await recalcular().expect(200);
    expect(r.body).toMatchObject({ creadas: 1, actualizadas: 0, resueltas: 0 });
    const lista = await listar().expect(200);
    expect(lista.body.items).toHaveLength(1);
    const a = lista.body.items[0];
    alertaFiltroId = a.id;
    expect(a).toMatchObject({
      producto: { id: filtroId, codigo: 'FA-220', stockActual: 18, estadoStock: 'OK' },
      proveedor: { nombre: 'Norte', leadTimeDias: 5 },
      estado: 'ACTIVA',
      severidad: 'PROXIMA',
      stock: 18,
      velocidadDiaria: '2.000',
      diasCobertura: 9,
      puntoReposicion: 14,
      umbral: 20,
      leadTimeDias: 5,
      diasAnticipacion: 3,
      cantidadSugerida: 56,
      pospuestaHasta: null,
      atendidaEn: null,
      resueltaEn: null,
    });
    expect(a.notificadaEn).not.toBeNull();
  });

  it('CP-06.3b el resumen por correo llega una sola vez a los dueños', async () => {
    const enviados = mailer.enviados.filter((c) => c.para.includes(duenioA.email));
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.asunto).toContain('1 producto para reponer');
    expect(enviados[0]!.texto).toContain('FA-220');
    expect(enviados[0]!.texto).toContain('cobertura 9 días');
    expect(enviados[0]!.texto).toContain('sugerido 56');
    expect(enviados[0]!.html).toContain('/alertas');

    // Un recálculo sin alertas nuevas no vuelve a escribir (CP-06.2d: tampoco duplica la alerta).
    const r = await recalcular().expect(200);
    expect(r.body).toMatchObject({ creadas: 0, actualizadas: 1, resueltas: 0 });
    expect(mailer.enviados.filter((c) => c.para.includes(duenioA.email))).toHaveLength(1);
    expect((await listar().expect(200)).body.items).toHaveLength(1);
  });

  it('CP-06.4 la anticipación por producto cambia el umbral', async () => {
    await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .send({ diasAnticipacionAlerta: 0 })
      .expect(200);
    let r = await recalcular().expect(200);
    expect(r.body).toMatchObject({ creadas: 0, resueltas: 1 });
    const resuelta = (await alertaDe(filtroId, 'estado=RESUELTA'))[0];
    expect(resuelta).toMatchObject({ estado: 'RESUELTA', umbral: 14 });
    expect(resuelta.resueltaEn).not.toBeNull();

    await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .send({ diasAnticipacionAlerta: 10 })
      .expect(200);
    r = await recalcular().expect(200);
    expect(r.body).toMatchObject({ creadas: 1 });
    const activa = (await alertaDe(filtroId, 'estado=ACTIVA'))[0];
    expect(activa).toMatchObject({ estado: 'ACTIVA', umbral: 34, diasAnticipacion: 10 });
    alertaFiltroId = activa.id;

    await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .send({ diasAnticipacionAlerta: 3 })
      .expect(200);
    r = await recalcular().expect(200);
    expect(r.body).toMatchObject({ creadas: 0, actualizadas: 1, resueltas: 0 });
    expect((await alertaDe(filtroId, 'estado=ACTIVA'))[0]).toMatchObject({
      id: alertaFiltroId,
      umbral: 20,
    });
  });

  it('CP-06.2b por debajo del punto de reposición la alerta es CRITICA', async () => {
    await movimiento({
      tipo: 'AJUSTE',
      productoId: filtroId,
      cantidad: -8,
      motivo: 'INVENTARIO',
    }).expect(201);
    await recalcular().expect(200);
    expect((await alertaDe(filtroId, 'estado=ACTIVA'))[0]).toMatchObject({
      id: alertaFiltroId,
      severidad: 'CRITICA',
      stock: 10,
      diasCobertura: 5,
    });
  });

  it('CP-06.5b posponer 7 días y reactivación al vencer', async () => {
    const r = await accion(alertaFiltroId, 'POSPONER').expect(200);
    expect(r.body.estado).toBe('POSPUESTA');
    const hasta = Date.parse(r.body.pospuestaHasta);
    expect(hasta - Date.now()).toBeGreaterThan(6.9 * DIA);
    expect(hasta - Date.now()).toBeLessThan(7.1 * DIA);
    expect((await resumen().expect(200)).body).toMatchObject({ activas: 0, pospuestas: 1 });
    await recalcular().expect(200);
    expect((await alertaDe(filtroId, 'estado=POSPUESTA'))[0]).toMatchObject({ id: alertaFiltroId });

    await t.prisma.comoSistema((tx) =>
      tx.alerta.update({
        where: { id: alertaFiltroId },
        data: { pospuestaHasta: new Date(Date.now() - DIA) },
      }),
    );
    await recalcular().expect(200);
    expect((await alertaDe(filtroId, 'estado=ACTIVA'))[0]).toMatchObject({
      id: alertaFiltroId,
      estado: 'ACTIVA',
      pospuestaHasta: null,
    });
  });

  it('CP-06.5 atender: no se vuelve a generar hasta que entre mercadería', async () => {
    const r = await accion(alertaFiltroId, 'ATENDER').expect(200);
    expect(r.body.estado).toBe('ATENDIDA');
    expect(r.body.atendidaEn).not.toBeNull();
    const rec = await recalcular().expect(200);
    expect(rec.body.creadas).toBe(0);
    expect(await alertaDe(filtroId, 'estado=ACTIVA')).toHaveLength(0);
  });

  it('CP-06.5c un ingreso posterior a la atención habilita una alerta nueva', async () => {
    await movimiento({
      tipo: 'INGRESO',
      productoId: filtroId,
      cantidad: 2,
      motivo: 'COMPRA',
    }).expect(201);
    const rec = await recalcular().expect(200);
    expect(rec.body.creadas).toBe(1);
    const activa = (await alertaDe(filtroId, 'estado=ACTIVA'))[0];
    expect(activa).toMatchObject({ estado: 'ACTIVA', stock: 12, severidad: 'CRITICA' });
    alertaFiltroId = activa.id;
  });

  it('CP-06.2c se resuelve sola al reponer por encima del umbral', async () => {
    await movimiento({
      tipo: 'INGRESO',
      productoId: filtroId,
      cantidad: 30,
      motivo: 'COMPRA',
    }).expect(201);
    const rec = await recalcular().expect(200);
    expect(rec.body.resueltas).toBe(1);
    expect(await alertaDe(filtroId, 'estado=ACTIVA')).toHaveLength(0);
    const cerrada = (await alertaDe(filtroId, 'estado=RESUELTA')).find(
      (a: { id: string }) => a.id === alertaFiltroId,
    );
    expect(cerrada.resueltaEn).not.toBeNull();
  });

  it('CP-06.5d una alerta cerrada no se atiende; acción desconocida es 400', async () => {
    const r = await accion(alertaFiltroId, 'ATENDER').expect(409);
    expect(r.body.code).toBe('CONFLICTO');
    const v = await accion(alertaFiltroId, 'BORRAR').expect(400);
    expect(v.body.code).toBe('VALIDACION');
    await accion(randomUUID(), 'ATENDER').expect(404);
  });

  it('CP-06.1c / CP-06.1d las ventas anuladas no cuentan y sin proveedor el lead time es 7', async () => {
    const bId = await crearProducto({
      codigo: 'B-ANUL',
      nombre: 'Producto B',
      stockInicial: 66,
      diasAnticipacionAlerta: 90,
    });
    await movimiento({ tipo: 'VENTA', productoId: bId, cantidad: 30, fecha: haceDias(10) }).expect(
      201,
    );
    const anulada = await movimiento({
      tipo: 'VENTA',
      productoId: bId,
      cantidad: 30,
      fecha: haceDias(5),
    }).expect(201);
    await t
      .http()
      .post(`/api/v1/movements/${anulada.body.id}/anular`)
      .set(auth(duenioA))
      .expect(201);
    await recalcular().expect(200);
    const a = (await alertaDe(bId, 'estado=ACTIVA'))[0];
    expect(a).toMatchObject({
      proveedor: null,
      velocidadDiaria: '1.000',
      leadTimeDias: 7,
      puntoReposicion: 7,
      umbral: 97,
      stock: 36,
      severidad: 'PROXIMA',
    });
  });

  it('CP-06.1b sin ventas en 30 días no hay alerta predictiva', async () => {
    const cId = await crearProducto({
      codigo: 'C-QUIETO',
      nombre: 'Producto C',
      stockInicial: 2,
      stockSeguridad: 5,
    });
    await recalcular().expect(200);
    expect(await alertaDe(cId)).toHaveLength(0);
  });

  it('CP-06.3 resumen y listado ordenado por días de cobertura', async () => {
    const dId = await crearProducto({ codigo: 'D-CRIT', nombre: 'Producto D', stockInicial: 35 });
    await movimiento({ tipo: 'VENTA', productoId: dId, cantidad: 30, fecha: haceDias(3) }).expect(
      201,
    );
    const antes = mailer.enviados.length;
    await recalcular().expect(200);
    const res = await resumen().expect(200);
    expect(res.body).toMatchObject({ activas: 2, criticas: 1, pospuestas: 0 });
    expect(Date.now() - Date.parse(res.body.calculadasEn)).toBeLessThan(60_000);
    const lista = await listar().expect(200);
    expect(
      lista.body.items.map((a: { producto: { codigo: string } }) => a.producto.codigo),
    ).toEqual(['D-CRIT', 'B-ANUL']);
    expect(lista.body.items[0]).toMatchObject({
      severidad: 'CRITICA',
      diasCobertura: 5,
      cantidadSugerida: 32,
    });
    expect(lista.body.siguienteCursor).toBeNull();
    // Paginación por cursor.
    const p1 = await listar('estado=ACTIVA&limit=1').expect(200);
    expect(p1.body.items[0].producto.codigo).toBe('D-CRIT');
    const p2 = await listar(`estado=ACTIVA&limit=1&cursor=${p1.body.siguienteCursor}`).expect(200);
    expect(p2.body.items[0].producto.codigo).toBe('B-ANUL');
    expect(p2.body.siguienteCursor).toBeNull();
    // La alerta nueva de D se notificó (un correo más).
    expect(mailer.enviados.length).toBe(antes + 1);
    expect(mailer.enviados[mailer.enviados.length - 1]!.texto).toContain('D-CRIT');
  });

  it('CP-06.2e la lectura recalcula sólo si el último cálculo tiene más de una hora', async () => {
    const eId = await crearProducto({ codigo: 'E-DEMANDA', nombre: 'Producto E', stockInicial: 8 });
    await movimiento({ tipo: 'VENTA', productoId: eId, cantidad: 6, fecha: haceDias(1) }).expect(
      201,
    );
    // Cálculo fresco: la lectura no recalcula y E todavía no figura.
    expect(await alertaDe(eId)).toHaveLength(0);
    const fresco = (await resumen().expect(200)).body.calculadasEn;
    await t.prisma.comoSistema((tx) =>
      tx.comercio.update({
        where: { id: comercioA },
        data: { alertasCalculadasEn: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      }),
    );
    expect(await alertaDe(eId)).toHaveLength(1);
    const nuevo = (await resumen().expect(200)).body.calculadasEn;
    expect(Date.parse(nuevo)).toBeGreaterThan(Date.parse(fresco) - 1);
    expect(Date.now() - Date.parse(nuevo)).toBeLessThan(60_000);
    // La segunda lectura inmediata no vuelve a calcular.
    expect((await resumen().expect(200)).body.calculadasEn).toBe(nuevo);
  });

  it('CP-06.6 plan FREE: 402 en alertas y reposicion null en el panel', async () => {
    const r = await listar('estado=ACTIVA', duenioF).expect(402);
    expect(r.body.code).toBe('PLAN_REQUERIDO');
    await recalcular(duenioF).expect(402);
    const panel = await t.http().get('/api/v1/dashboard').set(auth(duenioF)).expect(200);
    expect(panel.body.alertas.reposicion).toBeNull();
  });

  it('CP-06.6b roles: contador consulta, no gestiona; empleado no accede', async () => {
    const lista = await listar('estado=ACTIVA', contador).expect(200);
    expect(lista.body.items.length).toBeGreaterThan(0);
    await resumen(contador).expect(200);
    await accion(lista.body.items[0].id, 'ATENDER', contador).expect(403);
    await recalcular(contador).expect(403);
    await listar('estado=ACTIVA', empleada).expect(403);
  });

  it('CP-06.6c aislamiento: B no ve ni toca las alertas de A', async () => {
    const deB = await listar('estado=TODAS', duenioB).expect(200);
    expect(deB.body.items).toHaveLength(0);
    const deA = (await listar('estado=ACTIVA').expect(200)).body.items[0];
    await accion(deA.id, 'ATENDER', duenioB).expect(404);
    await t.http().get(`/api/v1/alerts/${deA.id}`).set(auth(duenioB)).expect(404);
  });

  it('CP-06.5e confirmar una orden de compra atiende las alertas abiertas con referencia', async () => {
    // Dos productos críticos (velocidad 1, stock 1, lead time 7 por defecto), uno pospuesto.
    const ids: string[] = [];
    for (const codigo of ['OC-A', 'OC-B']) {
      const id = await crearProducto({ codigo, nombre: `Producto ${codigo}`, stockInicial: 31 });
      await movimiento({ tipo: 'VENTA', productoId: id, cantidad: 30, fecha: haceDias(3) }).expect(
        201,
      );
      ids.push(id);
    }
    await recalcular().expect(200);
    const [alertaA] = await alertaDe(ids[0]!, 'estado=ACTIVA');
    const [alertaB] = await alertaDe(ids[1]!, 'estado=ACTIVA');
    await accion(alertaB.id, 'POSPONER').expect(200);
    const proveedorId = (
      await t
        .http()
        .post('/api/v1/suppliers')
        .set(auth(duenioA))
        .send({ nombre: 'Proveedor OC' })
        .expect(201)
    ).body.id;
    const orden = await t
      .http()
      .post('/api/v1/purchase-orders')
      .set(auth(duenioA))
      .send({
        proveedorId,
        items: [
          { productoId: ids[0], cantidad: 30, alertaId: alertaA.id },
          { productoId: ids[1], cantidad: 30 },
        ],
      })
      .expect(201);
    await t
      .http()
      .post(`/api/v1/purchase-orders/${orden.body.id}/confirm`)
      .set(auth(duenioA))
      .expect(200);
    const atendidas = (await listar('estado=ATENDIDA').expect(200)).body.items;
    for (const id of ids) {
      const a = atendidas.find((x: { producto: { id: string } }) => x.producto.id === id);
      expect(a).toMatchObject({ estado: 'ATENDIDA', ordenCompraId: orden.body.id });
      expect(a.atendidaEn).toBeTruthy();
      expect(a.pospuestaHasta).toBeNull();
    }
    // Sin ingreso posterior, el recálculo no vuelve a abrir alertas para esos productos.
    await recalcular().expect(200);
    for (const id of ids) {
      expect((await alertaDe(id, 'estado=TODAS')).map((a: { estado: string }) => a.estado)).toEqual(
        ['ATENDIDA'],
      );
    }
  }, 120_000);

  it('CP-06.7 carga sintética: recálculo de 5.000 productos y 50.000 movimientos en menos de 3 s', async () => {
    await conCargaExclusiva(async () => {
      const duenioP = persona('duenio-perf');
      const meP = (await t.http().get('/api/v1/me').set(auth(duenioP)).expect(200)).body;
      const comercioP: string = meP.comercio.id;
      await t.prisma.comoSistema((tx) =>
        tx.comercio.update({ where: { id: comercioP }, data: { plan: 'PRO' } }),
      );
      const productos = Array.from({ length: 5000 }, (_, i) => ({
        id: randomUUID(),
        comercioId: comercioP,
        codigo: `PERF-${i}`,
        codigoNormalizado: `PERF-${i}`,
        nombre: `Producto de carga ${String(i).padStart(4, '0')}`,
        precioVenta: 121,
        alicuotaIva: 21,
        costoReposicion: 70,
        stockActual: i % 3 === 0 ? 2 : 100,
        stockSeguridad: 1,
      }));
      await t.prisma.comoSistema((tx) => tx.producto.createMany({ data: productos }));
      const LOTE = 5000;
      for (let lote = 0; lote < 50000 / LOTE; lote += 1) {
        const movimientos = Array.from({ length: LOTE }, (_, j) => {
          const n = lote * LOTE + j;
          return {
            comercioId: comercioP,
            productoId: productos[n % productos.length]!.id,
            usuarioId: meP.usuario.id as string,
            tipo: 'VENTA' as const,
            cantidad: 1,
            efectoStock: -1,
            stockResultante: 99,
            precioUnitario: 121,
            fecha: new Date(Date.now() - (n % 28) * DIA),
          };
        });
        await t.prisma.comoSistema((tx) => tx.movimiento.createMany({ data: movimientos }));
      }

      const primero = await recalcular(duenioP).expect(200); // calentamiento, como CP-04.3
      expect(primero.body.creadas).toBeGreaterThan(1000);
      const inicio = Date.now();
      const res = await recalcular(duenioP).expect(200);
      const ms = Date.now() - inicio;
      expect(res.body).toMatchObject({
        creadas: 0,
        actualizadas: primero.body.creadas,
        resueltas: 0,
      });
      expect(ms).toBeLessThan(3000);
      expect((await resumen(duenioP).expect(200)).body.activas).toBe(primero.body.creadas);
    });
  }, 600_000);
});
