import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type AppDePrueba, comoPropietaria, crearAppDePrueba, persona } from './helpers';

const DIA = 86_400_000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();

/** Ninguna clave del cuerpo (a cualquier profundidad) empieza con costo o margen. */
function clavesSensibles(valor: unknown, acumulado: string[] = []): string[] {
  if (Array.isArray(valor)) valor.forEach((v) => clavesSensibles(v, acumulado));
  else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (/^(costo|margen)/i.test(k)) acumulado.push(k);
      clavesSensibles(v, acumulado);
    }
  }
  return acumulado;
}

describe('stock-movements: movimientos de stock (e2e)', () => {
  let t: AppDePrueba;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const empleada = persona('empleada');
  const contador = persona('contador');
  let comercioA: string;
  let comercioB: string;
  let filtroId: string;
  let ventaId: string;
  let ajusteAnulacionId: string;

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });

  const crearProducto = async (
    quien: { token: string },
    datos: { codigo: string; nombre: string; stockInicial?: number; stockSeguridad?: number },
  ): Promise<{ id: string; stockActual: number }> => {
    const res = await t
      .http()
      .post('/api/v1/products')
      .set(auth(quien))
      .send({
        precioVenta: 3900,
        costoReposicion: '2340',
        alicuotaIva: 21,
        stockInicial: 0,
        stockSeguridad: 0,
        ...datos,
      })
      .expect(201);
    return res.body;
  };

  const registrar = (quien: { token: string }, body: object, clave?: string) => {
    const req = t.http().post('/api/v1/movements').set(auth(quien));
    return clave ? req.set('Idempotency-Key', clave).send(body) : req.send(body);
  };

  const stockDe = async (id: string): Promise<number> =>
    (await t.http().get(`/api/v1/products/${id}`).set(auth(duenioA)).expect(200)).body.stockActual;

  beforeAll(async () => {
    t = await crearAppDePrueba();
    comercioA = (await t.http().get('/api/v1/me').set(auth(duenioA)).expect(200)).body.comercio.id;
    comercioB = (await t.http().get('/api/v1/me').set(auth(duenioB)).expect(200)).body.comercio.id;
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
    filtroId = (
      await crearProducto(duenioA, {
        codigo: 'FA-220',
        nombre: 'Filtro Aire FA-220',
        stockInicial: 47,
        stockSeguridad: 10,
      })
    ).id;
  });

  afterAll(async () => {
    await t.limpiar();
  });

  it('CP-10.9 el alta de un producto deja su INGRESO de stock inicial', async () => {
    expect(await stockDe(filtroId)).toBe(47);
    const res = await t
      .http()
      .get(`/api/v1/movements?productoId=${filtroId}`)
      .set(auth(duenioA))
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      tipo: 'INGRESO',
      cantidad: 47,
      efectoStock: 47,
      stockResultante: 47,
      motivo: 'STOCK_INICIAL',
      precioUnitario: null,
      usuario: { nombre: duenioA.nombre },
      producto: { id: filtroId, codigo: 'FA-220' },
    });

    const sinStock = await crearProducto(duenioA, { codigo: 'SIN', nombre: 'Sin stock inicial' });
    const vacio = await t
      .http()
      .get(`/api/v1/movements?productoId=${sinStock.id}`)
      .set(auth(duenioA))
      .expect(200);
    expect(vacio.body.items).toEqual([]);
  });

  it('CP-10.1 la empleada registra una venta con sus datos', async () => {
    const antes = Date.now();
    const res = await registrar(empleada, {
      tipo: 'VENTA',
      productoId: filtroId,
      cantidad: 2,
    }).expect(201);
    expect(res.body).toMatchObject({
      tipo: 'VENTA',
      cantidad: 2,
      efectoStock: -2,
      stockResultante: 45,
      estadoStock: 'OK',
      precioUnitario: '3900.00',
      motivo: null,
      corrigeAId: null,
      anuladoPorId: null,
      usuario: { nombre: empleada.nombre },
      producto: { id: filtroId, codigo: 'FA-220', nombre: 'Filtro Aire FA-220' },
    });
    expect(Math.abs(new Date(res.body.fecha).getTime() - antes)).toBeLessThan(60_000);
    ventaId = res.body.id;
  });

  it('CP-10.2 el stock del producto refleja la venta de inmediato', async () => {
    expect(await stockDe(filtroId)).toBe(45);
    const res = await t
      .http()
      .get(`/api/v1/movements?productoId=${filtroId}`)
      .set(auth(duenioA))
      .expect(200);
    expect(res.body.items[0]).toMatchObject({ id: ventaId, stockResultante: 45 });
  });

  it('CP-10.1b ingreso de mercadería con observación', async () => {
    const res = await registrar(duenioA, {
      tipo: 'INGRESO',
      productoId: filtroId,
      cantidad: 30,
      observacion: 'Remito 0001-00004512',
    }).expect(201);
    expect(res.body).toMatchObject({
      efectoStock: 30,
      stockResultante: 75,
      observacion: 'Remito 0001-00004512',
      precioUnitario: null,
    });
  });

  it('CP-10.1c el ajuste lleva motivo obligatorio y admite cantidad negativa', async () => {
    const res = await registrar(duenioA, {
      tipo: 'AJUSTE',
      productoId: filtroId,
      cantidad: -3,
      motivo: 'ROTURA',
    }).expect(201);
    expect(res.body).toMatchObject({ efectoStock: -3, stockResultante: 72, motivo: 'ROTURA' });

    const sinMotivo = await registrar(duenioA, {
      tipo: 'AJUSTE',
      productoId: filtroId,
      cantidad: -1,
    }).expect(400);
    expect(sinMotivo.body.code).toBe('VALIDACION');
    expect(sinMotivo.body.details).toHaveProperty('motivo');
    expect(await stockDe(filtroId)).toBe(72);
  });

  it('CP-10.1d la fecha puede ser retroactiva pero no futura', async () => {
    const fecha = hace(2);
    const ok = await registrar(duenioA, {
      tipo: 'VENTA',
      productoId: filtroId,
      cantidad: 1,
      fecha,
    }).expect(201);
    expect(ok.body.fecha).toBe(fecha);
    expect(new Date(ok.body.creadoEn).getTime()).toBeGreaterThan(new Date(fecha).getTime());

    const futura = await registrar(duenioA, {
      tipo: 'VENTA',
      productoId: filtroId,
      cantidad: 1,
      fecha: new Date(Date.now() + DIA).toISOString(),
    }).expect(400);
    expect(futura.body.details).toHaveProperty('fecha');
    expect(await stockDe(filtroId)).toBe(71);
  });

  it('CP-10.1e datos inválidos: 400 por campo, 404 producto inexistente, 409 dado de baja', async () => {
    const casos: [object, string][] = [
      [{ tipo: 'VENTA', productoId: filtroId, cantidad: 0 }, 'cantidad'],
      [{ tipo: 'INGRESO', productoId: filtroId, cantidad: -1 }, 'cantidad'],
      [{ tipo: 'VENTA', productoId: filtroId, cantidad: 1.5 }, 'cantidad'],
      [{ tipo: 'EGRESO', productoId: filtroId, cantidad: 1 }, 'tipo'],
      [
        { tipo: 'VENTA', productoId: filtroId, cantidad: 1, observacion: 'x'.repeat(201) },
        'observacion',
      ],
    ];
    for (const [body, campo] of casos) {
      const res = await registrar(duenioA, body).expect(400);
      expect(res.body.code).toBe('VALIDACION');
      expect(res.body.details).toHaveProperty(campo);
    }

    const inexistente = await registrar(duenioA, {
      tipo: 'VENTA',
      productoId: randomUUID(),
      cantidad: 1,
    }).expect(404);
    expect(inexistente.body.code).toBe('NO_ENCONTRADO');

    const baja = await crearProducto(duenioA, {
      codigo: 'BAJA',
      nombre: 'Dado de baja',
      stockInicial: 5,
    });
    await t.http().delete(`/api/v1/products/${baja.id}`).set(auth(duenioA)).expect(200);
    const inactivo = await registrar(duenioA, {
      tipo: 'VENTA',
      productoId: baja.id,
      cantidad: 1,
    }).expect(409);
    expect(inactivo.body.code).toBe('CONFLICTO');
    expect(inactivo.body.details).toMatchObject({ activo: false });

    expect(await stockDe(filtroId)).toBe(71);
  });

  it('CP-10.3 el stock nunca queda negativo: venta y ajuste mayores al disponible responden 409', async () => {
    const bujia = await crearProducto(duenioA, {
      codigo: 'BI-09',
      nombre: 'Bujía',
      stockInicial: 3,
    });

    const venta = await registrar(empleada, {
      tipo: 'VENTA',
      productoId: bujia.id,
      cantidad: 5,
    }).expect(409);
    expect(venta.body).toMatchObject({
      code: 'CONFLICTO',
      details: { stockActual: 3, cantidad: 5 },
    });
    expect(venta.body.message).toMatch(/stock suficiente/i);
    expect(await stockDe(bujia.id)).toBe(3);

    const ajuste = await registrar(duenioA, {
      tipo: 'AJUSTE',
      productoId: bujia.id,
      cantidad: -4,
      motivo: 'INVENTARIO',
    }).expect(409);
    expect(ajuste.body.code).toBe('CONFLICTO');
    expect(await stockDe(bujia.id)).toBe(3);

    // CP-10.3c: vender exactamente lo disponible deja el producto sin stock.
    const exacta = await registrar(empleada, {
      tipo: 'VENTA',
      productoId: bujia.id,
      cantidad: 3,
    }).expect(201);
    expect(exacta.body).toMatchObject({ stockResultante: 0, estadoStock: 'SIN_STOCK' });
  });

  it('CP-10.10 una venta que deja el stock bajo lo avisa en la respuesta', async () => {
    const aceite = await crearProducto(duenioA, {
      codigo: 'AM-1L',
      nombre: 'Aceite Mineral 1L',
      stockInicial: 11,
      stockSeguridad: 10,
    });
    const res = await registrar(empleada, {
      tipo: 'VENTA',
      productoId: aceite.id,
      cantidad: 2,
    }).expect(201);
    expect(res.body).toMatchObject({ stockResultante: 9, estadoStock: 'BAJO' });
    const bajos = await t.http().get('/api/v1/products?estado=BAJO').set(auth(duenioA)).expect(200);
    expect(bajos.body.items.map((p: { id: string }) => p.id)).toContain(aceite.id);
  });

  it('CP-10.2b diez ventas en paralelo sobre el mismo producto se serializan sin negativos', async () => {
    const lote = await crearProducto(duenioA, { codigo: 'LOTE', nombre: 'Lote', stockInicial: 10 });
    const respuestas = await Promise.all(
      Array.from({ length: 10 }, () =>
        registrar(empleada, { tipo: 'VENTA', productoId: lote.id, cantidad: 1 }),
      ),
    );
    expect(respuestas.map((r) => r.status)).toEqual(Array(10).fill(201));
    const resultantes = respuestas
      .map((r) => r.body.stockResultante as number)
      .sort((a, b) => a - b);
    expect(resultantes).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(await stockDe(lote.id)).toBe(0);
  });

  it('CP-10.4 anular una venta registra el ajuste inverso y marca el original', async () => {
    const antes = await stockDe(filtroId);
    const res = await t
      .http()
      .post(`/api/v1/movements/${ventaId}/anular`)
      .set(auth(duenioA))
      .send({ observacion: 'Cobrada dos veces' })
      .expect(201);
    expect(res.body).toMatchObject({
      tipo: 'AJUSTE',
      cantidad: 2,
      efectoStock: 2,
      stockResultante: antes + 2,
      motivo: 'ANULACION',
      corrigeAId: ventaId,
      anuladoPorId: null,
      observacion: 'Cobrada dos veces',
      usuario: { nombre: duenioA.nombre },
    });
    ajusteAnulacionId = res.body.id;
    const original = await t
      .http()
      .get(`/api/v1/movements/${ventaId}`)
      .set(auth(duenioA))
      .expect(200);
    expect(original.body.anuladoPorId).toBe(ajusteAnulacionId);
    expect(await stockDe(filtroId)).toBe(antes + 2);
  });

  it('CP-10.4b no se anula dos veces ni se anula una anulación', async () => {
    const otraVez = await t
      .http()
      .post(`/api/v1/movements/${ventaId}/anular`)
      .set(auth(duenioA))
      .expect(409);
    expect(otraVez.body.code).toBe('CONFLICTO');
    const anulacion = await t
      .http()
      .post(`/api/v1/movements/${ajusteAnulacionId}/anular`)
      .set(auth(duenioA))
      .expect(409);
    expect(anulacion.body.code).toBe('CONFLICTO');
  });

  it('CP-10.4c no existe edición ni borrado de movimientos', async () => {
    await t
      .http()
      .patch(`/api/v1/movements/${ventaId}`)
      .set(auth(duenioA))
      .send({ cantidad: 1 })
      .expect(404);
    await t.http().delete(`/api/v1/movements/${ventaId}`).set(auth(duenioA)).expect(404);
    const sigue = await t.http().get(`/api/v1/movements/${ventaId}`).set(auth(duenioA)).expect(200);
    expect(sigue.body.cantidad).toBe(2);
  });

  it('CP-10.4d sólo el dueño anula', async () => {
    const res = await t
      .http()
      .post(`/api/v1/movements/${ajusteAnulacionId}/anular`)
      .set(auth(empleada))
      .expect(403);
    expect(res.body.code).toBe('SIN_PERMISO');
  });

  it('CP-10.5 las ventas de los últimos 30 días por producto, de la más reciente a la más antigua', async () => {
    const correa = await crearProducto(duenioA, {
      codigo: 'CD-44',
      nombre: 'Correa',
      stockInicial: 100,
    });
    for (const [tipo, dias] of [
      ['VENTA', 40],
      ['VENTA', 20],
      ['INGRESO', 10],
      ['VENTA', 2],
    ] as const) {
      await registrar(duenioA, {
        tipo,
        productoId: correa.id,
        cantidad: 1,
        fecha: hace(dias),
      }).expect(201);
    }
    const res = await t
      .http()
      .get(
        `/api/v1/movements?productoId=${correa.id}&tipo=VENTA&desde=${encodeURIComponent(hace(30))}`,
      )
      .set(auth(duenioA))
      .expect(200);
    const fechas = res.body.items.map((m: { fecha: string }) => new Date(m.fecha).getTime());
    expect(fechas).toHaveLength(2);
    expect(fechas[0]).toBeGreaterThan(fechas[1]);
    expect(Date.now() - fechas[0]).toBeLessThan(3 * DIA);
    expect(Date.now() - fechas[1]).toBeGreaterThan(19 * DIA);

    const hasta = await t
      .http()
      .get(
        `/api/v1/movements?productoId=${correa.id}&desde=${encodeURIComponent(hace(30))}&hasta=${encodeURIComponent(hace(5))}`,
      )
      .set(auth(duenioA))
      .expect(200);
    expect(hasta.body.items.map((m: { tipo: string }) => m.tipo)).toEqual(['INGRESO', 'VENTA']);
  });

  it('CP-10.5b el historial global se pagina por cursor sin repetir ni omitir', async () => {
    const todo = await t.http().get('/api/v1/movements?limit=100').set(auth(duenioA)).expect(200);
    const esperados: string[] = todo.body.items.map((m: { id: string }) => m.id);
    expect(esperados.length).toBeGreaterThan(5);
    expect(todo.body.siguienteCursor).toBeNull();
    for (const m of todo.body.items) {
      expect(m.producto.codigo).toBeTruthy();
      expect(m.producto.nombre).toBeTruthy();
    }
    const fechas = todo.body.items.map((m: { fecha: string }) => m.fecha);
    expect(fechas).toEqual([...fechas].sort().reverse());

    const vistos: string[] = [];
    let cursor: string | null = null;
    let vueltas = 0;
    do {
      const sufijo: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const res: { body: { items: { id: string }[]; siguienteCursor: string | null } } = await t
        .http()
        .get(`/api/v1/movements?limit=2${sufijo}`)
        .set(auth(duenioA))
        .expect(200);
      expect(res.body.items.length).toBeLessThanOrEqual(2);
      vistos.push(...res.body.items.map((m) => m.id));
      cursor = res.body.siguienteCursor;
      vueltas += 1;
    } while (cursor && vueltas < 50);
    expect(vistos).toEqual(esperados);
    expect(cursor).toBeNull();

    const malo = await t.http().get('/api/v1/movements?cursor=zzz').set(auth(duenioA)).expect(400);
    expect(malo.body.code).toBe('VALIDACION');
  });

  it('CP-10.5c rango de fechas inválido', async () => {
    const invertido = await t
      .http()
      .get(
        `/api/v1/movements?desde=${encodeURIComponent(hace(1))}&hasta=${encodeURIComponent(hace(5))}`,
      )
      .set(auth(duenioA))
      .expect(400);
    expect(invertido.body.details).toHaveProperty('hasta');
    const rota = await t.http().get('/api/v1/movements?desde=ayer').set(auth(duenioA)).expect(400);
    expect(rota.body.details).toHaveProperty('desde');
  });

  it('CP-10.6 la empleada registra y consulta sin ver costos ni márgenes', async () => {
    const lista = await t.http().get('/api/v1/movements').set(auth(empleada)).expect(200);
    expect(lista.body.items.length).toBeGreaterThan(0);
    expect(clavesSensibles(lista.body)).toEqual([]);
    const venta = lista.body.items.find((m: { tipo: string }) => m.tipo === 'VENTA');
    expect(venta.precioUnitario).toBe('3900.00');
  });

  it('CP-10.6b el contador consulta pero no registra', async () => {
    await t.http().get('/api/v1/movements').set(auth(contador)).expect(200);
    await t.http().get(`/api/v1/movements/${ventaId}`).set(auth(contador)).expect(200);
    const res = await registrar(contador, {
      tipo: 'VENTA',
      productoId: filtroId,
      cantidad: 1,
    }).expect(403);
    expect(res.body.code).toBe('SIN_PERMISO');
    await t.http().post(`/api/v1/movements/${ventaId}/anular`).set(auth(contador)).expect(403);
  });

  it('CP-10.8 repetir la Idempotency-Key devuelve 200 con el mismo movimiento y no toca el stock', async () => {
    const idem = await crearProducto(duenioA, {
      codigo: 'IDEM',
      nombre: 'Idempotente',
      stockInicial: 10,
    });
    const body = { tipo: 'VENTA', productoId: idem.id, cantidad: 1 };
    const primera = await registrar(empleada, body, 'abc-123').expect(201);
    const segunda = await registrar(empleada, body, 'abc-123').expect(200);
    expect(segunda.body.id).toBe(primera.body.id);
    expect(await stockDe(idem.id)).toBe(9);

    // Dos envíos simultáneos con la misma clave: uno crea, el otro devuelve el mismo.
    const clave = `par-${randomUUID()}`;
    const [a, b] = await Promise.all([
      registrar(empleada, body, clave),
      registrar(empleada, body, clave),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.id).toBe(b.body.id);
    expect(await stockDe(idem.id)).toBe(8);

    const larga = await registrar(empleada, body, 'k'.repeat(65)).expect(400);
    expect(larga.body.code).toBe('VALIDACION');
    expect(await stockDe(idem.id)).toBe(8);
  });

  it('CP-10.8b la clave es por comercio', async () => {
    const deB = await crearProducto(duenioB, {
      codigo: 'IDEM',
      nombre: 'Idempotente de B',
      stockInicial: 5,
    });
    const res = await registrar(
      duenioB,
      { tipo: 'VENTA', productoId: deB.id, cantidad: 1 },
      'abc-123',
    ).expect(201);
    expect(res.body.stockResultante).toBe(4);
  });

  it('CP-10.7 acceso cruzado: 404 y nada cambia en el otro comercio', async () => {
    const deB = await crearProducto(duenioB, {
      codigo: 'FA-220',
      nombre: 'Filtro de B',
      stockInicial: 8,
    });
    const movB = await registrar(duenioB, {
      tipo: 'VENTA',
      productoId: deB.id,
      cantidad: 1,
    }).expect(201);

    await t.http().get(`/api/v1/movements/${movB.body.id}`).set(auth(duenioA)).expect(404);
    await t.http().post(`/api/v1/movements/${movB.body.id}/anular`).set(auth(duenioA)).expect(404);
    const cruzado = await registrar(duenioA, {
      tipo: 'VENTA',
      productoId: deB.id,
      cantidad: 1,
    }).expect(404);
    expect(cruzado.body.code).toBe('NO_ENCONTRADO');

    const listaA = await t.http().get('/api/v1/movements?limit=100').set(auth(duenioA)).expect(200);
    expect(listaA.body.items.map((m: { id: string }) => m.id)).not.toContain(movB.body.id);
    const stockB = await t.http().get(`/api/v1/products/${deB.id}`).set(auth(duenioB)).expect(200);
    expect(stockB.body.stockActual).toBe(7);
    const movBIntacto = await t
      .http()
      .get(`/api/v1/movements/${movB.body.id}`)
      .set(auth(duenioB))
      .expect(200);
    expect(movBIntacto.body.anuladoPorId).toBeNull();
    expect(comercioB).not.toBe(comercioA);
  });

  it('CP-10.9b el backfill de la migración da su INGRESO inicial a los productos anteriores a HU-10', async () => {
    // Un producto "viejo": con stock pero sin movimientos, como los creados antes de esta change.
    const viejo = await t.prisma.comoSistema((tx) =>
      tx.producto.create({
        data: {
          comercioId: comercioA,
          codigo: 'VIEJO',
          codigoNormalizado: 'VIEJO',
          nombre: 'Anterior a HU-10',
          precioVenta: 100,
          alicuotaIva: 21,
          costoReposicion: 60,
          stockActual: 12,
          creadoEn: new Date(hace(90)),
        },
      }),
    );
    const antes = (await t.http().get('/api/v1/movements?limit=100').set(auth(duenioA)).expect(200))
      .body.items.length;

    const sql = readFileSync(
      resolve(__dirname, '../prisma/migrations/20260922_stock_movements/migration.sql'),
      'utf8',
    );
    const backfill = sql.slice(sql.indexOf('INSERT INTO "movimiento"'));
    await comoPropietaria((owner) => owner.$executeRawUnsafe(backfill));

    const res = await t
      .http()
      .get(`/api/v1/movements?productoId=${viejo.id}`)
      .set(auth(duenioA))
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      tipo: 'INGRESO',
      cantidad: 12,
      stockResultante: 12,
      motivo: 'STOCK_INICIAL',
      fecha: viejo.creadoEn.toISOString(),
      usuario: { nombre: duenioA.nombre },
    });
    // Los productos que ya tenían historial no reciben un segundo STOCK_INICIAL.
    const despues = (
      await t.http().get('/api/v1/movements?limit=100').set(auth(duenioA)).expect(200)
    ).body.items.length;
    expect(despues).toBe(antes + 1);
  });
});
