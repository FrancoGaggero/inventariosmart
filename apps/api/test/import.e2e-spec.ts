import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

describe('excel-import: importación de productos (e2e)', () => {
  let t: AppDePrueba;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const empleada = persona('empleada');
  const contador = persona('contador');
  let comercioA: string;
  let comercioB: string;
  let filtroId: string;

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const preview = (contenido: string | Buffer, nombre = 'productos.csv', quien = duenioA) =>
    t
      .http()
      .post('/api/v1/import/preview')
      .set(auth(quien))
      .attach(
        'archivo',
        typeof contenido === 'string' ? Buffer.from(contenido, 'utf8') : contenido,
        nombre,
      );
  const commit = (filas: unknown[], quien = duenioA) =>
    t.http().post('/api/v1/import/commit').set(auth(quien)).send({ filas });
  const productos = async (quien = duenioA) =>
    (await t.http().get('/api/v1/products?limit=100').set(auth(quien)).expect(200)).body.items as {
      id: string;
      codigo: string;
      nombre: string;
      precioVenta: string;
      costoReposicion: string;
      stockActual: number;
      stockSeguridad: number;
      alicuotaIva: string;
      categoria: string | null;
    }[];

  const PLANILLA =
    'codigo;nombre;precio;costo;stock;stock minimo;categoria;iva\n' +
    'FA-220;Filtro Aire;3990;2400;10;5;Filtros;21\n' +
    'AM-1L;Aceite Mineral 1L;1240;880;8;10;Lubricantes;\n' +
    'BI-09;Bujía;950;500;0;2;;\n';

  beforeAll(async () => {
    t = await crearAppDePrueba();
    comercioA = (await t.http().get('/api/v1/me').set(auth(duenioA)).expect(200)).body.comercio.id;
    comercioB = (await t.http().get('/api/v1/me').set(auth(duenioB)).expect(200)).body.comercio.id;
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
    filtroId = (
      await t
        .http()
        .post('/api/v1/products')
        .set(auth(duenioA))
        .send({
          codigo: 'FA-220',
          nombre: 'Filtro viejo',
          precioVenta: 3000,
          costoReposicion: 2000,
          stockInicial: 4,
        })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await t.limpiar();
  });

  it('CP-05.1 vista previa con productos nuevos y existentes, sin tocar el catálogo', async () => {
    const res = await preview(PLANILLA).expect(200);
    const porCodigo = Object.fromEntries(
      res.body.filas.map((f: { codigo: string }) => [f.codigo, f]),
    );
    expect(porCodigo['FA-220']).toMatchObject({
      estado: 'ACTUALIZA',
      productoId: filtroId,
      stockActual: 4,
    });
    expect(porCodigo['FA-220'].datos).toMatchObject({
      precioVenta: '3990.00',
      costoReposicion: '2400.00',
      alicuotaIva: 21,
      stockSeguridad: 5,
      categoria: 'Filtros',
    });
    expect(porCodigo['AM-1L']).toMatchObject({ estado: 'NUEVO', productoId: null });
    expect(porCodigo['AM-1L'].datos).toMatchObject({ alicuotaIva: 10.5, stockInicial: 8 });
    expect(porCodigo['BI-09']).toMatchObject({ estado: 'NUEVO' });
    expect(porCodigo['BI-09'].datos).toMatchObject({
      stockInicial: 0,
      categoria: null,
      alicuotaIva: 10.5,
    });
    expect(res.body.resumen).toEqual({
      total: 3,
      nuevos: 2,
      actualizan: 1,
      invalidas: 0,
      productosActualesActivos: 1,
      productosResultantes: 3,
      limitePlan: null,
      superaLimite: false,
    });
    expect(await productos()).toHaveLength(1);
  });

  it('CP-05.2 errores por fila detectados antes de confirmar', async () => {
    const baja = await t
      .http()
      .post('/api/v1/products')
      .set(auth(duenioA))
      .send({ codigo: 'BAJA', nombre: 'Dado de baja', precioVenta: 1, costoReposicion: 1 })
      .expect(201);
    await t.http().delete(`/api/v1/products/${baja.body.id}`).set(auth(duenioA)).expect(200);

    const res = await preview(
      'codigo;nombre;precio;stock\n' +
        'SIN-NOMBRE;;100;1\n' +
        'NEG;Precio negativo;-5;1\n' +
        'DIEZ;Stock en letras;100;diez\n' +
        'baja;Reactivar;100;1\n' +
        'REP;Repetido primero;100;1\n' +
        'REP;Repetido segundo;200;1\n',
    ).expect(200);
    const filas = res.body.filas as { fila: number; estado: string; error: string | null }[];
    expect(filas.map((f) => f.estado)).toEqual([
      'INVALIDA',
      'INVALIDA',
      'INVALIDA',
      'INVALIDA',
      'INVALIDA',
      'NUEVO',
    ]);
    expect(filas[0]!.error).toMatch(/nombre/);
    expect(filas[1]!.error).toMatch(/precioVenta/);
    expect(filas[2]!.error).toMatch(/stockInicial/);
    expect(filas[3]!.error).toMatch(/reactivalo/);
    expect(filas[4]!.error).toMatch(/repetido: se usa la fila 6/);
    expect(res.body.resumen).toMatchObject({ total: 6, nuevos: 1, invalidas: 5 });
  });

  it('CP-05.2b encabezados y formatos flexibles en .xlsx', async () => {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Productos');
    ws.addRow([
      'Código',
      'Descripción',
      'Precio de venta',
      'Costo neto',
      'Stock inicial',
      'Stock mínimo',
      'Rubro',
      'IVA %',
    ]);
    ws.addRow(['XL-1', 'Desde Excel', '3.990,00', 2400.5, 12, 3, 'Filtros', 21]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const res = await preview(buffer, 'productos.xlsx').expect(200);
    expect(res.body.filas[0]).toMatchObject({ estado: 'NUEVO', codigo: 'XL-1' });
    expect(res.body.filas[0].datos).toMatchObject({
      precioVenta: '3990.00',
      costoReposicion: '2400.50',
      stockInicial: 12,
      stockSeguridad: 3,
      categoria: 'Filtros',
      alicuotaIva: 21,
    });
  });

  it('CP-05.2c archivo inválido', async () => {
    await preview('x', 'productos.pdf').expect(400);
    const sinColumnas = await preview('codigo;stock\nA;1\n').expect(400);
    expect(sinColumnas.body.message).toMatch(/nombre/);
    const lineas = [
      'codigo;nombre;precio',
      ...Array.from({ length: 5001 }, (_, i) => `P-${i};Producto;10`),
    ];
    const grande = await preview(lineas.join('\n')).expect(400);
    expect(grande.body.message).toMatch(/5000/);
    const sinArchivo = await t.http().post('/api/v1/import/preview').set(auth(duenioA)).expect(400);
    expect(sinArchivo.body.details).toHaveProperty('archivo');
  });

  it('CP-05.4 la confirmación crea, actualiza y registra el stock inicial', async () => {
    const previa = await preview(PLANILLA).expect(200);
    const filas = previa.body.filas.filter((f: { estado: string }) => f.estado !== 'INVALIDA');
    const res = await commit(filas).expect(201);
    expect(res.body).toEqual({ creados: 2, actualizados: 1, omitidos: 0, detalles: [] });

    const lista = await productos();
    const aceite = lista.find((p) => p.codigo === 'AM-1L')!;
    expect(aceite).toMatchObject({
      nombre: 'Aceite Mineral 1L',
      stockActual: 8,
      stockSeguridad: 10,
      alicuotaIva: '10.5',
      categoria: 'Lubricantes',
    });
    const movs = await t
      .http()
      .get(`/api/v1/movements?productoId=${aceite.id}`)
      .set(auth(duenioA))
      .expect(200);
    expect(movs.body.items).toHaveLength(1);
    expect(movs.body.items[0]).toMatchObject({
      tipo: 'INGRESO',
      cantidad: 8,
      motivo: 'STOCK_INICIAL',
      stockResultante: 8,
    });

    const bujia = lista.find((p) => p.codigo === 'BI-09')!;
    expect(bujia.stockActual).toBe(0);
    const sinMovs = await t
      .http()
      .get(`/api/v1/movements?productoId=${bujia.id}`)
      .set(auth(duenioA))
      .expect(200);
    expect(sinMovs.body.items).toEqual([]);

    const filtro = lista.find((p) => p.id === filtroId)!;
    expect(filtro).toMatchObject({
      nombre: 'Filtro Aire',
      precioVenta: '3990.00',
      costoReposicion: '2400.00',
      stockSeguridad: 5,
      stockActual: 4,
      categoria: 'Filtros',
      alicuotaIva: '21',
    });
  });

  it('CP-05.4b reimportar no duplica ni genera movimientos', async () => {
    const previa = await preview(PLANILLA).expect(200);
    expect(previa.body.resumen).toMatchObject({ nuevos: 0, actualizan: 3 });
    const res = await commit(previa.body.filas).expect(201);
    expect(res.body).toMatchObject({ creados: 0, actualizados: 3, omitidos: 0 });
    const aceite = (await productos()).find((p) => p.codigo === 'AM-1L')!;
    const movs = await t
      .http()
      .get(`/api/v1/movements?productoId=${aceite.id}`)
      .set(auth(duenioA))
      .expect(200);
    expect(movs.body.items).toHaveLength(1);
    expect(await productos()).toHaveLength(3);
  });

  it('CP-05.4d una fila que dejó de ser válida se omite con detalle', async () => {
    const previa = await preview(
      'codigo;nombre;precio\nNUEVO-1;Uno;100\nAM-1L;Aceite;100\n',
    ).expect(200);
    const aceite = (await productos()).find((p) => p.codigo === 'AM-1L')!;
    await t.http().delete(`/api/v1/products/${aceite.id}`).set(auth(duenioA)).expect(200);
    const res = await commit(previa.body.filas).expect(201);
    expect(res.body).toMatchObject({ creados: 1, actualizados: 0, omitidos: 1 });
    expect(res.body.detalles[0]).toMatchObject({ codigo: 'AM-1L' });
    expect(res.body.detalles[0].motivo).toMatch(/reactivalo/);
    await t
      .http()
      .patch(`/api/v1/products/${aceite.id}`)
      .set(auth(duenioA))
      .send({ activo: true })
      .expect(200);
  });

  it('CP-05.3 y CP-05.4c límite del plan FREE: la vista previa avisa y la confirmación rechaza', async () => {
    await t.prisma.comoSistema((tx) =>
      tx.producto.createMany({
        data: Array.from({ length: 45 }, (_, i) => ({
          comercioId: comercioB,
          codigo: `B-${i}`,
          codigoNormalizado: `B-${i}`,
          nombre: `Producto B ${i}`,
          precioVenta: 100,
          alicuotaIva: 21,
          costoReposicion: 60,
        })),
      }),
    );
    const planilla =
      'codigo;nombre;precio\n' +
      Array.from({ length: 10 }, (_, i) => `N-${i};Nuevo ${i};100`).join('\n') +
      '\n';
    const previa = await preview(planilla, 'p.csv', duenioB).expect(200);
    expect(previa.body.resumen).toMatchObject({
      nuevos: 10,
      productosActualesActivos: 45,
      productosResultantes: 55,
      limitePlan: 50,
      superaLimite: true,
    });
    const bloqueado = await commit(previa.body.filas, duenioB).expect(402);
    expect(bloqueado.body).toMatchObject({
      code: 'PLAN_REQUERIDO',
      details: { planMinimo: 'PRO' },
    });
    expect(await productos(duenioB)).toHaveLength(45);

    await t.prisma.comoSistema((tx) =>
      tx.comercio.update({ where: { id: comercioB }, data: { plan: 'PRO' } }),
    );
    const ok = await commit(previa.body.filas, duenioB).expect(201);
    expect(ok.body).toMatchObject({ creados: 10 });
    expect(await productos(duenioB)).toHaveLength(55);
  });

  it('CP-05.6 roles y aislamiento', async () => {
    await preview(PLANILLA, 'p.csv', empleada).expect(403);
    await preview(PLANILLA, 'p.csv', contador).expect(403);
    await commit([], empleada).expect(403);

    // B también tiene FA-220: la vista previa de A lo clasifica contra el de A.
    await t
      .http()
      .post('/api/v1/products')
      .set(auth(duenioB))
      .send({ codigo: 'FA-220', nombre: 'Filtro de B', precioVenta: 500, costoReposicion: 100 })
      .expect(201);
    const previa = await preview(
      'codigo;nombre;precio\nFA-220;Filtro de A actualizado;4000\n',
    ).expect(200);
    expect(previa.body.filas[0]).toMatchObject({ estado: 'ACTUALIZA', productoId: filtroId });
    await commit(previa.body.filas).expect(201);
    const deB = (await productos(duenioB)).find((p) => p.codigo === 'FA-220')!;
    expect(deB.nombre).toBe('Filtro de B');
    expect(deB.precioVenta).toBe('500.00');
  });
});
