import { randomUUID } from 'node:crypto';
import type { RemarcacionApply } from '@inventariosmart/shared';
import { TenantContext } from '../src/auth/tenant-context';
import { RepricingService } from '../src/repricing/repricing.service';
import { type AppDePrueba, conCargaExclusiva, crearAppDePrueba, persona } from './helpers';

interface Item {
  producto: { id: string; codigo: string };
  precioActual: string;
  precioNuevo: string | null;
  variacion: string | null;
  margenBrutoPctActual: string | null;
  margenBrutoPctNuevo: string | null;
  resultado: string;
  estado: string | null;
}

describe('bulk-repricing: remarcación asistida (e2e)', () => {
  let t: AppDePrueba;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const duenioC = persona('duenio-c');
  const duenioF = persona('duenio-free');
  const empleada = persona('empleada');
  const contador = persona('contador');
  const comercio: Record<string, string> = {};
  const usuario: Record<string, string> = {};
  const prod: Record<string, string> = {};
  let loteId: string;

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const vistaPrevia = (body: object, quien = duenioA) =>
    t.http().post('/api/v1/repricing/preview').set(auth(quien)).send(body);
  const aplicar = (body: object, quien = duenioA) =>
    t.http().post('/api/v1/repricing/apply').set(auth(quien)).send(body);
  const lotes = (query = '', quien = duenioA) =>
    t.http().get(`/api/v1/repricing/batches${query}`).set(auth(quien));
  const lote = (id: string, quien = duenioA) =>
    t.http().get(`/api/v1/repricing/batches/${id}`).set(auth(quien));
  const deshacer = (id: string, quien = duenioA) =>
    t.http().post(`/api/v1/repricing/batches/${id}/revert`).set(auth(quien));
  const precioDe = async (id: string, quien = duenioA): Promise<string> =>
    (await t.http().get(`/api/v1/products/${id}`).set(auth(quien)).expect(200)).body.precioVenta;
  const historialDe = async (id: string, quien = duenioA) =>
    (await t.http().get(`/api/v1/products/${id}/price-history`).set(auth(quien)).expect(200)).body
      .items as { precioVenta: string; origen: string; usuario: { id: string } | null }[];
  const editarPrecio = (id: string, precioVenta: number, quien = duenioA) =>
    t.http().patch(`/api/v1/products/${id}`).set(auth(quien)).send({ precioVenta }).expect(200);
  const item = (items: Item[], codigo: string) =>
    items.find((i) => i.producto.codigo === codigo) as Item;
  const paraAplicar = (items: Item[]) =>
    items
      .filter((i) => i.resultado === 'SUBE' || i.resultado === 'BAJA')
      .map((i) => ({
        productoId: i.producto.id,
        precioActual: i.precioActual,
        precioNuevo: i.precioNuevo,
      }));

  const crearProducto = async (
    datos: { codigo: string; precioVenta: number; costoReposicion: number },
    quien = duenioA,
  ): Promise<string> =>
    (
      await t
        .http()
        .post('/api/v1/products')
        .set(auth(quien))
        .send({ nombre: `Producto ${datos.codigo}`, alicuotaIva: 21, stockInicial: 0, ...datos })
        .expect(201)
    ).body.id;

  beforeAll(async () => {
    t = await crearAppDePrueba();
    for (const [clave, p] of [
      ['a', duenioA],
      ['b', duenioB],
      ['c', duenioC],
      ['f', duenioF],
    ] as const) {
      const me = (await t.http().get('/api/v1/me').set(auth(p)).expect(200)).body;
      comercio[clave] = me.comercio.id;
      usuario[clave] = me.usuario.id;
    }
    await t.prisma.comoSistema((tx) =>
      tx.comercio.updateMany({
        where: { id: { in: [comercio['a']!, comercio['b']!, comercio['c']!] } },
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
    // A, B y C como en CP-17.1b; D sin costo cargado; X dado de baja; AJENO es de otro comercio.
    prod['A'] = await crearProducto({ codigo: 'A', precioVenta: 1100, costoReposicion: 720 });
    prod['B'] = await crearProducto({ codigo: 'B', precioVenta: 2600, costoReposicion: 1500 });
    prod['C'] = await crearProducto({ codigo: 'C', precioVenta: 1210, costoReposicion: 700 });
    prod['D'] = await crearProducto({ codigo: 'D', precioVenta: 500, costoReposicion: 0 });
    prod['X'] = await crearProducto({ codigo: 'X', precioVenta: 900, costoReposicion: 400 });
    await t.http().delete(`/api/v1/products/${prod['X']}`).set(auth(duenioA)).expect(200);
    prod['AJENO'] = await crearProducto(
      { codigo: 'AJENO', precioVenta: 1000, costoReposicion: 600 },
      duenioB,
    );
  }, 300_000);

  afterAll(async () => {
    await t.limpiar();
  }, 120_000);

  const ABC = () => [prod['A']!, prod['B']!, prod['C']!];

  describe('vista previa', () => {
    it('CP-17.1b porcentaje fijo con redondeo a la decena, sin modificar nada', async () => {
      const r = await vistaPrevia({
        criterio: 'PORCENTAJE',
        porcentaje: 15,
        redondeo: 'DECENA',
        productoIds: ABC(),
      }).expect(200);
      expect(r.body.criterio).toBe('PORCENTAJE');
      expect(r.body.parametros).toEqual({
        porcentaje: 15,
        redondeo: 'DECENA',
        permitirBajas: false,
      });
      expect(r.body.motivo).toBeNull();
      expect(r.body.resumen).toEqual({ suben: 3, bajan: 0, sinCambio: 0, sinDatos: 0 });
      expect(item(r.body.items, 'A')).toMatchObject({
        precioActual: '1100.00',
        precioNuevo: '1270.00',
        variacion: '15.45',
        margenBrutoPctActual: '20.80',
        resultado: 'SUBE',
        estado: null,
      });
      expect(item(r.body.items, 'B')).toMatchObject({
        precioActual: '2600.00',
        precioNuevo: '2990.00',
      });
      expect(item(r.body.items, 'C')).toMatchObject({
        precioActual: '1210.00',
        precioNuevo: '1400.00',
      });
      expect(await precioDe(prod['A']!)).toBe('1100.00');
      expect((await lotes().expect(200)).body.items).toHaveLength(0);
    }, 120_000);

    it('CP-17.1c margen objetivo; sin costo cargado no se puede calcular', async () => {
      const r = await vistaPrevia({
        criterio: 'MARGEN_OBJETIVO',
        margen: 40,
        redondeo: 'CENTENA',
      }).expect(200);
      expect(item(r.body.items, 'A')).toMatchObject({
        precioNuevo: '1500.00',
        margenBrutoPctNuevo: '41.92',
        resultado: 'SUBE',
      });
      expect(item(r.body.items, 'D')).toMatchObject({
        precioActual: '500.00',
        precioNuevo: null,
        variacion: null,
        resultado: 'SIN_DATOS',
      });
      expect(r.body.resumen.sinDatos).toBe(1);
    }, 120_000);

    it('sin elegir productos toma los activos del comercio y ninguno ajeno', async () => {
      const r = await vistaPrevia({ criterio: 'PORCENTAJE', porcentaje: 10 }).expect(200);
      const codigos = r.body.items.map((i: Item) => i.producto.codigo);
      expect(codigos).toEqual(['A', 'B', 'C', 'D']);
      const conAjeno = await vistaPrevia({
        criterio: 'PORCENTAJE',
        porcentaje: 10,
        productoIds: [prod['A'], prod['X'], prod['AJENO']],
      }).expect(200);
      expect(conAjeno.body.items.map((i: Item) => i.producto.codigo)).toEqual(['A']);
    }, 120_000);

    it('CP-17.2 no baja precios sin pedirlo', async () => {
      // Margen objetivo 10 %: a B (costo 1500) le da 2016,67, menos que sus 2600.
      const pedido = { criterio: 'MARGEN_OBJETIVO', margen: 10, productoIds: [prod['B']] };
      const sin = await vistaPrevia(pedido).expect(200);
      expect(item(sin.body.items, 'B')).toMatchObject({
        precioNuevo: '2600.00',
        variacion: '0.00',
        resultado: 'SIN_CAMBIO',
      });
      const con = await vistaPrevia({ ...pedido, permitirBajas: true }).expect(200);
      expect(item(con.body.items, 'B')).toMatchObject({
        precioNuevo: '2016.67',
        variacion: '-22.44',
        resultado: 'BAJA',
      });
    }, 120_000);

    it('CP-17.1e parámetros inválidos', async () => {
      const campo = async (body: object) =>
        Object.keys((await vistaPrevia(body).expect(400)).body.details);
      expect(await campo({ criterio: 'PORCENTAJE' })).toEqual(['porcentaje']);
      expect(await campo({ criterio: 'PORCENTAJE', porcentaje: 501 })).toEqual(['porcentaje']);
      expect(await campo({ criterio: 'MARGEN_OBJETIVO', margen: 100 })).toEqual(['margen']);
      expect(await campo({ criterio: 'DESCUENTO' })).toEqual(['criterio']);
      expect(await campo({ criterio: 'PORCENTAJE', porcentaje: 5, redondeo: 'MIL' })).toEqual([
        'redondeo',
      ]);
      const r = await vistaPrevia({}).expect(400);
      expect(r.body.code).toBe('VALIDACION');
    }, 120_000);
  });

  describe('aplicación', () => {
    const PARAMETROS = { porcentaje: 15, redondeo: 'DECENA', permitirBajas: false };
    const previaDe15 = async () =>
      (
        await vistaPrevia({
          criterio: 'PORCENTAJE',
          ...PARAMETROS,
          productoIds: ABC(),
        }).expect(200)
      ).body.items as Item[];

    it('CP-17.3c datos inválidos: nada cambia', async () => {
      const base = { criterio: 'PORCENTAJE', parametros: PARAMETROS };
      const a = { productoId: prod['A'], precioActual: '1100.00', precioNuevo: '1270.00' };
      const detalles = async (items: object[]) =>
        Object.keys((await aplicar({ ...base, items }).expect(400)).body.details);
      expect(await detalles([])).toEqual(['items']);
      expect(await detalles([a, a])).toEqual(['items']);
      expect(await detalles([{ ...a, precioNuevo: '0' }])).toEqual(['items.0.precioNuevo']);
      expect(await detalles([{ ...a, precioNuevo: '1100' }])).toEqual(['items.0.precioNuevo']);
      const baja = await aplicar({
        ...base,
        items: [a, { productoId: prod['X'], precioActual: '900.00', precioNuevo: '1000.00' }],
      }).expect(400);
      expect(baja.body.details.items).toMatch(/X/);
      const ajeno = await aplicar({
        ...base,
        items: [a, { productoId: prod['AJENO'], precioActual: '1000.00', precioNuevo: '1150.00' }],
      }).expect(404);
      expect(ajeno.body.code).toBe('NO_ENCONTRADO');
      expect(await precioDe(prod['A']!)).toBe('1100.00');
      expect(await precioDe(prod['AJENO']!, duenioB)).toBe('1000.00');
      expect((await lotes().expect(200)).body.items).toHaveLength(0);
    }, 120_000);

    it('CP-17.3b si un precio cambió desde la vista previa no se aplica nada', async () => {
      const items = await previaDe15();
      await editarPrecio(prod['B']!, 2700);
      const r = await aplicar({
        criterio: 'PORCENTAJE',
        parametros: PARAMETROS,
        items: paraAplicar(items),
      }).expect(409);
      expect(r.body.code).toBe('CONFLICTO');
      expect(r.body.details.productos).toEqual([
        { productoId: prod['B'], codigo: 'B', nombre: 'Producto B', precioActual: '2700.00' },
      ]);
      expect(await precioDe(prod['A']!)).toBe('1100.00');
      expect(await precioDe(prod['C']!)).toBe('1210.00');
      expect((await lotes().expect(200)).body.items).toHaveLength(0);
      await editarPrecio(prod['B']!, 2600);
    }, 120_000);

    it('CP-17.3 aplicar la vista previa actualiza precios, historial y lote', async () => {
      const items = await previaDe15();
      const r = await aplicar({
        criterio: 'PORCENTAJE',
        parametros: PARAMETROS,
        items: paraAplicar(items),
      }).expect(201);
      loteId = r.body.id;
      expect(r.body).toMatchObject({
        criterio: 'PORCENTAJE',
        parametros: PARAMETROS,
        cantidad: 3,
        usuario: { id: usuario['a'], nombre: duenioA.nombre },
        revertidoEn: null,
        revertidos: null,
        omitidos: null,
      });
      expect(r.body.items).toHaveLength(3);
      expect(await precioDe(prod['A']!)).toBe('1270.00');
      expect(await precioDe(prod['B']!)).toBe('2990.00');
      expect(await precioDe(prod['C']!)).toBe('1400.00');
      expect(await precioDe(prod['D']!)).toBe('500.00');
      const historial = await historialDe(prod['A']!);
      expect(historial[0]).toMatchObject({
        precioVenta: '1270.00',
        origen: 'REMARCACION',
        usuario: { id: usuario['a'] },
      });
      expect(historial).toHaveLength(2);
    }, 120_000);

    it('el dueño puede ajustar un precio a mano antes de aplicar', async () => {
      const r = await aplicar({
        criterio: 'MARGEN_OBJETIVO',
        parametros: { margen: 40, redondeo: 'CENTENA' },
        items: [{ productoId: prod['D'], precioActual: '500.00', precioNuevo: '649.90' }],
      }).expect(201);
      expect(r.body.items[0]).toMatchObject({
        precioAnterior: '500.00',
        precioNuevo: '649.90',
        revertido: false,
      });
      expect(await precioDe(prod['D']!)).toBe('649.90');
    }, 120_000);

    it('dos aplicaciones simultáneas sobre los mismos productos dejan un solo lote', async () => {
      const id = await crearProducto({ codigo: 'SIM', precioVenta: 1000, costoReposicion: 500 });
      const servicio = t.app.get(RepricingService);
      const pedido: RemarcacionApply = {
        criterio: 'PORCENTAJE',
        parametros: { porcentaje: 10 },
        items: [{ productoId: id, precioActual: '1000.00', precioNuevo: '1100.00' }],
      };
      const contexto = {
        comercioId: comercio['a']!,
        usuarioId: usuario['a']!,
        rol: 'DUENIO' as const,
        plan: 'PRO' as const,
      };
      const resultados = await Promise.allSettled([
        TenantContext.correr(contexto, () => servicio.aplicar(pedido)),
        TenantContext.correr(contexto, () => servicio.aplicar(pedido)),
      ]);
      expect(resultados.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
      const rechazo = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(rechazo.reason.getStatus()).toBe(409);
      expect(await precioDe(id)).toBe('1100.00');
      expect(await historialDe(id)).toHaveLength(2);
      await t.http().delete(`/api/v1/products/${id}`).set(auth(duenioA)).expect(200);
    }, 120_000);
  });

  describe('lotes y deshacer', () => {
    it('CP-17.4 listado y detalle', async () => {
      const lista = (await lotes().expect(200)).body;
      expect(lista.siguienteCursor).toBeNull();
      expect(lista.items.map((l: { cantidad: number }) => l.cantidad)).toEqual([1, 1, 3]);
      expect(lista.items[2]).toMatchObject({
        id: loteId,
        criterio: 'PORCENTAJE',
        usuario: { nombre: duenioA.nombre },
      });
      const detalle = (await lote(loteId).expect(200)).body;
      expect(detalle.items.map((i: { producto: { codigo: string } }) => i.producto.codigo)).toEqual(
        ['A', 'B', 'C'],
      );
      expect(detalle.items[0]).toMatchObject({
        precioAnterior: '1100.00',
        precioNuevo: '1270.00',
        revertido: false,
      });
      const pagina = (await lotes('?limit=2').expect(200)).body;
      expect(pagina.items).toHaveLength(2);
      const resto = (await lotes(`?limit=2&cursor=${pagina.siguienteCursor}`).expect(200)).body;
      expect(resto.items.map((l: { id: string }) => l.id)).toEqual([loteId]);
    }, 120_000);

    it('CP-17.4b deshacer respeta los precios que cambiaron después', async () => {
      await editarPrecio(prod['C']!, 1450);
      const r = await deshacer(loteId).expect(200);
      expect(r.body).toMatchObject({
        id: loteId,
        revertidos: 2,
        omitidos: 1,
        revertidoPor: { id: usuario['a'] },
      });
      expect(r.body.revertidoEn).toBeTruthy();
      expect(r.body.productosOmitidos).toEqual([
        {
          producto: { id: prod['C'], codigo: 'C', nombre: 'Producto C' },
          precioActual: '1450.00',
          motivo: 'El precio cambió después de la remarcación.',
        },
      ]);
      expect(r.body.items.map((i: { revertido: boolean }) => i.revertido)).toEqual([
        true,
        true,
        false,
      ]);
      expect(await precioDe(prod['A']!)).toBe('1100.00');
      expect(await precioDe(prod['B']!)).toBe('2600.00');
      expect(await precioDe(prod['C']!)).toBe('1450.00');
      const historial = await historialDe(prod['A']!);
      expect(historial.map((h) => [h.precioVenta, h.origen])).toEqual([
        ['1100.00', 'REMARCACION'],
        ['1270.00', 'REMARCACION'],
        ['1100.00', 'ALTA'],
      ]);
    }, 120_000);

    it('CP-17.4c no se deshace dos veces', async () => {
      const r = await deshacer(loteId).expect(409);
      expect(r.body.code).toBe('CONFLICTO');
      expect(await precioDe(prod['A']!)).toBe('1100.00');
    }, 120_000);

    it('CP-15.2e la remarcación y su reversión quedan en el historial de precios', async () => {
      const id = await crearProducto({
        codigo: 'FA-220',
        precioVenta: 1200,
        costoReposicion: 700,
      });
      const previa = await vistaPrevia({
        criterio: 'PORCENTAJE',
        porcentaje: 15,
        productoIds: [id],
      }).expect(200);
      expect(previa.body.items[0].precioNuevo).toBe('1380.00');
      const aplicado = await aplicar({
        criterio: 'PORCENTAJE',
        parametros: { porcentaje: 15 },
        items: paraAplicar(previa.body.items),
      }).expect(201);
      await deshacer(aplicado.body.id).expect(200);
      const historial = await historialDe(id);
      expect(historial.map((h) => [h.precioVenta, h.origen, h.usuario?.id])).toEqual([
        ['1200.00', 'REMARCACION', usuario['a']],
        ['1380.00', 'REMARCACION', usuario['a']],
        ['1200.00', 'ALTA', usuario['a']],
      ]);
      await t.http().delete(`/api/v1/products/${id}`).set(auth(duenioA)).expect(200);
    }, 120_000);

    it('deshacer omite un producto dado de baja', async () => {
      const id = await crearProducto({ codigo: 'BAJA', precioVenta: 100, costoReposicion: 50 });
      const aplicado = await aplicar({
        criterio: 'PORCENTAJE',
        parametros: { porcentaje: 10 },
        items: [{ productoId: id, precioActual: '100.00', precioNuevo: '110.00' }],
      }).expect(201);
      await t.http().delete(`/api/v1/products/${id}`).set(auth(duenioA)).expect(200);
      const r = await deshacer(aplicado.body.id).expect(200);
      expect(r.body).toMatchObject({ revertidos: 0, omitidos: 1 });
      expect(r.body.productosOmitidos[0].motivo).toBe('Está dado de baja.');
    }, 120_000);
  });

  describe('plan, permisos y aislamiento', () => {
    const pedido = { criterio: 'PORCENTAJE', porcentaje: 10 };

    it('CP-17.5 plan FREE', async () => {
      expect((await vistaPrevia(pedido, duenioF).expect(402)).body.code).toBe('PLAN_REQUERIDO');
      expect((await lotes('', duenioF).expect(402)).body.code).toBe('PLAN_REQUERIDO');
    }, 120_000);

    it('CP-17.5b el contador mira y no opera; la empleada no accede', async () => {
      const previa = await vistaPrevia({ ...pedido, productoIds: [prod['A']] }, contador).expect(
        200,
      );
      await lotes('', contador).expect(200);
      await lote(loteId, contador).expect(200);
      const aplica = await aplicar(
        { criterio: 'PORCENTAJE', items: paraAplicar(previa.body.items) },
        contador,
      ).expect(403);
      expect(aplica.body.code).toBe('SIN_PERMISO');
      expect((await deshacer(loteId, contador).expect(403)).body.code).toBe('SIN_PERMISO');
      expect((await vistaPrevia(pedido, empleada).expect(403)).body.code).toBe('SIN_PERMISO');
      expect((await lotes('', empleada).expect(403)).body.code).toBe('SIN_PERMISO');
      expect(await precioDe(prod['A']!)).toBe('1100.00');
    }, 120_000);

    it('CP-17.5c un comercio sólo ve y opera sus lotes', async () => {
      const deB = await aplicar(
        {
          criterio: 'PORCENTAJE',
          parametros: { porcentaje: 10 },
          items: [{ productoId: prod['AJENO'], precioActual: '1000.00', precioNuevo: '1100.00' }],
        },
        duenioB,
      ).expect(201);
      expect((await lotes('', duenioB).expect(200)).body.items).toHaveLength(1);
      const deA = (await lotes().expect(200)).body.items.map((l: { id: string }) => l.id);
      expect(deA).not.toContain(deB.body.id);
      expect((await lote(deB.body.id).expect(404)).body.code).toBe('NO_ENCONTRADO');
      expect((await deshacer(deB.body.id).expect(404)).body.code).toBe('NO_ENCONTRADO');
      expect(await precioDe(prod['AJENO']!, duenioB)).toBe('1100.00');
      const previa = await vistaPrevia(pedido, duenioB).expect(200);
      expect(previa.body.items.map((i: Item) => i.producto.codigo)).toEqual(['AJENO']);
    }, 120_000);
  });

  it('carga sintética: remarcar 5.000 productos en menos de 3 s', async () => {
    await conCargaExclusiva(async () => {
      const productos = Array.from({ length: 5000 }, (_, i) => ({
        id: randomUUID(),
        comercioId: comercio['c']!,
        codigo: `REM-${i}`,
        codigoNormalizado: `REM-${i}`,
        nombre: `Producto de carga ${String(i).padStart(4, '0')}`,
        precioVenta: 1000 + i,
        alicuotaIva: 21,
        costoReposicion: 600,
        stockActual: 10,
        stockSeguridad: 1,
      }));
      await t.prisma.comoSistema((tx) => tx.producto.createMany({ data: productos }));

      const previa = await vistaPrevia(
        { criterio: 'PORCENTAJE', porcentaje: 12, redondeo: 'DECENA' },
        duenioC,
      ).expect(200);
      expect(previa.body.resumen.suben).toBe(5000);
      const items = paraAplicar(previa.body.items);

      const inicio = Date.now();
      const r = await aplicar(
        { criterio: 'PORCENTAJE', parametros: { porcentaje: 12, redondeo: 'DECENA' }, items },
        duenioC,
      ).expect(201);
      const ms = Date.now() - inicio;
      expect(r.body.cantidad).toBe(5000);
      expect(await precioDe(productos[0]!.id, duenioC)).toBe('1120.00');
      expect(ms).toBeLessThan(3000);

      const vuelta = await deshacer(r.body.id, duenioC).expect(200);
      expect(vuelta.body).toMatchObject({ revertidos: 5000, omitidos: 0 });
    });
  }, 600_000);
});
