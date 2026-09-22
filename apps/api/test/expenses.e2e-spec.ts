import { randomUUID } from 'node:crypto';
import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

describe('operating-expenses: gastos operativos (e2e)', () => {
  let t: AppDePrueba;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const empleada = persona('empleada');
  const contador = persona('contador');
  let comercioA: string;
  let productoId: string;
  let alquilerId: string;

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const gasto = (quien: { token: string }, body: object) =>
    t.http().post('/api/v1/expenses').set(auth(quien)).send(body);
  const listar = (query: string, quien = duenioA) =>
    t.http().get(`/api/v1/expenses?${query}`).set(auth(quien));
  const resumen = (periodo: string, quien = duenioA) =>
    t.http().get(`/api/v1/expenses/summary?periodo=${periodo}`).set(auth(quien));
  const venta = (cantidad: number, fecha: string) =>
    t
      .http()
      .post('/api/v1/movements')
      .set(auth(duenioA))
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
    productoId = (
      await t
        .http()
        .post('/api/v1/products')
        .set(auth(duenioA))
        .send({
          codigo: 'FA-220',
          nombre: 'Filtro',
          precioVenta: 3900,
          costoReposicion: 2100,
          stockInicial: 500,
        })
        .expect(201)
    ).body.id;
    // Ventas de septiembre de 2026: 100 + 45 válidas, más 5 anuladas. Una de julio para CP-13.5.
    // La del 31 de agosto a las 23:30 de Buenos Aires (02:30 UTC del 1 de septiembre) es de agosto.
    await venta(100, '2026-09-05T10:00:00-03:00').expect(201);
    await venta(45, '2026-09-20T18:00:00-03:00').expect(201);
    const anulada = await venta(5, '2026-09-10T12:00:00-03:00').expect(201);
    await t
      .http()
      .post(`/api/v1/movements/${anulada.body.id}/anular`)
      .set(auth(duenioA))
      .expect(201);
    await venta(3, '2026-07-15T12:00:00-03:00').expect(201);
    await venta(7, '2026-08-31T23:30:00-03:00').expect(201);
  });

  afterAll(async () => {
    await t.limpiar();
  });

  it('CP-13.1 alta de un gasto fijo mensual', async () => {
    const res = await gasto(duenioA, {
      concepto: 'Alquiler',
      tipo: 'FIJO',
      importe: '250000',
      periodo: '2026-08',
      periodicidad: 'MENSUAL',
    }).expect(201);
    expect(res.body).toMatchObject({
      concepto: 'Alquiler',
      tipo: 'FIJO',
      importe: '250000.00',
      periodo: '2026-08',
      periodicidad: 'MENSUAL',
      fin: null,
      notas: null,
      usuario: { nombre: duenioA.nombre },
    });
    alquilerId = res.body.id;
    const lista = await listar('periodo=2026-09').expect(200);
    expect(lista.body.items.map((g: { id: string }) => g.id)).toContain(alquilerId);
  });

  it('CP-13.1c datos inválidos nombran cada campo', async () => {
    const res = await gasto(duenioA, {
      concepto: '',
      tipo: 'OTRO',
      importe: 0,
      periodo: 'septiembre',
      periodicidad: 'SEMANAL',
    }).expect(400);
    expect(res.body.code).toBe('VALIDACION');
    expect(Object.keys(res.body.details).sort()).toEqual([
      'concepto',
      'importe',
      'periodicidad',
      'periodo',
      'tipo',
    ]);
    const finAnterior = await gasto(duenioA, {
      concepto: 'Seguro',
      tipo: 'FIJO',
      importe: 1,
      periodo: '2026-09',
      periodicidad: 'ANUAL',
      fin: '2026-08',
    }).expect(400);
    expect(finAnterior.body.details).toHaveProperty('fin');
  });

  it('CP-13.2 listado del mes con recurrentes, prorrateo anual y totales', async () => {
    await gasto(duenioA, {
      concepto: 'Seguro',
      tipo: 'FIJO',
      importe: 120000,
      periodo: '2026-09',
      periodicidad: 'ANUAL',
    }).expect(201);
    await gasto(duenioA, {
      concepto: 'Comisiones',
      tipo: 'VARIABLE',
      importe: 30000,
      periodo: '2026-09',
      periodicidad: 'UNICO',
    }).expect(201);
    await gasto(duenioA, {
      concepto: 'Flete',
      tipo: 'VARIABLE',
      importe: 8000,
      periodo: '2026-08',
      periodicidad: 'UNICO',
    }).expect(201);

    const res = await listar('periodo=2026-09').expect(200);
    const porConcepto = Object.fromEntries(
      res.body.items.map((g: { concepto: string; importeMes: string }) => [
        g.concepto,
        g.importeMes,
      ]),
    );
    expect(porConcepto).toEqual({
      Alquiler: '250000.00',
      Seguro: '10000.00',
      Comisiones: '30000.00',
    });
    expect(res.body.totales).toEqual({
      fijos: '260000.00',
      variables: '30000.00',
      total: '290000.00',
    });
    expect(res.body.periodo).toBe('2026-09');
  });

  it('CP-13.2b recurrente con fin y CP-13.1b edición', async () => {
    const limpieza = await gasto(duenioA, {
      concepto: 'Limpieza',
      tipo: 'FIJO',
      importe: 5000,
      periodo: '2026-06',
      periodicidad: 'MENSUAL',
      fin: '2026-08',
    }).expect(201);
    for (const [mes, esperado] of [
      ['2026-07', true],
      ['2026-08', true],
      ['2026-09', false],
    ] as const) {
      const res = await listar(`periodo=${mes}`).expect(200);
      expect(res.body.items.some((g: { id: string }) => g.id === limpieza.body.id)).toBe(esperado);
    }
    const editado = await t
      .http()
      .patch(`/api/v1/expenses/${limpieza.body.id}`)
      .set(auth(duenioA))
      .send({ importe: '6000', fin: null })
      .expect(200);
    expect(editado.body).toMatchObject({ importe: '6000.00', fin: null });
    const ahoraSi = await listar('periodo=2026-09').expect(200);
    expect(ahoraSi.body.items.some((g: { id: string }) => g.id === limpieza.body.id)).toBe(true);

    const incoherente = await t
      .http()
      .patch(`/api/v1/expenses/${limpieza.body.id}`)
      .set(auth(duenioA))
      .send({ periodicidad: 'UNICO', fin: '2026-12' })
      .expect(400);
    expect(incoherente.body.details).toHaveProperty('fin');

    await t.http().delete(`/api/v1/expenses/${limpieza.body.id}`).set(auth(duenioA)).expect(204);
    await t.http().get(`/api/v1/expenses/${limpieza.body.id}`).set(auth(duenioA)).expect(404);
    const sinLimpieza = await listar('periodo=2026-09').expect(200);
    expect(sinLimpieza.body.items.some((g: { id: string }) => g.id === limpieza.body.id)).toBe(
      false,
    );
  });

  it('CP-13.2c filtro por tipo y período inválido', async () => {
    const variables = await listar('periodo=2026-09&tipo=VARIABLE').expect(200);
    expect(variables.body.items.map((g: { concepto: string }) => g.concepto)).toEqual([
      'Comisiones',
    ]);
    const malo = await listar('periodo=2026-13').expect(400);
    expect(malo.body.details).toHaveProperty('periodo');
  });

  it('CP-13.3 gasto por unidad vendida del mes, sin contar la venta anulada', async () => {
    const res = await resumen('2026-09').expect(200);
    expect(res.body).toEqual({
      periodo: '2026-09',
      totalFijos: '260000.00',
      totalVariables: '30000.00',
      total: '290000.00',
      unidadesVendidas: 145,
      gastoPorUnidad: '2000.00',
      motivo: null,
    });
  });

  it('CP-13.3b los límites del mes se toman en hora de Buenos Aires', async () => {
    const res = await resumen('2026-08').expect(200);
    expect(res.body).toMatchObject({
      total: '258000.00',
      unidadesVendidas: 7,
      gastoPorUnidad: '36857.14',
      motivo: null,
    });
  });

  it('CP-13.5 sin gastos el prorrateo no es calculable aunque haya ventas', async () => {
    const res = await resumen('2026-07').expect(200);
    expect(res.body).toMatchObject({
      total: '0.00',
      unidadesVendidas: 3,
      gastoPorUnidad: null,
      motivo: 'SIN_GASTOS',
    });
  });

  it('CP-13.5b con gastos pero sin ventas', async () => {
    const res = await resumen('2026-11').expect(200);
    expect(res.body).toMatchObject({
      total: '260000.00',
      unidadesVendidas: 0,
      gastoPorUnidad: null,
      motivo: 'SIN_VENTAS',
    });
  });

  it('CP-13.4 el contador consulta y no escribe; el empleado no accede', async () => {
    await listar('periodo=2026-09', contador).expect(200);
    await resumen('2026-09', contador).expect(200);
    await t.http().get(`/api/v1/expenses/${alquilerId}`).set(auth(contador)).expect(200);
    const alta = await gasto(contador, {
      concepto: 'Hack',
      tipo: 'FIJO',
      importe: 1,
      periodo: '2026-09',
      periodicidad: 'UNICO',
    }).expect(403);
    expect(alta.body.code).toBe('SIN_PERMISO');
    await t.http().delete(`/api/v1/expenses/${alquilerId}`).set(auth(contador)).expect(403);
    const empleado = await listar('periodo=2026-09', empleada).expect(403);
    expect(empleado.body.code).toBe('SIN_PERMISO');
    await resumen('2026-09', empleada).expect(403);
  });

  it('CP-13.6 acceso cruzado: 404 y nada cambia en el otro comercio', async () => {
    const deB = await gasto(duenioB, {
      concepto: 'Alquiler de B',
      tipo: 'FIJO',
      importe: 999,
      periodo: '2026-09',
      periodicidad: 'MENSUAL',
    }).expect(201);
    await t.http().get(`/api/v1/expenses/${deB.body.id}`).set(auth(duenioA)).expect(404);
    await t
      .http()
      .patch(`/api/v1/expenses/${deB.body.id}`)
      .set(auth(duenioA))
      .send({ importe: 1 })
      .expect(404);
    await t.http().delete(`/api/v1/expenses/${deB.body.id}`).set(auth(duenioA)).expect(404);
    await t.http().get(`/api/v1/expenses/${randomUUID()}`).set(auth(duenioA)).expect(404);

    const listaA = await listar('periodo=2026-09').expect(200);
    expect(listaA.body.items.map((g: { id: string }) => g.id)).not.toContain(deB.body.id);
    const resumenA = await resumen('2026-09').expect(200);
    expect(resumenA.body.total).toBe('290000.00');
    const intacto = await t
      .http()
      .get(`/api/v1/expenses/${deB.body.id}`)
      .set(auth(duenioB))
      .expect(200);
    expect(intacto.body.importe).toBe('999.00');
    const resumenB = await resumen('2026-09', duenioB).expect(200);
    expect(resumenB.body).toMatchObject({
      total: '999.00',
      unidadesVendidas: 0,
      motivo: 'SIN_VENTAS',
    });
  });
});
