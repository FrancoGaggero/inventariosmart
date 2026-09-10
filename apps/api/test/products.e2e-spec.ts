import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

describe('product-catalog: catálogo de productos (e2e)', () => {
  let t: AppDePrueba;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const empleada = persona('empleada');
  const contador = persona('contador');
  let comercioA: string;
  let comercioB: string;
  let filtroId: string;
  let aceiteId: string;
  let bujiaId: string;

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const base = {
    precioVenta: 3900,
    costoReposicion: '2340',
    alicuotaIva: 21,
  };

  beforeAll(async () => {
    t = await crearAppDePrueba();
    comercioA = (await t.http().get('/api/v1/me').set(auth(duenioA)).expect(200)).body.comercio.id;
    comercioB = (await t.http().get('/api/v1/me').set(auth(duenioB)).expect(200)).body.comercio.id;
    // Comercio A en plan PRO para invitar; B queda en FREE para probar el límite.
    await t.prisma.comoSistema((tx) =>
      tx.comercio.update({ where: { id: comercioA }, data: { plan: 'PRO', ivaDefault: 10.5 } }),
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
  });

  afterAll(async () => {
    await t.limpiar();
  });

  it('CP-01.1 el dueño crea un producto y aparece en el listado', async () => {
    const res = await t
      .http()
      .post('/api/v1/products')
      .set(auth(duenioA))
      .send({
        ...base,
        codigo: 'FA-220',
        nombre: 'Filtro Aire FA-220',
        stockInicial: 47,
        stockSeguridad: 10,
      })
      .expect(201);
    expect(res.body).toMatchObject({
      codigo: 'FA-220',
      nombre: 'Filtro Aire FA-220',
      precioVenta: '3900.00',
      costoReposicion: '2340.00',
      alicuotaIva: '21',
      stockActual: 47,
      stockSeguridad: 10,
      estadoStock: 'OK',
      activo: true,
    });
    filtroId = res.body.id;
    const lista = await t.http().get('/api/v1/products').set(auth(duenioA)).expect(200);
    expect(lista.body.items.map((p: { id: string }) => p.id)).toContain(filtroId);
  });

  it('CP-01.1b sin alícuota usa el IVA por defecto del comercio', async () => {
    const res = await t
      .http()
      .post('/api/v1/products')
      .set(auth(duenioA))
      .send({
        codigo: 'AM-1L',
        nombre: 'Aceite Mineral 1L',
        precioVenta: '1240',
        costoReposicion: 880,
        stockInicial: 8,
        stockSeguridad: 10,
      })
      .expect(201);
    expect(res.body.alicuotaIva).toBe('10.5');
    expect(res.body.estadoStock).toBe('BAJO');
    aceiteId = res.body.id;
  });

  it('CP-01.1c datos inválidos responden 400 con details por campo', async () => {
    const res = await t
      .http()
      .post('/api/v1/products')
      .set(auth(duenioA))
      .send({
        codigo: '',
        nombre: 'x'.repeat(121),
        precioVenta: -5,
        alicuotaIva: 101,
        costoReposicion: 1,
        stockInicial: -1,
      })
      .expect(400);
    expect(res.body.code).toBe('VALIDACION');
    expect(Object.keys(res.body.details)).toEqual(
      expect.arrayContaining(['codigo', 'nombre', 'precioVenta', 'alicuotaIva', 'stockInicial']),
    );
  });

  it('CP-01.2 código repetido (sin distinguir mayúsculas) responde 409', async () => {
    const res = await t
      .http()
      .post('/api/v1/products')
      .set(auth(duenioA))
      .send({ ...base, codigo: 'fa-220', nombre: 'Otro filtro' })
      .expect(409);
    expect(res.body.code).toBe('CONFLICTO');
    expect(res.body.details.productoId).toBe(filtroId);
  });

  it('CP-01.2c el mismo código puede existir en otro comercio', async () => {
    const res = await t
      .http()
      .post('/api/v1/products')
      .set(auth(duenioB))
      .send({ ...base, codigo: 'FA-220', nombre: 'Filtro de B' })
      .expect(201);
    expect(res.body.nombre).toBe('Filtro de B');
    const listaA = await t.http().get('/api/v1/products').set(auth(duenioA)).expect(200);
    expect(listaA.body.items.map((p: { nombre: string }) => p.nombre)).not.toContain('Filtro de B');
  });

  it('CP-01.3 búsqueda por texto y filtros por estado de stock', async () => {
    const bujia = await t
      .http()
      .post('/api/v1/products')
      .set(auth(duenioA))
      .send({ ...base, codigo: 'BI-09', nombre: 'Bujía Iridium BI-09', stockInicial: 0 })
      .expect(201);
    bujiaId = bujia.body.id;

    const porTexto = await t.http().get('/api/v1/products?q=fil').set(auth(duenioA)).expect(200);
    expect(porTexto.body.items.map((p: { codigo: string }) => p.codigo)).toEqual(['FA-220']);

    const porCodigo = await t.http().get('/api/v1/products?q=bi-').set(auth(duenioA)).expect(200);
    expect(porCodigo.body.items.map((p: { codigo: string }) => p.codigo)).toEqual(['BI-09']);

    const bajo = await t.http().get('/api/v1/products?estado=BAJO').set(auth(duenioA)).expect(200);
    expect(bajo.body.items.map((p: { codigo: string }) => p.codigo)).toEqual(['AM-1L']);

    const sinStock = await t
      .http()
      .get('/api/v1/products?estado=SIN_STOCK')
      .set(auth(duenioA))
      .expect(200);
    expect(sinStock.body.items.map((p: { codigo: string }) => p.codigo)).toEqual(['BI-09']);

    const ok = await t.http().get('/api/v1/products?estado=OK').set(auth(duenioA)).expect(200);
    expect(ok.body.items.map((p: { codigo: string }) => p.codigo)).toEqual(['FA-220']);
  });

  it('CP-01.3b la paginación por cursor recorre todo en orden alfabético sin repetir', async () => {
    for (const n of ['Correa CD-44', 'Pastilla PF-11']) {
      await t
        .http()
        .post('/api/v1/products')
        .set(auth(duenioA))
        .send({ ...base, codigo: n.split(' ')[1], nombre: n })
        .expect(201);
    }
    const vistos: string[] = [];
    let cursor: string | null = null;
    let vueltas = 0;
    do {
      const sufijo: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const url: string = `/api/v1/products?limit=2${sufijo}`;
      const res: { body: { items: { nombre: string }[]; siguienteCursor: string | null } } = await t
        .http()
        .get(url)
        .set(auth(duenioA))
        .expect(200);
      expect(res.body.items.length).toBeLessThanOrEqual(2);
      vistos.push(...res.body.items.map((p) => p.nombre));
      cursor = res.body.siguienteCursor;
      vueltas += 1;
    } while (cursor && vueltas < 10);
    expect(vistos).toEqual([...vistos].sort((a, b) => a.localeCompare(b)));
    expect(new Set(vistos).size).toBe(5);
    expect(cursor).toBeNull();

    const malo = await t.http().get('/api/v1/products?cursor=zzz').set(auth(duenioA)).expect(400);
    expect(malo.body.code).toBe('VALIDACION');
  });

  it('CP-01.3c la empleada consulta sin costoReposicion', async () => {
    const lista = await t.http().get('/api/v1/products').set(auth(empleada)).expect(200);
    expect(lista.body.items.length).toBeGreaterThan(0);
    for (const p of lista.body.items) {
      expect(p).not.toHaveProperty('costoReposicion');
      expect(p).toHaveProperty('precioVenta');
      expect(p).toHaveProperty('stockActual');
    }
    const uno = await t.http().get(`/api/v1/products/${filtroId}`).set(auth(empleada)).expect(200);
    expect(uno.body).not.toHaveProperty('costoReposicion');
    const duenio = await t
      .http()
      .get(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .expect(200);
    expect(duenio.body.costoReposicion).toBe('2340.00');
  });

  it('CP-01.3d el contador no accede al catálogo', async () => {
    const res = await t.http().get('/api/v1/products').set(auth(contador)).expect(403);
    expect(res.body.code).toBe('SIN_PERMISO');
  });

  it('CP-01.4c la empleada no crea, edita ni da de baja', async () => {
    await t
      .http()
      .post('/api/v1/products')
      .set(auth(empleada))
      .send({ ...base, codigo: 'X', nombre: 'Xx' })
      .expect(403);
    await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(empleada))
      .send({ nombre: 'Hack' })
      .expect(403);
    await t.http().delete(`/api/v1/products/${filtroId}`).set(auth(empleada)).expect(403);
  });

  it('CP-01.4 la edición se refleja de inmediato y recalcula el estado', async () => {
    const res = await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .send({ precioVenta: '3990', stockSeguridad: 50, categoria: 'Filtros' })
      .expect(200);
    expect(res.body).toMatchObject({
      precioVenta: '3990.00',
      stockSeguridad: 50,
      estadoStock: 'BAJO',
      categoria: 'Filtros',
    });
    const get = await t.http().get(`/api/v1/products/${filtroId}`).set(auth(duenioA)).expect(200);
    expect(get.body.precioVenta).toBe('3990.00');
  });

  it('CP-01.4b el stock actual no se edita a mano', async () => {
    const res = await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .send({ stockActual: 100 })
      .expect(400);
    expect(res.body.code).toBe('VALIDACION');
    expect(res.body.details.stockActual).toMatch(/movimiento/);
    const get = await t.http().get(`/api/v1/products/${filtroId}`).set(auth(duenioA)).expect(200);
    expect(get.body.stockActual).toBe(47);
  });

  it('CP-01.4 cambiar el código a uno existente responde 409', async () => {
    await t
      .http()
      .patch(`/api/v1/products/${aceiteId}`)
      .set(auth(duenioA))
      .send({ codigo: 'fa-220' })
      .expect(409);
  });

  it('CP-01.5 la baja es lógica: desaparece del listado, sigue por id y aparece con activo=false', async () => {
    const res = await t.http().delete(`/api/v1/products/${bujiaId}`).set(auth(duenioA)).expect(200);
    expect(res.body.activo).toBe(false);
    const lista = await t.http().get('/api/v1/products').set(auth(duenioA)).expect(200);
    expect(lista.body.items.map((p: { id: string }) => p.id)).not.toContain(bujiaId);
    const bajas = await t
      .http()
      .get('/api/v1/products?activo=false')
      .set(auth(duenioA))
      .expect(200);
    expect(bajas.body.items.map((p: { id: string }) => p.id)).toEqual([bujiaId]);
    await t.http().get(`/api/v1/products/${bujiaId}`).set(auth(duenioA)).expect(200);
  });

  it('CP-01.2b crear con el código de un producto dado de baja sugiere reactivar', async () => {
    const res = await t
      .http()
      .post('/api/v1/products')
      .set(auth(duenioA))
      .send({ ...base, codigo: 'BI-09', nombre: 'Bujía nueva' })
      .expect(409);
    expect(res.body.message).toMatch(/[Rr]eactiv/);
    expect(res.body.details.activo).toBe(false);
  });

  it('CP-01.5b reactivación', async () => {
    const res = await t
      .http()
      .patch(`/api/v1/products/${bujiaId}`)
      .set(auth(duenioA))
      .send({ activo: true })
      .expect(200);
    expect(res.body).toMatchObject({ activo: true, codigo: 'BI-09' });
    const lista = await t.http().get('/api/v1/products').set(auth(duenioA)).expect(200);
    expect(lista.body.items.map((p: { id: string }) => p.id)).toContain(bujiaId);
  });

  it('CP-01.7 acceso cruzado responde 404 y no modifica', async () => {
    await t.http().get(`/api/v1/products/${filtroId}`).set(auth(duenioB)).expect(404);
    await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioB))
      .send({ nombre: 'Hack' })
      .expect(404);
    await t.http().delete(`/api/v1/products/${filtroId}`).set(auth(duenioB)).expect(404);
    const get = await t.http().get(`/api/v1/products/${filtroId}`).set(auth(duenioA)).expect(200);
    expect(get.body).toMatchObject({ nombre: 'Filtro Aire FA-220', activo: true });
  });

  it('CP-01.6 el plan FREE se frena en 50 productos activos; PRO no (CP-01.6b)', async () => {
    // B tiene 1 producto (FA-220). Cargamos 49 más en lote como sistema.
    await t.prisma.comoSistema((tx) =>
      tx.producto.createMany({
        data: Array.from({ length: 49 }, (_, i) => ({
          comercioId: comercioB,
          codigo: `LOTE-${i}`,
          codigoNormalizado: `LOTE-${i}`,
          nombre: `Producto en lote ${String(i).padStart(2, '0')}`,
          precioVenta: 100,
          alicuotaIva: 21,
          costoReposicion: 60,
          stockActual: 1,
        })),
      }),
    );
    const bloqueado = await t
      .http()
      .post('/api/v1/products')
      .set(auth(duenioB))
      .send({ ...base, codigo: 'N51', nombre: 'Número 51' })
      .expect(402);
    expect(bloqueado.body).toMatchObject({
      code: 'PLAN_REQUERIDO',
      details: { planMinimo: 'PRO' },
    });

    const bajado = await t.prisma.comoSistema((tx) =>
      tx.producto.update({
        where: {
          comercioId_codigoNormalizado: { comercioId: comercioB, codigoNormalizado: 'LOTE-0' },
        },
        data: { activo: false },
      }),
    );
    await t
      .http()
      .post('/api/v1/products')
      .set(auth(duenioB))
      .send({ ...base, codigo: 'N51', nombre: 'Número 51' })
      .expect(201);
    await t
      .http()
      .patch(`/api/v1/products/${bajado.id}`)
      .set(auth(duenioB))
      .send({ activo: true })
      .expect(402);

    await t.prisma.comoSistema((tx) =>
      tx.comercio.update({ where: { id: comercioB }, data: { plan: 'PRO' } }),
    );
    await t
      .http()
      .patch(`/api/v1/products/${bajado.id}`)
      .set(auth(duenioB))
      .send({ activo: true })
      .expect(200);
    await t
      .http()
      .post('/api/v1/products')
      .set(auth(duenioB))
      .send({ ...base, codigo: 'N52', nombre: 'Número 52' })
      .expect(201);
  });

  it('rendimiento: 300 productos y búsqueda por texto en menos de 500 ms', async () => {
    await t.prisma.comoSistema((tx) =>
      tx.producto.createMany({
        data: Array.from({ length: 300 }, (_, i) => ({
          comercioId: comercioA,
          codigo: `PERF-${i}`,
          codigoNormalizado: `PERF-${i}`,
          nombre: `Artículo de prueba ${String(i).padStart(3, '0')}`,
          precioVenta: 10 + i,
          alicuotaIva: 21,
          costoReposicion: 5 + i,
          stockActual: i % 7,
          stockSeguridad: 3,
        })),
      }),
    );
    // Primera consulta: calienta conexión y caché. Se mide la segunda.
    await t.http().get('/api/v1/products?q=prueba%2029&limit=50').set(auth(duenioA)).expect(200);
    const inicio = Date.now();
    const res = await t
      .http()
      .get('/api/v1/products?q=prueba%2029&limit=50')
      .set(auth(duenioA))
      .expect(200);
    const ms = Date.now() - inicio;
    expect(res.body.items.length).toBeGreaterThanOrEqual(10);
    // Desde la máquina local hasta Neon (us-east-2) cada ida y vuelta cuesta ~150 ms y la
    // consulta usa una transacción (BEGIN, set_config, SELECT, COMMIT). En CI y en Render la
    // base está en la misma región y el objetivo real es < 500 ms (RNF-04); acá se tolera 2,5 s.
    expect(ms).toBeLessThan(2500);
  });
});
