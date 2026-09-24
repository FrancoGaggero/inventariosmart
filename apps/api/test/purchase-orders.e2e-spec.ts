import { LogMailer, Mailer } from '../src/alerts/mailer';
import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

const DIA = 24 * 60 * 60 * 1000;
const haceDias = (n: number) => new Date(Date.now() - n * DIA).toISOString();

describe('purchase-orders: órdenes de compra en modo copiloto (e2e)', () => {
  let t: AppDePrueba;
  let mailer: LogMailer;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const duenioF = persona('duenio-free');
  const empleada = persona('empleada');
  const contador = persona('contador');
  let comercioA: string;
  const prov: Record<string, string> = {};
  const prod: Record<string, string> = {};
  let ordenId: string;

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const sugerir = (query = '', quien = duenioA) =>
    t.http().get(`/api/v1/purchase-orders/suggest${query}`).set(auth(quien));
  const listar = (query = '', quien = duenioA) =>
    t.http().get(`/api/v1/purchase-orders${query}`).set(auth(quien));
  const obtener = (id: string, quien = duenioA) =>
    t.http().get(`/api/v1/purchase-orders/${id}`).set(auth(quien));
  const crear = (body: object, quien = duenioA) =>
    t.http().post('/api/v1/purchase-orders').set(auth(quien)).send(body);
  const editar = (id: string, body: object, quien = duenioA) =>
    t.http().patch(`/api/v1/purchase-orders/${id}`).set(auth(quien)).send(body);
  const confirmar = (id: string, quien = duenioA) =>
    t.http().post(`/api/v1/purchase-orders/${id}/confirm`).set(auth(quien));
  const cancelar = (id: string, quien = duenioA) =>
    t.http().post(`/api/v1/purchase-orders/${id}/cancel`).set(auth(quien));
  const alertaDe = async (productoId: string, quien = duenioA) =>
    (
      await t.http().get('/api/v1/alerts?estado=TODAS').set(auth(quien)).expect(200)
    ).body.items.find((a: { producto: { id: string } }) => a.producto.id === productoId);
  const grupoDe = (sugerencia: { grupos: { proveedor: { nombre: string } }[] }, nombre: string) =>
    sugerencia.grupos.find((g) => g.proveedor.nombre === nombre) as
      | {
          proveedor: { nombre: string; leadTimeDias: number };
          totalNeto: string;
          items: {
            producto: { codigo: string };
            cantidad: number;
            costoUnitarioNeto: string | null;
            subtotal: string | null;
            motivoEleccion: string;
          }[];
        }
      | undefined;

  const crearProveedor = async (datos: object, quien = duenioA): Promise<string> =>
    (await t.http().post('/api/v1/suppliers').set(auth(quien)).send(datos).expect(201)).body.id;
  /** Producto con `vendidas` unidades en los últimos 30 días y stock final `stockFinal`. */
  const crearProducto = async (
    codigo: string,
    o: { stockFinal: number; vendidas: number; seguridad?: number; principal?: string | null },
    quien = duenioA,
  ): Promise<string> => {
    const id = (
      await t
        .http()
        .post('/api/v1/products')
        .set(auth(quien))
        .send({
          codigo,
          nombre: `Producto ${codigo}`,
          precioVenta: 3900,
          costoReposicion: 2100,
          alicuotaIva: 21,
          stockInicial: o.stockFinal + o.vendidas,
          stockSeguridad: o.seguridad ?? 0,
        })
        .expect(201)
    ).body.id;
    if (o.principal) {
      await t
        .http()
        .patch(`/api/v1/products/${id}`)
        .set(auth(quien))
        .send({ proveedorPrincipalId: o.principal })
        .expect(200);
    }
    if (o.vendidas > 0) {
      const tercio = Math.floor(o.vendidas / 3);
      for (const [cantidad, dias] of [
        [tercio, 25],
        [tercio, 12],
        [o.vendidas - 2 * tercio, 2],
      ] as const) {
        await t
          .http()
          .post('/api/v1/movements')
          .set(auth(quien))
          .send({ tipo: 'VENTA', productoId: id, cantidad, fecha: haceDias(dias) })
          .expect(201);
      }
    }
    return id;
  };
  const cargarPrecio = (proveedorId: string, productoId: string, costoNeto: string) =>
    t
      .http()
      .post(`/api/v1/suppliers/${proveedorId}/prices`)
      .set(auth(duenioA))
      .send({ items: [{ productoId, costoNeto }] })
      .expect(201);

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

    // Proveedores (CP-07.1 / CP-07.1b): Norte lead 5, Sur lead 7 con email y contacto,
    // Oeste lead 5 y confiabilidad 5, Este lead 7 sin email.
    prov['norte'] = await crearProveedor({ nombre: 'Norte', leadTimeDias: 5 });
    prov['sur'] = await crearProveedor({
      nombre: 'Sur',
      leadTimeDias: 7,
      email: 'compras@sur.test',
      contacto: 'Marta',
    });
    prov['oeste'] = await crearProveedor({ nombre: 'Oeste', leadTimeDias: 5, confiabilidad: 5 });
    prov['este'] = await crearProveedor({ nombre: 'Este', leadTimeDias: 7 });

    // Productos en alerta CRITICA (velocidad 2 ó 1 por día, stock por debajo del punto).
    // FA-220: seguridad 4, 60 vendidas, stock 10 → velocidad 2, punto 14 (Norte), sugerido 64.
    prod['FA-220'] = await crearProducto('FA-220', {
      stockFinal: 10,
      vendidas: 60,
      seguridad: 4,
      principal: prov['norte'],
    });
    // AM-1L: seguridad 2, 30 vendidas, stock 3 → velocidad 1, punto 7, sugerido 34.
    prod['AM-1L'] = await crearProducto('AM-1L', {
      stockFinal: 3,
      vendidas: 30,
      seguridad: 2,
      principal: prov['norte'],
    });
    // BT-12: mismo costo en Norte y Oeste (mismo lead time): gana Oeste por confiabilidad.
    prod['BT-12'] = await crearProducto('BT-12', {
      stockFinal: 1,
      vendidas: 30,
      principal: prov['norte'],
    });
    // SP-1: sin precios cargados, principal Este → costo de reposición.
    prod['SP-1'] = await crearProducto('SP-1', {
      stockFinal: 1,
      vendidas: 30,
      principal: prov['este'],
    });
    // NP-1: sin precios ni principal → "sin proveedor".
    prod['NP-1'] = await crearProducto('NP-1', { stockFinal: 1, vendidas: 30 });
    // PX-1: PROXIMA (stock 18, umbral 20, punto 14 con Norte) → sólo con severidad=TODAS.
    prod['PX-1'] = await crearProducto('PX-1', {
      stockFinal: 18,
      vendidas: 60,
      seguridad: 4,
      principal: prov['norte'],
    });
    // PP-1 y AT-1: críticos, pero pospuesto y atendido → nunca se sugieren.
    prod['PP-1'] = await crearProducto('PP-1', {
      stockFinal: 1,
      vendidas: 30,
      principal: prov['norte'],
    });
    prod['AT-1'] = await crearProducto('AT-1', {
      stockFinal: 1,
      vendidas: 30,
      principal: prov['norte'],
    });

    await cargarPrecio(prov['norte'], prod['FA-220'], '2340.00');
    await cargarPrecio(prov['norte'], prod['AM-1L'], '900.00');
    await cargarPrecio(prov['sur'], prod['FA-220'], '2000.00');
    await cargarPrecio(prov['norte'], prod['BT-12'], '2340.00');
    await cargarPrecio(prov['oeste'], prod['BT-12'], '2340.00');
    await cargarPrecio(prov['norte'], prod['PX-1'], '500.00');
    await cargarPrecio(prov['norte'], prod['PP-1'], '100.00');
    await cargarPrecio(prov['norte'], prod['AT-1'], '100.00');

    await t.http().post('/api/v1/alerts/recalculate').set(auth(duenioA)).expect(200);
    for (const [codigo, accion] of [
      ['PP-1', 'POSPONER'],
      ['AT-1', 'ATENDER'],
    ] as const) {
      const alerta = await alertaDe(prod[codigo]!);
      await t
        .http()
        .patch(`/api/v1/alerts/${alerta.id}`)
        .set(auth(duenioA))
        .send({ accion })
        .expect(200);
    }
  }, 300_000);

  afterAll(async () => {
    await t.limpiar();
  }, 120_000);

  it('CP-07.1 la sugerencia agrupa por el proveedor más barato y no crea nada', async () => {
    const s = (await sugerir().expect(200)).body;
    expect(s.severidad).toBe('CRITICA');
    expect(s.calculadasEn).toBeTruthy();
    const sur = grupoDe(s, 'Sur')!;
    expect(sur.proveedor.leadTimeDias).toBe(7);
    expect(sur.items).toHaveLength(1);
    expect(sur.items[0]).toMatchObject({
      producto: { codigo: 'FA-220' },
      cantidad: 64,
      costoUnitarioNeto: '2000.00',
      subtotal: '128000.00',
      motivoEleccion: 'MENOR_COSTO',
    });
    expect(sur.totalNeto).toBe('128000.00');
    const norte = grupoDe(s, 'Norte')!;
    expect(norte.items.map((i) => i.producto.codigo)).toEqual(['AM-1L']);
    expect(norte.items[0]).toMatchObject({
      cantidad: 34,
      costoUnitarioNeto: '900.00',
      subtotal: '30600.00',
      motivoEleccion: 'MENOR_COSTO',
    });
    expect(norte.totalNeto).toBe('30600.00');
    // Los grupos vienen del mayor al menor total.
    expect(s.grupos[0].proveedor.nombre).toBe('Sur');
    expect((await listar().expect(200)).body.items).toHaveLength(0);
  }, 120_000);

  it('CP-07.1b empate por confiabilidad y proveedor principal sin precio', async () => {
    const s = (await sugerir().expect(200)).body;
    const oeste = grupoDe(s, 'Oeste')!;
    expect(oeste.items).toHaveLength(1);
    expect(oeste.items[0]).toMatchObject({
      producto: { codigo: 'BT-12' },
      costoUnitarioNeto: '2340.00',
      motivoEleccion: 'MAYOR_CONFIABILIDAD',
    });
    expect(grupoDe(s, 'Norte')!.items.some((i) => i.producto.codigo === 'BT-12')).toBe(false);
    const este = grupoDe(s, 'Este')!;
    expect(este.items[0]).toMatchObject({
      producto: { codigo: 'SP-1' },
      cantidad: 36,
      costoUnitarioNeto: '2100.00',
      motivoEleccion: 'PROVEEDOR_PRINCIPAL',
    });
  }, 120_000);

  it('CP-07.1c sin proveedor aparte; pospuestas y atendidas no se sugieren; PROXIMA sólo con TODAS', async () => {
    const s = (await sugerir().expect(200)).body;
    expect(s.sinProveedor.map((x: { producto: { codigo: string } }) => x.producto.codigo)).toEqual([
      'NP-1',
    ]);
    const codigos = (x: typeof s) =>
      x.grupos.flatMap((g: { items: { producto: { codigo: string } }[] }) =>
        g.items.map((i) => i.producto.codigo),
      );
    expect(codigos(s)).not.toEqual(expect.arrayContaining(['PX-1', 'PP-1', 'AT-1']));
    const todas = (await sugerir('?severidad=TODAS').expect(200)).body;
    expect(todas.severidad).toBe('TODAS');
    expect(grupoDe(todas, 'Norte')!.items.map((i) => i.producto.codigo)).toEqual(
      expect.arrayContaining(['AM-1L', 'PX-1']),
    );
    expect(codigos(todas)).not.toEqual(expect.arrayContaining(['PP-1', 'AT-1']));
    await sugerir('?severidad=ALTA').expect(400);
  }, 120_000);

  it('CP-07.2 crear y editar un borrador: número, costo vigente y total', async () => {
    const alerta = await alertaDe(prod['FA-220']!);
    const r = await crear({
      proveedorId: prov['sur'],
      items: [{ productoId: prod['FA-220'], cantidad: 64, alertaId: alerta.id }],
    }).expect(201);
    ordenId = r.body.id;
    expect(r.body).toMatchObject({
      numero: 'OC-0001',
      estado: 'BORRADOR',
      proveedor: { nombre: 'Sur', email: 'compras@sur.test' },
      totalNeto: '128000.00',
      textoEditado: false,
      motivoNoEnvio: null,
      creadaPor: { nombre: duenioA.nombre },
      confirmadaPor: null,
      confirmadaEn: null,
      enviadaEn: null,
    });
    expect(r.body.items[0]).toMatchObject({
      producto: { codigo: 'FA-220' },
      alertaId: alerta.id,
      cantidad: 64,
      costoUnitarioNeto: '2000.00',
      subtotal: '128000.00',
    });

    const e = await editar(ordenId, {
      items: [
        { productoId: prod['FA-220'], cantidad: 70 },
        { productoId: prod['AM-1L'], cantidad: 10 },
      ],
    }).expect(200);
    expect(e.body.items).toHaveLength(2);
    // Sur no tiene precio para AM-1L: costo de reposición del producto, que sigue la última lista
    // de su proveedor principal Norte (900, RN-08).
    expect(
      e.body.items.map((i: { producto: { codigo: string }; costoUnitarioNeto: string }) => [
        i.producto.codigo,
        i.costoUnitarioNeto,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ['FA-220', '2000.00'],
        ['AM-1L', '900.00'],
      ]),
    );
    expect(e.body.totalNeto).toBe('149000.00');
  }, 120_000);

  it('CP-07.3 el texto se redacta con los datos de la orden', async () => {
    const o = (await obtener(ordenId).expect(200)).body;
    const comercio = (await t.http().get('/api/v1/me').set(auth(duenioA)).expect(200)).body.comercio
      .nombre;
    expect(o.asunto).toContain('Orden de compra OC-0001');
    expect(o.asunto).toContain(comercio);
    for (const parte of ['Marta', 'FA-220', '70 unidades', '2.000,00', '149.000,00', '7 días']) {
      expect(o.texto).toContain(parte);
    }
    expect(o.texto).toContain(comercio);
    expect(o.texto).toContain(duenioA.email);
    expect(o.textoEditado).toBe(false);
  }, 120_000);

  it('CP-07.3b el texto editado a mano se conserva hasta que se pide regenerarlo', async () => {
    const propio = 'Hola Marta, necesito 70 filtros FA-220 para el lunes.';
    const e1 = await editar(ordenId, { texto: propio }).expect(200);
    expect(e1.body).toMatchObject({ texto: propio, textoEditado: true });
    const e2 = await editar(ordenId, {
      items: [
        { productoId: prod['FA-220'], cantidad: 75 },
        { productoId: prod['AM-1L'], cantidad: 10 },
      ],
    }).expect(200);
    expect(e2.body).toMatchObject({ texto: propio, textoEditado: true, totalNeto: '159000.00' });
    const e3 = await editar(ordenId, { regenerarTexto: true }).expect(200);
    expect(e3.body.textoEditado).toBe(false);
    expect(e3.body.texto).toContain('75 unidades');
    expect(e3.body.texto).toContain('159.000,00');
  }, 120_000);

  it('CP-07.2b la numeración es por comercio', async () => {
    const provB = await crearProveedor({ nombre: 'Proveedor B' }, duenioB);
    const prodB = await crearProducto('B-1', { stockFinal: 5, vendidas: 0 }, duenioB);
    const deB = await crear(
      { proveedorId: provB, items: [{ productoId: prodB, cantidad: 1 }] },
      duenioB,
    ).expect(201);
    expect(deB.body.numero).toBe('OC-0001');
    expect(deB.body.items[0].costoUnitarioNeto).toBe('2100.00');
    const segunda = await crear({
      proveedorId: prov['este'],
      items: [{ productoId: prod['SP-1'], cantidad: 36 }],
    }).expect(201);
    expect(segunda.body.numero).toBe('OC-0002');
  }, 120_000);

  it('CP-07.2c datos inválidos y datos ajenos', async () => {
    const sinItems = await crear({ proveedorId: prov['sur'], items: [] }).expect(400);
    expect(sinItems.body.code).toBe('VALIDACION');
    expect(sinItems.body.details.items).toBeDefined();
    const cero = await crear({
      proveedorId: prov['sur'],
      items: [{ productoId: prod['FA-220'], cantidad: 0 }],
    }).expect(400);
    expect(cero.body.code).toBe('VALIDACION');
    const bajaId = await crearProveedor({ nombre: 'Baja SA' });
    await t.http().delete(`/api/v1/suppliers/${bajaId}`).set(auth(duenioA)).expect(200);
    const inactivo = await crear({
      proveedorId: bajaId,
      items: [{ productoId: prod['FA-220'], cantidad: 1 }],
    }).expect(400);
    expect(inactivo.body.details.proveedorId).toBeDefined();
    const productoBaja = await crearProducto('BJ-1', { stockFinal: 0, vendidas: 0 });
    await t.http().delete(`/api/v1/products/${productoBaja}`).set(auth(duenioA)).expect(200);
    const conBaja = await crear({
      proveedorId: prov['sur'],
      items: [{ productoId: productoBaja, cantidad: 1 }],
    }).expect(400);
    expect(conBaja.body.details.items).toBeDefined();
    // Proveedor y producto de otro comercio: 404.
    const provB = (await listar('', duenioB).expect(200)).body.items[0].proveedor.id;
    await crear({
      proveedorId: provB,
      items: [{ productoId: prod['FA-220'], cantidad: 1 }],
    }).expect(404);
    const prodB = (
      await obtener((await listar('', duenioB).expect(200)).body.items[0].id, duenioB).expect(200)
    ).body.items[0].producto.id;
    await crear({ proveedorId: prov['sur'], items: [{ productoId: prodB, cantidad: 1 }] }).expect(
      404,
    );
  }, 120_000);

  it('CP-07.4 confirmar envía el correo al proveedor y atiende las alertas', async () => {
    const antes = mailer.enviados.length;
    const r = await confirmar(ordenId).expect(200);
    expect(r.body).toMatchObject({
      estado: 'ENVIADA',
      motivoNoEnvio: null,
      confirmadaPor: { nombre: duenioA.nombre },
      enviadaA: 'compras@sur.test',
    });
    expect(r.body.confirmadaEn).toBeTruthy();
    expect(r.body.enviadaEn).toBeTruthy();
    expect(mailer.enviados).toHaveLength(antes + 1);
    const correo = mailer.enviados[mailer.enviados.length - 1]!;
    expect(correo.para).toEqual(['compras@sur.test']);
    expect(correo.responderA).toBe(duenioA.email);
    expect(correo.asunto).toBe(r.body.asunto);
    expect(correo.texto).toBe(r.body.texto);
    expect(correo.html).toContain('FA-220');
    for (const codigo of ['FA-220', 'AM-1L']) {
      const a = await alertaDe(prod[codigo]!);
      expect(a).toMatchObject({ estado: 'ATENDIDA', ordenCompraId: ordenId });
      expect(a.atendidaEn).toBeTruthy();
    }
  }, 120_000);

  it('CP-07.4d nada salió antes de confirmar y una orden enviada no se reenvía', async () => {
    const aSur = mailer.enviados.filter((c) => c.para.includes('compras@sur.test'));
    expect(aSur).toHaveLength(1);
    const r = await confirmar(ordenId).expect(409);
    expect(r.body.code).toBe('CONFLICTO');
    expect(mailer.enviados.filter((c) => c.para.includes('compras@sur.test'))).toHaveLength(1);
  }, 120_000);

  it('CP-07.2d una orden confirmada no se edita ni se cancela', async () => {
    await editar(ordenId, { notas: 'x' }).expect(409);
    await cancelar(ordenId).expect(409);
    const o = (await obtener(ordenId).expect(200)).body;
    expect(o.estado).toBe('ENVIADA');
    expect(o.notas).toBeNull();
  }, 120_000);

  it('CP-07.4b sin email del proveedor queda CONFIRMADA con SIN_EMAIL', async () => {
    const antes = mailer.enviados.length;
    const oc2 = (await listar('?estado=BORRADOR').expect(200)).body.items.find(
      (o: { numero: string }) => o.numero === 'OC-0002',
    );
    const r = await confirmar(oc2.id).expect(200);
    expect(r.body).toMatchObject({
      estado: 'CONFIRMADA',
      motivoNoEnvio: 'SIN_EMAIL',
      enviadaEn: null,
      enviadaA: null,
    });
    expect(r.body.confirmadaEn).toBeTruthy();
    expect(mailer.enviados).toHaveLength(antes);
    expect(await alertaDe(prod['SP-1']!)).toMatchObject({
      estado: 'ATENDIDA',
      ordenCompraId: oc2.id,
    });
  }, 120_000);

  it('CP-07.4c envío rechazado: CONFIRMADA con ENVIO_FALLIDO y sin error', async () => {
    const falloId = await crearProveedor({ nombre: 'Fallo SA', email: 'fallo@correo.test' });
    mailer.rechazarA.add('fallo@correo.test');
    const orden = await crear({
      proveedorId: falloId,
      items: [{ productoId: prod['BT-12'], cantidad: 5 }],
    }).expect(201);
    const r = await confirmar(orden.body.id).expect(200);
    expect(r.body).toMatchObject({
      estado: 'CONFIRMADA',
      motivoNoEnvio: 'ENVIO_FALLIDO',
      enviadaEn: null,
    });
    mailer.rechazarA.delete('fallo@correo.test');
  }, 120_000);

  it('CP-07.5 / CP-07.5b listado por estado, detalle y cancelación de un borrador', async () => {
    const b1 = await crear({
      proveedorId: prov['norte'],
      items: [{ productoId: prod['AM-1L'], cantidad: 1 }],
    }).expect(201);
    const b2 = await crear({
      proveedorId: prov['norte'],
      items: [{ productoId: prod['PX-1'], cantidad: 2 }],
      notas: 'Pedir con factura A',
    }).expect(201);
    expect(b2.body.notas).toBe('Pedir con factura A');

    const todas = (await listar().expect(200)).body;
    expect(todas.items.map((o: { numero: string }) => o.numero)).toEqual([
      'OC-0005',
      'OC-0004',
      'OC-0003',
      'OC-0002',
      'OC-0001',
    ]);
    expect(todas.items[4]).toMatchObject({
      numero: 'OC-0001',
      estado: 'ENVIADA',
      proveedor: { nombre: 'Sur' },
      cantidadItems: 2,
      totalNeto: '159000.00',
    });
    const borradores = (await listar('?estado=BORRADOR').expect(200)).body.items;
    expect(borradores.map((o: { id: string }) => o.id).sort()).toEqual(
      [b1.body.id, b2.body.id].sort(),
    );
    expect((await listar('?estado=ENVIADA').expect(200)).body.items).toHaveLength(1);
    expect((await listar('?estado=CONFIRMADA').expect(200)).body.items).toHaveLength(2);

    // Paginación por cursor.
    const p1 = (await listar('?limit=2').expect(200)).body;
    expect(p1.items).toHaveLength(2);
    expect(p1.siguienteCursor).toBeTruthy();
    const p2 = (await listar(`?limit=2&cursor=${p1.siguienteCursor}`).expect(200)).body;
    expect(p2.items[0].numero).toBe('OC-0003');

    const detalle = (await obtener(ordenId).expect(200)).body;
    expect(detalle.items).toHaveLength(2);
    expect(detalle.confirmadaPor.nombre).toBe(duenioA.nombre);

    const antesAlerta = await alertaDe(prod['PX-1']!);
    const c = await cancelar(b2.body.id).expect(200);
    expect(c.body.estado).toBe('CANCELADA');
    expect(c.body.canceladaEn).toBeTruthy();
    expect((await listar('?estado=CANCELADA').expect(200)).body.items[0].id).toBe(b2.body.id);
    expect((await alertaDe(prod['PX-1']!)).estado).toBe(antesAlerta.estado);
    await cancelar(b2.body.id).expect(409);
  }, 120_000);

  it('CP-07.6 plan FREE: 402 en todas las rutas', async () => {
    // Una petición por vez: supertest levanta y cierra el servidor por cada una.
    const s = await sugerir('', duenioF).expect(402);
    expect(s.body.code).toBe('PLAN_REQUERIDO');
    const l = await listar('', duenioF).expect(402);
    expect(l.body.code).toBe('PLAN_REQUERIDO');
    await crear({ proveedorId: prov['sur'], items: [] }, duenioF).expect(402);
  }, 120_000);

  it('CP-07.6b roles: contador consulta, no opera; empleado no accede', async () => {
    await sugerir('', contador).expect(200);
    await listar('', contador).expect(200);
    await obtener(ordenId, contador).expect(200);
    const borrador = (await listar('?estado=BORRADOR').expect(200)).body.items[0];
    const r = await confirmar(borrador.id, contador).expect(403);
    expect(r.body.code).toBe('SIN_PERMISO');
    await editar(borrador.id, { notas: 'x' }, contador).expect(403);
    await crear({ proveedorId: prov['sur'], items: [] }, contador).expect(403);
    await listar('', empleada).expect(403);
    await sugerir('', empleada).expect(403);
  }, 120_000);

  it('CP-07.6c aislamiento: B no ve ni opera las órdenes de A', async () => {
    const deB = (await listar('', duenioB).expect(200)).body.items;
    expect(deB.map((o: { numero: string }) => o.numero)).toEqual(['OC-0001']);
    expect((await sugerir('', duenioB).expect(200)).body.grupos).toHaveLength(0);
    await obtener(ordenId, duenioB).expect(404);
    const borrador = (await listar('?estado=BORRADOR').expect(200)).body.items[0];
    await editar(borrador.id, { notas: 'x' }, duenioB).expect(404);
    await confirmar(borrador.id, duenioB).expect(404);
    await cancelar(borrador.id, duenioB).expect(404);
    expect((await obtener(borrador.id).expect(200)).body.estado).toBe('BORRADOR');
  }, 120_000);
});
