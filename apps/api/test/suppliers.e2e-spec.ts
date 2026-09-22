import { randomUUID } from 'node:crypto';
import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

describe('suppliers-price-lists: proveedores y listas de precios (e2e)', () => {
  let t: AppDePrueba;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const empleada = persona('empleada');
  const contador = persona('contador');
  let comercioA: string;
  let norteId: string;
  let surId: string;
  let filtroId: string;
  let aceiteId: string;
  let bujiaId: string;

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });

  const crearProducto = async (
    quien: { token: string },
    codigo: string,
    nombre: string,
    costoReposicion = '2100',
  ): Promise<string> => {
    const res = await t
      .http()
      .post('/api/v1/products')
      .set(auth(quien))
      .send({
        codigo,
        nombre,
        precioVenta: 3900,
        costoReposicion,
        alicuotaIva: 21,
        stockInicial: 5,
      })
      .expect(201);
    return res.body.id;
  };

  const crearProveedor = (quien: { token: string }, body: object) =>
    t.http().post('/api/v1/suppliers').set(auth(quien)).send(body);

  const producto = async (id: string) =>
    (await t.http().get(`/api/v1/products/${id}`).set(auth(duenioA)).expect(200)).body;

  const cargar = (proveedorId: string, items: object[], quien = duenioA) =>
    t.http().post(`/api/v1/suppliers/${proveedorId}/prices`).set(auth(quien)).send({ items });

  const vistaPrevia = (proveedorId: string, contenido: string, nombre = 'lista.csv') =>
    t
      .http()
      .post(`/api/v1/suppliers/${proveedorId}/price-list/preview`)
      .set(auth(duenioA))
      .attach('archivo', Buffer.from(contenido, 'utf8'), nombre);

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
    filtroId = await crearProducto(duenioA, 'FA-220', 'Filtro Aire FA-220');
    aceiteId = await crearProducto(duenioA, 'AM-1L', 'Aceite Mineral 1L', '800');
    bujiaId = await crearProducto(duenioA, 'BI-09', 'Bujía BI-09', '50');
  });

  afterAll(async () => {
    await t.limpiar();
  });

  it('CP-02.1 alta y edición de proveedor con defaults', async () => {
    const res = await crearProveedor(duenioA, {
      nombre: 'Distribuidora Norte',
      email: 'ventas@norte.com',
      telefono: '11-5555-0001',
      leadTimeDias: 5,
    }).expect(201);
    expect(res.body).toMatchObject({
      nombre: 'Distribuidora Norte',
      email: 'ventas@norte.com',
      leadTimeDias: 5,
      confiabilidad: 3,
      activo: true,
      cuit: null,
    });
    norteId = res.body.id;

    const patch = await t
      .http()
      .patch(`/api/v1/suppliers/${norteId}`)
      .set(auth(duenioA))
      .send({ telefono: '11-5555-9999', contacto: 'Marta' })
      .expect(200);
    expect(patch.body).toMatchObject({ telefono: '11-5555-9999', contacto: 'Marta' });

    const lista = await t.http().get('/api/v1/suppliers').set(auth(duenioA)).expect(200);
    expect(lista.body.items.map((p: { id: string }) => p.id)).toContain(norteId);
    expect(lista.body.siguienteCursor).toBeNull();
  });

  it('CP-02.1b nombre repetido (sin distinguir mayúsculas) responde 409; en otro comercio se permite', async () => {
    const res = await crearProveedor(duenioA, { nombre: 'distribuidora norte' }).expect(409);
    expect(res.body).toMatchObject({ code: 'CONFLICTO', details: { proveedorId: norteId } });
    await crearProveedor(duenioB, { nombre: 'Distribuidora Norte' }).expect(201);
  });

  it('CP-02.1d datos inválidos nombran cada campo', async () => {
    const res = await crearProveedor(duenioA, {
      nombre: '',
      email: 'no-es-email',
      leadTimeDias: -1,
      confiabilidad: 6,
    }).expect(400);
    expect(res.body.code).toBe('VALIDACION');
    expect(Object.keys(res.body.details).sort()).toEqual([
      'confiabilidad',
      'email',
      'leadTimeDias',
      'nombre',
    ]);
  });

  it('CP-02.2 y CP-02.3 lead time y confiabilidad', async () => {
    const ok = await t
      .http()
      .patch(`/api/v1/suppliers/${norteId}`)
      .set(auth(duenioA))
      .send({ leadTimeDias: 12, confiabilidad: 5 })
      .expect(200);
    expect(ok.body).toMatchObject({ leadTimeDias: 12, confiabilidad: 5 });
    const get = await t.http().get(`/api/v1/suppliers/${norteId}`).set(auth(duenioA)).expect(200);
    expect(get.body.leadTimeDias).toBe(12);
    const malo = await t
      .http()
      .patch(`/api/v1/suppliers/${norteId}`)
      .set(auth(duenioA))
      .send({ confiabilidad: 0 })
      .expect(400);
    expect(malo.body.details).toHaveProperty('confiabilidad');
  });

  it('CP-02.4 y CP-02.5d carga manual: el primer proveedor queda como principal y fija el costo', async () => {
    const res = await cargar(norteId, [{ productoId: filtroId, costoNeto: '2100.00' }]).expect(201);
    expect(res.body.productosActualizados).toBe(1);
    expect(res.body.filas).toHaveLength(1);
    expect(res.body.filas[0]).toMatchObject({
      costoNeto: '2100.00',
      origen: 'MANUAL',
      loteId: null,
      producto: { id: filtroId, codigo: 'FA-220' },
      proveedor: { id: norteId, nombre: 'Distribuidora Norte' },
      usuario: { nombre: duenioA.nombre },
    });
    const p = await producto(filtroId);
    expect(p.proveedorPrincipal).toEqual({ id: norteId, nombre: 'Distribuidora Norte' });
    expect(p.costoReposicion).toBe('2100.00');

    const vigente = await t
      .http()
      .get(`/api/v1/suppliers/${norteId}/prices`)
      .set(auth(duenioA))
      .expect(200);
    expect(
      vigente.body.items.map((f: { producto: { codigo: string }; costoNeto: string }) => [
        f.producto.codigo,
        f.costoNeto,
      ]),
    ).toEqual([['FA-220', '2100.00']]);
  });

  it('CP-02.4d la vista previa clasifica las filas sin registrar nada', async () => {
    const res = await vistaPrevia(
      norteId,
      'Código;Costo\nFA-220;2.340,00\nAM-1L;880\nZZ-999;100\nFA-220;abc\n',
    ).expect(200);
    const porFila = Object.fromEntries(res.body.filas.map((f: { fila: number }) => [f.fila, f]));
    // El FA-220 de la fila 1 queda inválido porque la fila 4 repite el código; la 4 es inválida por costo.
    expect(porFila[1]).toMatchObject({ codigo: 'FA-220', estado: 'INVALIDA' });
    expect(porFila[1].error).toMatch(/repetido/);
    expect(porFila[2]).toMatchObject({
      codigo: 'AM-1L',
      costoNeto: '880.00',
      estado: 'NUEVO',
      productoId: aceiteId,
      nombre: 'Aceite Mineral 1L',
      costoAnterior: null,
    });
    expect(porFila[3]).toMatchObject({
      codigo: 'ZZ-999',
      estado: 'SIN_PRODUCTO',
      productoId: null,
    });
    expect(porFila[4]).toMatchObject({ codigo: 'FA-220', estado: 'INVALIDA', costoNeto: null });
    expect(porFila[4].error).toMatch(/inválido/i);
    expect(res.body.resumen).toEqual({
      total: 4,
      nuevos: 1,
      cambios: 0,
      iguales: 0,
      sinProducto: 1,
      invalidas: 2,
    });

    const sinRepetir = await vistaPrevia(norteId, 'codigo,costo\nFA-220,2340\nBI-09,50\n').expect(
      200,
    );
    expect(sinRepetir.body.filas[0]).toMatchObject({
      estado: 'CAMBIA',
      costoAnterior: '2100.00',
      costoNeto: '2340.00',
    });
    expect(sinRepetir.body.filas[1]).toMatchObject({ estado: 'NUEVO', productoId: bujiaId });
    expect((await producto(filtroId)).costoReposicion).toBe('2100.00');
  });

  it('CP-02.4e y CP-02.5 la confirmación registra el lote y actualiza el costo vigente; repetirla no duplica', async () => {
    const items = [
      { productoId: filtroId, costoNeto: '2340.00' },
      { productoId: aceiteId, costoNeto: '880.00' },
    ];
    const res = await t
      .http()
      .post(`/api/v1/suppliers/${norteId}/price-list`)
      .set(auth(duenioA))
      .send({ items })
      .expect(201);
    expect(res.body).toMatchObject({ insertados: 2, productosActualizados: 2 });
    expect(res.body.loteId).toMatch(/^[0-9a-f-]{36}$/);
    expect((await producto(filtroId)).costoReposicion).toBe('2340.00');
    const aceite = await producto(aceiteId);
    expect(aceite.costoReposicion).toBe('880.00');
    expect(aceite.proveedorPrincipal.id).toBe(norteId);

    const historial = await t
      .http()
      .get(`/api/v1/products/${filtroId}/prices`)
      .set(auth(duenioA))
      .expect(200);
    expect(
      historial.body.items.map((f: { origen: string; costoNeto: string }) => [
        f.origen,
        f.costoNeto,
      ]),
    ).toEqual([
      ['IMPORT', '2340.00'],
      ['MANUAL', '2100.00'],
    ]);
    expect(historial.body.items[0].loteId).toBe(res.body.loteId);

    const repetida = await t
      .http()
      .post(`/api/v1/suppliers/${norteId}/price-list`)
      .set(auth(duenioA))
      .send({ items })
      .expect(201);
    expect(repetida.body).toMatchObject({ insertados: 0, productosActualizados: 0 });
  });

  it('CP-02.4g encabezados y decimales flexibles, también en .xlsx', async () => {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Lista');
    ws.addRow(['Código', 'Costo']);
    ws.addRow(['bi-09', '55,50']);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const res = await t
      .http()
      .post(`/api/v1/suppliers/${norteId}/price-list/preview`)
      .set(auth(duenioA))
      .attach('archivo', buffer, 'lista.xlsx')
      .expect(200);
    expect(res.body.filas[0]).toMatchObject({
      codigo: 'bi-09',
      costoNeto: '55.50',
      estado: 'NUEVO',
      productoId: bujiaId,
    });
  });

  it('CP-02.4f archivo inválido', async () => {
    const pdf = await vistaPrevia(norteId, 'x', 'lista.pdf').expect(400);
    expect(pdf.body.code).toBe('VALIDACION');
    const unaColumna = await vistaPrevia(norteId, 'FA-220\nAM-1L\n').expect(400);
    expect(unaColumna.body.message).toMatch(/columnas/);
    const grande = await vistaPrevia(norteId, 'a;b\n'.repeat(700_000)).expect(400);
    expect(grande.body.message).toMatch(/2 MB/);
    const sinArchivo = await t
      .http()
      .post(`/api/v1/suppliers/${norteId}/price-list/preview`)
      .set(auth(duenioA))
      .expect(400);
    expect(sinArchivo.body.details).toHaveProperty('archivo');
  });

  it('CP-02.5b un proveedor secundario no cambia el costo vigente; CP-02.4b historial completo', async () => {
    surId = (await crearProveedor(duenioA, { nombre: 'Repuestos Sur' }).expect(201)).body.id;
    await cargar(surId, [{ productoId: filtroId, costoNeto: 2000 }]).expect(201);
    const p = await producto(filtroId);
    expect(p.costoReposicion).toBe('2340.00');
    expect(p.proveedorPrincipal.id).toBe(norteId);
    const historial = await t
      .http()
      .get(`/api/v1/products/${filtroId}/prices?limit=2`)
      .set(auth(duenioA))
      .expect(200);
    expect(
      historial.body.items.map((f: { proveedor: { nombre: string } }) => f.proveedor.nombre),
    ).toEqual(['Repuestos Sur', 'Distribuidora Norte']);
    expect(historial.body.siguienteCursor).not.toBeNull();
    const resto = await t
      .http()
      .get(
        `/api/v1/products/${filtroId}/prices?limit=2&cursor=${encodeURIComponent(historial.body.siguienteCursor)}`,
      )
      .set(auth(duenioA))
      .expect(200);
    expect(resto.body.items).toHaveLength(1);
    expect(resto.body.items[0].costoNeto).toBe('2100.00');
  });

  it('CP-02.5c y CP-01.4d cambiar el proveedor principal cambia el costo vigente', async () => {
    const res = await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .send({ proveedorPrincipalId: surId })
      .expect(200);
    expect(res.body).toMatchObject({
      proveedorPrincipal: { id: surId, nombre: 'Repuestos Sur' },
      costoReposicion: '2000.00',
    });
    const lista = await t.http().get('/api/v1/products?q=FA-220').set(auth(duenioA)).expect(200);
    expect(lista.body.items[0].proveedorPrincipal).toEqual({ id: surId, nombre: 'Repuestos Sur' });

    const ajeno = (await crearProveedor(duenioB, { nombre: 'De B' }).expect(201)).body.id;
    await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .send({ proveedorPrincipalId: ajeno })
      .expect(404);

    const sinProveedor = await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .send({ proveedorPrincipalId: null })
      .expect(200);
    expect(sinProveedor.body.proveedorPrincipal).toBeNull();
    expect(sinProveedor.body.costoReposicion).toBe('2000.00');
    await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .send({ proveedorPrincipalId: norteId })
      .expect(200);
    expect((await producto(filtroId)).costoReposicion).toBe('2340.00');
  });

  it('CP-02.5e el costo editado a mano queda como fila MANUAL del proveedor principal', async () => {
    const res = await t
      .http()
      .patch(`/api/v1/products/${filtroId}`)
      .set(auth(duenioA))
      .send({ costoReposicion: '2500' })
      .expect(200);
    expect(res.body.costoReposicion).toBe('2500.00');
    const historial = await t
      .http()
      .get(`/api/v1/products/${filtroId}/prices?limit=1`)
      .set(auth(duenioA))
      .expect(200);
    expect(historial.body.items[0]).toMatchObject({
      origen: 'MANUAL',
      costoNeto: '2500.00',
      proveedor: { id: norteId },
    });

    // Sin proveedor principal, sólo cambia el costo vigente.
    const bujia = await t
      .http()
      .patch(`/api/v1/products/${bujiaId}`)
      .set(auth(duenioA))
      .send({ costoReposicion: '60' })
      .expect(200);
    expect(bujia.body).toMatchObject({ costoReposicion: '60.00', proveedorPrincipal: null });
    const sinHistorial = await t
      .http()
      .get(`/api/v1/products/${bujiaId}/prices`)
      .set(auth(duenioA))
      .expect(200);
    expect(sinHistorial.body.items).toEqual([]);
  });

  it('CP-02.1c baja lógica y reactivación conservan el historial', async () => {
    const baja = await t.http().delete(`/api/v1/suppliers/${surId}`).set(auth(duenioA)).expect(200);
    expect(baja.body.activo).toBe(false);
    const activos = await t.http().get('/api/v1/suppliers').set(auth(duenioA)).expect(200);
    expect(activos.body.items.map((p: { id: string }) => p.id)).not.toContain(surId);
    const bajas = await t
      .http()
      .get('/api/v1/suppliers?activo=false')
      .set(auth(duenioA))
      .expect(200);
    expect(bajas.body.items.map((p: { id: string }) => p.id)).toEqual([surId]);
    const precios = await t
      .http()
      .get(`/api/v1/suppliers/${surId}/prices`)
      .set(auth(duenioA))
      .expect(200);
    expect(precios.body.items).toHaveLength(1);
    const inactivo = await cargar(surId, [{ productoId: filtroId, costoNeto: 1 }]).expect(409);
    expect(inactivo.body.details).toMatchObject({ activo: false });
    const conflicto = await crearProveedor(duenioA, { nombre: 'REPUESTOS SUR' }).expect(409);
    expect(conflicto.body.message).toMatch(/[Rr]eactiv/);
    const re = await t
      .http()
      .patch(`/api/v1/suppliers/${surId}`)
      .set(auth(duenioA))
      .send({ activo: true })
      .expect(200);
    expect(re.body.activo).toBe(true);
  });

  it('CP-02.4c no hay edición ni borrado de filas de costo', async () => {
    const historial = await t
      .http()
      .get(`/api/v1/products/${filtroId}/prices?limit=1`)
      .set(auth(duenioA))
      .expect(200);
    const filaId = historial.body.items[0].id;
    await t
      .http()
      .patch(`/api/v1/suppliers/${norteId}/prices/${filaId}`)
      .set(auth(duenioA))
      .send({ costoNeto: 1 })
      .expect(404);
    await t
      .http()
      .delete(`/api/v1/suppliers/${norteId}/prices/${filaId}`)
      .set(auth(duenioA))
      .expect(404);
  });

  it('CP-02.7 empleado y contador sin acceso a proveedores ni costos', async () => {
    for (const quien of [empleada, contador]) {
      const lista = await t.http().get('/api/v1/suppliers').set(auth(quien)).expect(403);
      expect(lista.body.code).toBe('SIN_PERMISO');
      await t.http().get(`/api/v1/products/${filtroId}/prices`).set(auth(quien)).expect(403);
      await crearProveedor(quien, { nombre: 'Hack' }).expect(403);
      await cargar(norteId, [{ productoId: filtroId, costoNeto: 1 }], quien).expect(403);
    }
  });

  it('CP-02.6 acceso cruzado: 404 y nada cambia en el otro comercio', async () => {
    const deB = (await crearProveedor(duenioB, { nombre: 'Mayorista B' }).expect(201)).body.id;
    const productoB = await crearProducto(duenioB, 'FA-220', 'Filtro de B', '1000');
    await cargar(deB, [{ productoId: productoB, costoNeto: 900 }], duenioB).expect(201);

    await t.http().get(`/api/v1/suppliers/${deB}`).set(auth(duenioA)).expect(404);
    await t
      .http()
      .patch(`/api/v1/suppliers/${deB}`)
      .set(auth(duenioA))
      .send({ nombre: 'Hack' })
      .expect(404);
    await cargar(deB, [{ productoId: filtroId, costoNeto: 1 }]).expect(404);
    await cargar(norteId, [{ productoId: productoB, costoNeto: 1 }]).expect(404);
    await vistaPrevia(deB, 'codigo;costo\nFA-220;1\n').expect(404);
    await t
      .http()
      .post(`/api/v1/suppliers/${deB}/price-list`)
      .set(auth(duenioA))
      .send({ items: [{ productoId: productoB, costoNeto: 1 }] })
      .expect(404);
    await cargar(norteId, [{ productoId: randomUUID(), costoNeto: 1 }]).expect(404);

    const listaA = await t.http().get('/api/v1/suppliers?limit=100').set(auth(duenioA)).expect(200);
    expect(listaA.body.items.map((p: { id: string }) => p.id)).not.toContain(deB);
    const pb = await t.http().get(`/api/v1/products/${productoB}`).set(auth(duenioB)).expect(200);
    expect(pb.body).toMatchObject({ costoReposicion: '900.00', proveedorPrincipal: { id: deB } });
    // La vista previa de A no encuentra el FA-220 de B aunque el código coincida.
    const previa = await vistaPrevia(norteId, 'codigo;costo\nFA-220;1\n').expect(200);
    expect(previa.body.filas[0].productoId).toBe(filtroId);
  });
});
