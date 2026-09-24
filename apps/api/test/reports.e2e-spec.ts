import { rangoSemana, ultimaSemanaCerrada } from '@inventariosmart/shared';
import { LogMailer, Mailer } from '../src/alerts/mailer';
import { ReportsCron } from '../src/reports/reports.cron';
import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

const DIA = 24 * 60 * 60 * 1000;

describe('weekly-reports: reportes semanales de rentabilidad (e2e)', () => {
  let t: AppDePrueba;
  let mailer: LogMailer;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const duenioF = persona('duenio-free');
  const empleada = persona('empleada');
  const contador = persona('contador');
  const prod: Record<string, string> = {};
  const prov: Record<string, string> = {};
  let reporteW38: string;

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const listar = (query = '', quien = duenioA) =>
    t.http().get(`/api/v1/reports/weekly${query}`).set(auth(quien));
  const obtener = (id: string, quien = duenioA) =>
    t.http().get(`/api/v1/reports/weekly/${id}`).set(auth(quien));
  const generar = (body: object, quien = duenioA) =>
    t.http().post('/api/v1/reports/weekly/generate').set(auth(quien)).send(body);
  const ajustes = (quien = duenioA) => t.http().get('/api/v1/reports/settings').set(auth(quien));
  const patchAjustes = (body: object, quien = duenioA) =>
    t.http().patch('/api/v1/reports/settings').set(auth(quien)).send(body);
  const correosA = (correo: string) => mailer.enviados.filter((c) => c.para.includes(correo));

  const crearProducto = async (
    datos: {
      codigo: string;
      precioVenta: number;
      costoReposicion: number;
      stockInicial: number;
    },
    quien = duenioA,
  ): Promise<string> =>
    (
      await t
        .http()
        .post('/api/v1/products')
        .set(auth(quien))
        .send({ nombre: `Producto ${datos.codigo}`, alicuotaIva: 21, ...datos })
        .expect(201)
    ).body.id;
  const vender = (productoId: string, cantidad: number, fecha: string, quien = duenioA) =>
    t
      .http()
      .post('/api/v1/movements')
      .set(auth(quien))
      .send({ tipo: 'VENTA', productoId, cantidad, fecha })
      .expect(201);

  beforeAll(async () => {
    t = await crearAppDePrueba();
    mailer = t.app.get(Mailer) as LogMailer;
    const comercioA = (await t.http().get('/api/v1/me').set(auth(duenioA)).expect(200)).body
      .comercio.id;
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
    // CP-09.1: semana 2026-W38 (14 al 20/9) con 30 FA-220 (neto 3.223,14, costo 2.100) y
    // 10 AM-1L (neto 1.652,89, costo 900); gasto único de 100.000 en septiembre.
    prod['FA-220'] = await crearProducto({
      codigo: 'FA-220',
      precioVenta: 3900,
      costoReposicion: 2100,
      stockInicial: 30,
    });
    prod['AM-1L'] = await crearProducto({
      codigo: 'AM-1L',
      precioVenta: 2000,
      costoReposicion: 900,
      stockInicial: 10,
    });
    await vender(prod['FA-220'], 20, '2026-09-15T15:00:00Z');
    await vender(prod['FA-220'], 10, '2026-09-19T15:00:00Z');
    await vender(prod['AM-1L'], 10, '2026-09-17T15:00:00Z');
    await t
      .http()
      .post('/api/v1/expenses')
      .set(auth(duenioA))
      .send({
        concepto: 'Alquiler',
        tipo: 'FIJO',
        importe: 100000,
        periodo: '2026-09',
        periodicidad: 'UNICO',
      })
      .expect(201);
  }, 300_000);

  afterAll(async () => {
    await t.limpiar();
  });

  it('CP-09.1 números y estrellas de la semana', async () => {
    const r = await generar({ semana: '2026-W38' }).expect(200);
    reporteW38 = r.body.id;
    expect(r.body.semana).toBe('2026-W38');
    expect(r.body.desde).toBe('2026-09-14T03:00:00.000Z');
    expect(r.body.hasta).toBe('2026-09-21T03:00:00.000Z');
    const c = r.body.contenido;
    expect(c.mesGastos).toBe('2026-09');
    expect(c.resumen).toMatchObject({
      unidadesVendidas: 40,
      ventasNetas: '113223.14',
      costoVendido: '72000.00',
      margenBruto: '41223.14',
      gastoPorUnidad: '2500.00',
      gastos: '100000.00',
      margenNeto: '-58776.86',
      motivo: null,
    });
    expect(c.estrellas.map((e: { producto: { codigo: string } }) => e.producto.codigo)).toEqual([
      'FA-220',
      'AM-1L',
    ]);
    expect(c.estrellas[0]).toMatchObject({ unidadesVendidas: 30, margenBrutoSemana: '33694.20' });
    expect(c.estrellas[1]).toMatchObject({ unidadesVendidas: 10, margenBrutoSemana: '7528.90' });
    // Reporte nuevo con reportes activos: se envía al dueño.
    expect(r.body.enviadoEn).toBeTruthy();
    expect(r.body.destinatarios).toEqual([duenioA.email]);
    expect(correosA(duenioA.email)).toHaveLength(1);
    expect(correosA(duenioA.email)[0]!.asunto).toContain('Tu semana en');
  }, 120_000);

  it('CP-09.1b sin ventas en la semana igual se genera y se envía', async () => {
    const antes = correosA(duenioA.email).length;
    const r = await generar({ semana: '2026-W30' }).expect(200);
    expect(r.body.contenido.resumen).toMatchObject({
      unidadesVendidas: 0,
      ventasNetas: '0.00',
      margenBruto: '0.00',
      margenBrutoPct: null,
      margenNeto: null,
      motivo: 'SIN_VENTAS',
    });
    expect(r.body.contenido.estrellas).toEqual([]);
    expect(r.body.enviadoEn).toBeTruthy();
    expect(correosA(duenioA.email)).toHaveLength(antes + 1);
  }, 120_000);

  it('CP-09.1c variación contra la semana anterior', async () => {
    // W37 (7 al 13/9): 100 unidades de un producto con precio neto 1.000 → 100.000 netos.
    prod['PN-1'] = await crearProducto({
      codigo: 'PN-1',
      precioVenta: 1210,
      costoReposicion: 800,
      stockInicial: 100,
    });
    await vender(prod['PN-1'], 100, '2026-09-10T15:00:00Z');
    const r = await generar({ semana: '2026-W38' }).expect(200);
    expect(r.body.contenido.semanaAnterior).toMatchObject({
      semana: '2026-W37',
      ventasNetas: '100000.00',
      unidadesVendidas: 100,
      variacionVentasPct: '13.22',
    });
    const w37 = await generar({ semana: '2026-W37' }).expect(200);
    expect(w37.body.contenido.semanaAnterior.variacionVentasPct).toBeNull();
  }, 120_000);

  it('CP-09.2 comprar más barato', async () => {
    const crearProveedor = async (nombre: string) =>
      (await t.http().post('/api/v1/suppliers').set(auth(duenioA)).send({ nombre }).expect(201))
        .body.id;
    prov['norte'] = await crearProveedor('Norte');
    prov['sur'] = await crearProveedor('Sur');
    await t
      .http()
      .patch(`/api/v1/products/${prod['FA-220']}`)
      .set(auth(duenioA))
      .send({ proveedorPrincipalId: prov['norte'] })
      .expect(200);
    for (const [proveedor, costo] of [
      ['norte', '2340.00'],
      ['sur', '2000.00'],
    ] as const) {
      await t
        .http()
        .post(`/api/v1/suppliers/${prov[proveedor]}/prices`)
        .set(auth(duenioA))
        .send({ items: [{ productoId: prod['FA-220'], costoNeto: costo }] })
        .expect(201);
    }
    const r = await generar({ semana: '2026-W38' }).expect(200);
    const compra = r.body.contenido.oportunidades.comprarMasBarato;
    expect(compra.items).toHaveLength(1);
    expect(compra.items[0]).toMatchObject({
      producto: { codigo: 'FA-220' },
      proveedorActual: 'Norte',
      proveedorSugerido: 'Sur',
      costoActual: '2340.00',
      costoSugerido: '2000.00',
      unidades30d: 30,
      ahorroEstimado: '10200.00',
    });
    expect(compra.total).toBe('10200.00');
  }, 120_000);

  it('CP-09.2b capital inmovilizado y margen bajo', async () => {
    prod['ZZ-1'] = await crearProducto({
      codigo: 'ZZ-1',
      precioVenta: 1000,
      costoReposicion: 500,
      stockInicial: 20,
    });
    prod['LB-1'] = await crearProducto({
      codigo: 'LB-1',
      precioVenta: 1210,
      costoReposicion: 900,
      stockInicial: 3,
    });
    prod['OK-1'] = await crearProducto({
      codigo: 'OK-1',
      precioVenta: 1210,
      costoReposicion: 800,
      stockInicial: 1,
    });
    await vender(prod['LB-1'], 3, '2026-09-18T15:00:00Z');
    await vender(prod['OK-1'], 1, '2026-09-18T16:00:00Z');
    const r = await generar({ semana: '2026-W38' }).expect(200);
    const o = r.body.contenido.oportunidades;
    expect(o.capitalInmovilizado.items).toHaveLength(1);
    expect(o.capitalInmovilizado.items[0]).toMatchObject({
      producto: { codigo: 'ZZ-1' },
      stock: 20,
      monto: '10000.00',
    });
    expect(
      o.margenBajo.items.map((i: { producto: { codigo: string } }) => i.producto.codigo),
    ).toEqual(['LB-1']);
    expect(o.margenBajo.items[0]).toMatchObject({
      margenBrutoPct: '10.00',
      unidadesSemana: 3,
      monto: '3000.00',
    });
  }, 120_000);

  it('CP-09.2c sin oportunidades: listas vacías con total 0.00', async () => {
    const sano = await crearProducto(
      { codigo: 'S-1', precioVenta: 1210, costoReposicion: 800, stockInicial: 2 },
      duenioB,
    );
    await vender(sano, 2, '2026-07-22T15:00:00Z', duenioB);
    const r = await generar({ semana: '2026-W30' }, duenioB).expect(200);
    expect(r.body.contenido.oportunidades).toEqual({
      comprarMasBarato: { items: [], total: '0.00' },
      capitalInmovilizado: { items: [], total: '0.00' },
      margenBajo: { items: [], total: '0.00' },
    });
    expect(r.body.contenido.resumen.unidadesVendidas).toBe(2);
  }, 120_000);

  it('CP-09.3 el reporte de la última semana cerrada llega solo al consultar', async () => {
    await patchAjustes({ destinatariosExtra: ['contadora@ejemplo.test'] }, duenioB).expect(200);
    const semana = ultimaSemanaCerrada();
    const fecha = new Date(rangoSemana(semana).desde.getTime() + DIA).toISOString();
    const p = await crearProducto(
      { codigo: 'UC-1', precioVenta: 1210, costoReposicion: 700, stockInicial: 5 },
      duenioB,
    );
    await vender(p, 5, fecha, duenioB);
    const antes = correosA(duenioB.email).length;
    const lista = await listar('', duenioB).expect(200);
    const reporte = lista.body.items.find((r: { semana: string }) => r.semana === semana);
    expect(reporte).toBeDefined();
    expect(reporte.enviadoEn).toBeTruthy();
    expect(reporte.unidadesVendidas).toBe(5);
    const detalle = (await obtener(reporte.id, duenioB).expect(200)).body;
    expect(detalle.destinatarios.sort()).toEqual([duenioB.email, 'contadora@ejemplo.test'].sort());
    const correos = correosA(duenioB.email);
    expect(correos).toHaveLength(antes + 1);
    const correo = correos[correos.length - 1]!;
    expect(correo.para.sort()).toEqual([duenioB.email, 'contadora@ejemplo.test'].sort());
    expect(correo.asunto).toMatch(/^Tu semana en /);
    expect(correo.texto).toContain('Ventas netas');
    expect(correo.texto).toContain('Productos estrella');
    expect(correo.texto).toContain('Oportunidades de ahorro');
    expect(correo.html).toContain(`/reportes/${reporte.id}`);
  }, 120_000);

  it('CP-09.3b una sola vez y sin duplicados', async () => {
    const semana = ultimaSemanaCerrada();
    const antes = correosA(duenioB.email).length;
    await listar('', duenioB).expect(200);
    await t.app.get(ReportsCron).correr(semana);
    const r = await generar({ semana }, duenioB).expect(200);
    expect(r.body.enviadoEn).toBeTruthy();
    expect(correosA(duenioB.email)).toHaveLength(antes);
    const lista = (await listar('', duenioB).expect(200)).body.items;
    expect(lista.filter((x: { semana: string }) => x.semana === semana)).toHaveLength(1);
  }, 120_000);

  it('CP-09.3c sin proveedor de correo o con envío rechazado queda el motivo', async () => {
    mailer.configurado = false;
    const sin = await generar({ semana: '2026-W31' }, duenioB).expect(200);
    expect(sin.body).toMatchObject({ enviadoEn: null, motivoNoEnvio: 'SIN_PROVEEDOR' });
    mailer.configurado = true;
    mailer.rechazarA.add(duenioB.email);
    const fallido = await generar({ semana: '2026-W32' }, duenioB).expect(200);
    expect(fallido.body).toMatchObject({ enviadoEn: null, motivoNoEnvio: 'ENVIO_FALLIDO' });
    mailer.rechazarA.delete(duenioB.email);
    // Reenvío explícito desde el detalle.
    const reenviado = await t
      .http()
      .post(`/api/v1/reports/weekly/${fallido.body.id}/resend`)
      .set(auth(duenioB))
      .expect(200);
    expect(reenviado.body.enviadoEn).toBeTruthy();
    expect(reenviado.body.motivoNoEnvio).toBeNull();
  }, 120_000);

  it('CP-09.3d con los reportes desactivados no se genera nada automáticamente', async () => {
    await patchAjustes({ activo: false }, duenioB).expect(200);
    const r = await t.app.get(ReportsCron).correr('2026-W33');
    expect(r.fallidos).toBe(0);
    const deB = (await listar('', duenioB).expect(200)).body.items;
    expect(deB.some((x: { semana: string }) => x.semana === '2026-W33')).toBe(false);
    const deA = (await listar('', duenioA).expect(200)).body.items;
    expect(deA.some((x: { semana: string }) => x.semana === '2026-W33')).toBe(true);
    // A pedido sigue funcionando, sin correo.
    const antes = correosA(duenioB.email).length;
    const pedido = await generar({ semana: '2026-W33' }, duenioB).expect(200);
    expect(pedido.body.enviadoEn).toBeNull();
    expect(correosA(duenioB.email)).toHaveLength(antes);
    await patchAjustes({ activo: true }, duenioB).expect(200);
  }, 120_000);

  it('CP-09.3e generar a pedido con reenvío explícito y semana inválida', async () => {
    const antes = correosA(duenioA.email).length;
    const r = await generar({ semana: '2026-W38', enviar: true }).expect(200);
    expect(r.body.id).toBe(reporteW38);
    expect(correosA(duenioA.email)).toHaveLength(antes + 1);
    const invalida = await generar({ semana: '2026-W60' }).expect(400);
    expect(invalida.body.code).toBe('VALIDACION');
    await generar({ semana: '2026-38' }).expect(400);
  }, 120_000);

  it('CP-09.4 listado del más reciente al más antiguo, cursor y detalle', async () => {
    await generar({ semana: '2026-W36' }).expect(200);
    const todos = (await listar('?limit=52').expect(200)).body.items;
    const semanas = todos.map((x: { semana: string }) => x.semana);
    expect([...semanas].sort().reverse()).toEqual(semanas);
    const fijas = semanas.filter((s: string) => ['2026-W36', '2026-W37', '2026-W38'].includes(s));
    expect(fijas).toEqual(['2026-W38', '2026-W37', '2026-W36']);
    const w38 = todos.find((x: { semana: string }) => x.semana === '2026-W38');
    expect(w38).toMatchObject({
      id: reporteW38,
      desde: '2026-09-14T03:00:00.000Z',
      hasta: '2026-09-21T03:00:00.000Z',
      ventasNetas: '117223.14',
      oportunidades: 3,
    });
    expect(w38.enviadoEn).toBeTruthy();
    const p1 = (await listar('?limit=2').expect(200)).body;
    expect(p1.items).toHaveLength(2);
    expect(p1.siguienteCursor).toBe(p1.items[1].semana);
    const p2 = (await listar(`?limit=2&cursor=${p1.siguienteCursor}`).expect(200)).body;
    expect(p2.items[0].semana < p1.siguienteCursor).toBe(true);
    const detalle = (await obtener(reporteW38).expect(200)).body;
    expect(detalle.contenido.estrellas.length).toBeGreaterThan(0);
    expect(detalle.contenido.oportunidades.comprarMasBarato.items[0].producto.codigo).toBe(
      'FA-220',
    );
  }, 120_000);

  it('CP-09.5 ajustes', async () => {
    await patchAjustes({ destinatariosExtra: ['contadora@ejemplo.test'] }).expect(200);
    await patchAjustes({ activo: false }).expect(200);
    expect((await ajustes().expect(200)).body).toEqual({
      activo: false,
      destinatariosExtra: ['contadora@ejemplo.test'],
    });
    for (const malo of [
      { destinatariosExtra: Array.from({ length: 6 }, (_, i) => `p${i}@ejemplo.test`) },
      { destinatariosExtra: ['no-es-mail'] },
      { destinatariosExtra: ['a@b.test', 'a@b.test'] },
    ]) {
      const r = await patchAjustes(malo).expect(400);
      expect(r.body.code).toBe('VALIDACION');
      expect(r.body.details.destinatariosExtra).toBeDefined();
    }
    await patchAjustes({ activo: true, destinatariosExtra: [] }).expect(200);
  }, 120_000);

  it('CP-09.6 plan FREE: 402 en todas las rutas', async () => {
    const r = await listar('', duenioF).expect(402);
    expect(r.body.code).toBe('PLAN_REQUERIDO');
    await ajustes(duenioF).expect(402);
    await generar({}, duenioF).expect(402);
  }, 120_000);

  it('CP-09.6b roles: contador consulta, no opera; empleado no accede', async () => {
    await listar('', contador).expect(200);
    await obtener(reporteW38, contador).expect(200);
    await ajustes(contador).expect(200);
    const r = await generar({}, contador).expect(403);
    expect(r.body.code).toBe('SIN_PERMISO');
    await patchAjustes({ activo: false }, contador).expect(403);
    await listar('', empleada).expect(403);
  }, 120_000);

  it('CP-09.6c aislamiento: B no ve los reportes de A', async () => {
    const deB = (await listar('?limit=52', duenioB).expect(200)).body.items;
    expect(deB.some((x: { id: string }) => x.id === reporteW38)).toBe(false);
    await obtener(reporteW38, duenioB).expect(404);
    await t
      .http()
      .post(`/api/v1/reports/weekly/${reporteW38}/resend`)
      .set(auth(duenioB))
      .expect(404);
  }, 120_000);
});
