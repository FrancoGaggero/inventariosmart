import { randomUUID } from 'node:crypto';
import { FUENTES_INDICADORES, FuenteFalsa, type LecturaIndicador } from '../src/indicators/fuentes';
import {
  type AppDePrueba,
  comoPropietaria,
  conCargaExclusiva,
  crearAppDePrueba,
  persona,
} from './helpers';

const HORA = 60 * 60 * 1000;

/** IPC general de cada mes: 10.000 en enero de 2026, 12.000 en junio (+20 %) y el dato real de agosto. */
const IPC: Record<string, number> = {
  '2025-09': 8400,
  '2025-10': 8800,
  '2025-11': 9200,
  '2025-12': 9600,
  '2026-01': 10000,
  '2026-02': 10400,
  '2026-03': 10800,
  '2026-04': 11200,
  '2026-05': 11600,
  '2026-06': 12000,
  '2026-07': 12100,
  '2026-08': 12276.766,
};

const LECTURAS: LecturaIndicador[] = [
  ...Object.entries(IPC).flatMap(([mes, valor]): LecturaIndicador[] => [
    { serie: 'IPC_GENERAL', fecha: `${mes}-01`, valor },
    // Bienes sube 19 % entre enero y junio.
    { serie: 'IPC_BIENES', fecha: `${mes}-01`, valor: mes === '2026-06' ? 11900 : valor },
  ]),
  { serie: 'INFLACION_MENSUAL', fecha: '2026-07-31', valor: 2.1 },
  { serie: 'INFLACION_MENSUAL', fecha: '2026-08-31', valor: 1.7 },
  { serie: 'INFLACION_INTERANUAL', fecha: '2026-08-31', valor: 33.5 },
  { serie: 'USD_MINORISTA', fecha: '2026-09-24', valor: 1538.39 },
  { serie: 'USD_MINORISTA', fecha: '2026-09-25', valor: 1545.12 },
];

describe('inflation-insights: precios frente a la inflación (e2e)', () => {
  let t: AppDePrueba;
  let fuente: FuenteFalsa;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const duenioC = persona('duenio-c');
  const duenioF = persona('duenio-free');
  const empleada = persona('empleada');
  const contador = persona('contador');
  const comercio: Record<string, string> = {};
  const usuario: Record<string, string> = {};
  const prod: Record<string, string> = {};

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const indicadores = (quien = duenioA) => t.http().get('/api/v1/indicators').set(auth(quien));
  const comparacion = (query = '', quien = duenioA) =>
    t.http().get(`/api/v1/insights/inflation${query}`).set(auth(quien));
  const historial = (productoId: string, quien = duenioB) =>
    t.http().get(`/api/v1/products/${productoId}/price-history`).set(auth(quien));

  const crearProducto = async (
    datos: { codigo: string; precioVenta: number; costoReposicion: number; stockInicial?: number },
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
  const vender = (productoId: string, cantidad: number, fecha: string, quien = duenioA) =>
    t
      .http()
      .post('/api/v1/movements')
      .set(auth(quien))
      .send({ tipo: 'VENTA', productoId, cantidad, fecha })
      .expect(201);

  /** Estado de la última consulta a la fuente, fijado como propietaria. */
  const fijarEstado = (estado: { actualizadoEn: Date | null; error?: string } | null) =>
    comoPropietaria(async (owner) => {
      await owner.indicadorActualizacion.deleteMany({});
      if (estado) {
        await owner.indicadorActualizacion.create({
          data: {
            fuente: fuente.nombre,
            actualizadoEn: estado.actualizadoEn,
            intentadoEn: estado.actualizadoEn,
            ultimoError: estado.error ?? null,
          },
        });
      }
    });
  const vaciarIndicadores = () =>
    comoPropietaria(async (owner) => {
      await owner.indicadorEconomico.deleteMany({});
      await owner.indicadorActualizacion.deleteMany({});
    });

  /** Precios y costos con fecha pasada: el historial es de sólo inserción para la API. */
  const fechar = (
    quien: 'a' | 'b',
    productoId: string,
    precios: [string, number][],
    costos: [string, number][] = [],
    proveedorId?: string,
  ) =>
    comoPropietaria(async (owner) => {
      await owner.precioVentaHistorial.createMany({
        data: precios.map(([fecha, precioVenta]) => ({
          comercioId: comercio[quien]!,
          productoId,
          precioVenta,
          alicuotaIva: 21,
          vigenteDesde: new Date(fecha),
          origen: 'EDICION' as const,
          usuarioId: usuario[quien]!,
        })),
      });
      if (costos.length > 0) {
        await owner.precioProveedor.createMany({
          data: costos.map(([fecha, costoNeto]) => ({
            comercioId: comercio[quien]!,
            productoId,
            proveedorId: proveedorId!,
            costoNeto,
            vigenteDesde: new Date(fecha),
            origen: 'MANUAL' as const,
            usuarioId: usuario[quien]!,
          })),
        });
      }
    });

  beforeAll(async () => {
    t = await crearAppDePrueba();
    fuente = t.app.get<FuenteFalsa[]>(FUENTES_INDICADORES)[0]!;
    expect(fuente).toBeInstanceOf(FuenteFalsa);
    await vaciarIndicadores();

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

    // CP-15.3: A (1000 → 1100, costo 600 → 720, 30 unidades) y B (2000 → 2600, costo 1200 → 1500,
    // 10 unidades) entre enero y junio de 2026. C no tiene ventas ni historial de costos (CP-15.4b).
    const proveedor = (
      await t
        .http()
        .post('/api/v1/suppliers')
        .set(auth(duenioA))
        .send({ nombre: 'Distribuidora Norte', leadTimeDias: 5 })
        .expect(201)
    ).body.id as string;
    const canasta = [
      { codigo: 'A', precios: [1000, 1100], costos: [600, 720], unidades: 30, fecha: '03-15' },
      { codigo: 'B', precios: [2000, 2600], costos: [1200, 1500], unidades: 10, fecha: '04-15' },
    ];
    for (const c of canasta) {
      const id = await crearProducto({
        codigo: c.codigo,
        precioVenta: c.precios[1]!,
        costoReposicion: c.costos[1]!,
        stockInicial: 100,
      });
      prod[c.codigo] = id;
      await t
        .http()
        .patch(`/api/v1/products/${id}`)
        .set(auth(duenioA))
        .send({ proveedorPrincipalId: proveedor })
        .expect(200);
      await fechar(
        'a',
        id,
        [
          ['2026-01-10T15:00:00Z', c.precios[0]!],
          ['2026-06-10T15:00:00Z', c.precios[1]!],
        ],
        [
          ['2026-01-10T15:00:00Z', c.costos[0]!],
          ['2026-06-10T15:00:00Z', c.costos[1]!],
        ],
        proveedor,
      );
      await vender(id, c.unidades, `2026-${c.fecha}T15:00:00Z`);
    }
    prod['C'] = await crearProducto({ codigo: 'C', precioVenta: 1210, costoReposicion: 700 });
    await fechar('a', prod['C'], [
      ['2026-01-10T15:00:00Z', 1000],
      ['2026-05-20T15:00:00Z', 1210],
    ]);
  }, 300_000);

  afterAll(async () => {
    await vaciarIndicadores();
    await t.limpiar();
  }, 120_000);

  describe('indicadores económicos oficiales', () => {
    it('CP-15.1c sin datos y con la fuente caída responde 200 con los indicadores vacíos', async () => {
      fuente.fallar = true;
      const r = await indicadores().expect(200);
      expect(r.body).toEqual({
        inflacionMensual: null,
        inflacionInteranual: null,
        dolarMinorista: null,
        ipc: null,
        actualizadoEn: null,
        desactualizado: true,
      });
    }, 120_000);

    it('tras una falla no insiste con la fuente en cada pedido', async () => {
      const antes = fuente.llamadas;
      await indicadores().expect(200);
      expect(fuente.llamadas).toBe(antes);
    }, 120_000);

    it('CP-15.1 indicadores vigentes con su fecha y su fuente', async () => {
      fuente.fallar = false;
      fuente.lecturas = LECTURAS;
      await fijarEstado(null);
      const antes = fuente.llamadas;
      const r = await indicadores().expect(200);
      expect(fuente.llamadas).toBe(antes + 1);
      expect(r.body).toMatchObject({
        inflacionMensual: { valor: '1.70', fecha: '2026-08-31', fuente: 'BCRA' },
        inflacionInteranual: { valor: '33.50', fecha: '2026-08-31', fuente: 'BCRA' },
        dolarMinorista: { valor: '1545.12', fecha: '2026-09-25', fuente: 'BCRA' },
        ipc: { valor: '12276.77', periodo: '2026-08', fuente: 'INDEC' },
        desactualizado: false,
      });
      expect(Date.now() - new Date(r.body.actualizadoEn).getTime()).toBeLessThan(5 * 60 * 1000);
    }, 120_000);

    it('CP-15.1d con datos vigentes no consulta la fuente en cada pedido', async () => {
      await fijarEstado({ actualizadoEn: new Date(Date.now() - HORA) });
      const antes = fuente.llamadas;
      await indicadores().expect(200);
      await indicadores().expect(200);
      expect(fuente.llamadas).toBe(antes);
    }, 120_000);

    it('CP-15.1b con la fuente caída sirve el último dato guardado como desactualizado', async () => {
      const ayer = new Date(Date.now() - 25 * HORA);
      await fijarEstado({ actualizadoEn: ayer });
      fuente.fallar = true;
      const antes = fuente.llamadas;
      const r = await indicadores().expect(200);
      expect(fuente.llamadas).toBe(antes + 1);
      expect(r.body).toMatchObject({
        inflacionMensual: { valor: '1.70', fecha: '2026-08-31' },
        dolarMinorista: { valor: '1545.12' },
        ipc: { periodo: '2026-08' },
        actualizadoEn: ayer.toISOString(),
        desactualizado: true,
      });
      fuente.fallar = false;
      await fijarEstado({ actualizadoEn: new Date() });
    }, 120_000);

    it('una nueva lectura corrige el valor guardado sin duplicar la fecha', async () => {
      fuente.lecturas = [...LECTURAS, { serie: 'USD_MINORISTA', fecha: '2026-09-25', valor: 1546 }];
      await fijarEstado({ actualizadoEn: new Date(Date.now() - 25 * HORA) });
      const r = await indicadores().expect(200);
      expect(r.body.dolarMinorista).toMatchObject({ valor: '1546.00', fecha: '2026-09-25' });
      const filas = await comoPropietaria((owner) =>
        owner.indicadorEconomico.count({
          where: { serie: 'USD_MINORISTA', fecha: new Date('2026-09-25') },
        }),
      );
      expect(filas).toBe(1);
      fuente.lecturas = LECTURAS;
      await fijarEstado({ actualizadoEn: new Date(Date.now() - 25 * HORA) });
      await indicadores().expect(200);
    }, 120_000);
  });

  describe('historial de precios de venta', () => {
    it('CP-15.2 el alta y la edición dejan historial', async () => {
      prod['FA-220'] = await crearProducto(
        { codigo: 'FA-220', precioVenta: 1000, costoReposicion: 600, stockInicial: 20 },
        duenioB,
      );
      await t
        .http()
        .patch(`/api/v1/products/${prod['FA-220']}`)
        .set(auth(duenioB))
        .send({ precioVenta: 1100 })
        .expect(200);
      const r = await historial(prod['FA-220']).expect(200);
      expect(r.body.siguienteCursor).toBeNull();
      expect(r.body.items).toHaveLength(2);
      expect(r.body.items[0]).toMatchObject({
        precioVenta: '1100.00',
        alicuotaIva: '21',
        origen: 'EDICION',
        usuario: { id: usuario['b'], nombre: duenioB.nombre },
      });
      expect(r.body.items[1]).toMatchObject({ precioVenta: '1000.00', origen: 'ALTA' });
      expect(new Date(r.body.items[0].vigenteDesde).getTime()).toBeGreaterThan(
        new Date(r.body.items[1].vigenteDesde).getTime(),
      );
    }, 120_000);

    it('CP-15.2b sin cambio de precio no hay fila nueva', async () => {
      const patch = (body: object) =>
        t
          .http()
          .patch(`/api/v1/products/${prod['FA-220']}`)
          .set(auth(duenioB))
          .send(body)
          .expect(200);
      await patch({ nombre: 'Filtro de aire FA-220' });
      await patch({ precioVenta: 1100 });
      await patch({ stockSeguridad: 3 });
      const r = await historial(prod['FA-220']!).expect(200);
      expect(r.body.items).toHaveLength(2);
    }, 120_000);

    it('cambiar sólo la alícuota de IVA también queda registrado', async () => {
      const id = await crearProducto(
        { codigo: 'IVA-1', precioVenta: 500, costoReposicion: 300 },
        duenioB,
      );
      await t
        .http()
        .patch(`/api/v1/products/${id}`)
        .set(auth(duenioB))
        .send({ alicuotaIva: 10.5 })
        .expect(200);
      const r = await historial(id).expect(200);
      expect(r.body.items.map((i: { alicuotaIva: string }) => i.alicuotaIva)).toEqual([
        '10.5',
        '21',
      ]);
      await t.http().delete(`/api/v1/products/${id}`).set(auth(duenioB)).expect(200);
    }, 120_000);

    it('CP-15.2c la importación también registra', async () => {
      const planilla =
        'codigo;nombre;precio;costo;stock;iva\n' +
        'FA-220;Filtro de aire FA-220;1200;600;0;21\n' +
        'AM-1L;Aceite Mineral 1L;500;300;5;21\n';
      const previa = await t
        .http()
        .post('/api/v1/import/preview')
        .set(auth(duenioB))
        .attach('archivo', Buffer.from(planilla, 'utf8'), 'productos.csv')
        .expect(200);
      const importar = () =>
        t
          .http()
          .post('/api/v1/import/commit')
          .set(auth(duenioB))
          .send({ filas: previa.body.filas })
          .expect(201);
      expect((await importar()).body).toMatchObject({ creados: 1, actualizados: 1 });

      const filtro = await historial(prod['FA-220']!).expect(200);
      expect(filtro.body.items).toHaveLength(3);
      expect(filtro.body.items[0]).toMatchObject({ precioVenta: '1200.00', origen: 'IMPORT' });
      const lista = await t.http().get('/api/v1/products?q=AM-1L').set(auth(duenioB)).expect(200);
      prod['AM-1L'] = lista.body.items[0].id;
      const aceite = await historial(prod['AM-1L']!).expect(200);
      expect(aceite.body.items).toHaveLength(1);
      expect(aceite.body.items[0]).toMatchObject({
        precioVenta: '500.00',
        origen: 'IMPORT',
        usuario: { id: usuario['b'] },
      });

      // Reimportar la misma planilla no cambia precios: el historial queda igual.
      expect((await importar()).body).toMatchObject({ creados: 0, actualizados: 2 });
      expect((await historial(prod['FA-220']!).expect(200)).body.items).toHaveLength(3);
      expect((await historial(prod['AM-1L']!).expect(200)).body.items).toHaveLength(1);
    }, 120_000);

    it('el historial se pagina por cursor', async () => {
      const primera = await historial(prod['FA-220']!).query({ limit: 2 }).expect(200);
      expect(primera.body.items).toHaveLength(2);
      expect(primera.body.siguienteCursor).toEqual(expect.any(String));
      const segunda = await historial(prod['FA-220']!)
        .query({ limit: 2, cursor: primera.body.siguienteCursor })
        .expect(200);
      expect(segunda.body.items.map((i: { precioVenta: string }) => i.precioVenta)).toEqual([
        '1000.00',
      ]);
      expect(segunda.body.siguienteCursor).toBeNull();
    }, 120_000);
  });

  describe('comparación contra la inflación', () => {
    it('CP-15.3 índices base 100, variaciones y brechas', async () => {
      const r = await comparacion('?desde=2026-01&hasta=2026-06').expect(200);
      expect(r.body).toMatchObject({
        desde: '2026-01',
        hasta: '2026-06',
        recortado: false,
        meses: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'],
        variaciones: { misPrecios: '18.00', misCostos: '22.00', ipc: '20.00', ipcBienes: '19.00' },
        brechas: { preciosVsIpc: '-1.67', preciosVsCostos: '-3.28' },
        motivo: null,
      });
      expect(r.body.series.misPrecios).toEqual([
        '100.00',
        '100.00',
        '100.00',
        '100.00',
        '100.00',
        '118.00',
      ]);
      expect(r.body.series.misCostos[5]).toBe('122.00');
      expect(r.body.series.ipc).toEqual([
        '100.00',
        '104.00',
        '108.00',
        '112.00',
        '116.00',
        '120.00',
      ]);
      expect(r.body.series.ipcBienes[5]).toBe('119.00');
    }, 120_000);

    it('CP-15.4 atrasado, adelantado y precios sugeridos, sin cambiar ningún precio', async () => {
      const r = await comparacion('?desde=2026-01&hasta=2026-06').expect(200);
      const codigos = r.body.productos.map(
        (p: { producto: { codigo: string } }) => p.producto.codigo,
      );
      expect(codigos).toEqual(['A', 'C', 'B']);
      expect(r.body.productos[0]).toMatchObject({
        producto: { id: prod['A'], codigo: 'A' },
        unidadesVendidas: 30,
        precioInicial: '1000.00',
        precioFinal: '1100.00',
        costoInicial: '600.00',
        costoFinal: '720.00',
        variacionPrecio: '10.00',
        variacionCosto: '20.00',
        variacionReal: '-8.33',
        estado: 'ATRASADO',
        precioSugeridoInflacion: '1200.00',
        precioSugeridoMargen: '1200.00',
        datosDesde: '2026-01-10T15:00:00.000Z',
      });
      expect(r.body.productos[2]).toMatchObject({
        unidadesVendidas: 10,
        variacionPrecio: '30.00',
        variacionCosto: '25.00',
        variacionReal: '8.33',
        estado: 'ADELANTADO',
        precioSugeridoInflacion: '2400.00',
        precioSugeridoMargen: '2500.00',
      });
      const a = await t.http().get(`/api/v1/products/${prod['A']}`).set(auth(duenioA)).expect(200);
      expect(a.body.precioVenta).toBe('1100.00');
    }, 120_000);

    it('CP-15.4b alineado y sin historial de costos', async () => {
      const r = await comparacion('?desde=2026-01&hasta=2026-06').expect(200);
      expect(r.body.productos[1]).toMatchObject({
        producto: { codigo: 'C' },
        unidadesVendidas: 0,
        precioInicial: '1000.00',
        precioFinal: '1210.00',
        costoInicial: '700.00',
        costoFinal: '700.00',
        variacionReal: '0.83',
        estado: 'ALINEADO',
        variacionCosto: '0.00',
        precioSugeridoMargen: '1000.00',
      });
    }, 120_000);

    it('una venta anulada no cuenta en la canasta', async () => {
      const extra = (await vender(prod['B']!, 5, '2026-05-10T15:00:00Z')).body.id as string;
      const conExtra = await comparacion('?desde=2026-01&hasta=2026-06').expect(200);
      expect(conExtra.body.productos[2].unidadesVendidas).toBe(15);
      const anulada = await t
        .http()
        .post(`/api/v1/movements/${extra}/anular`)
        .set(auth(duenioA))
        .send({});
      expect([200, 201]).toContain(anulada.status);
      const r = await comparacion('?desde=2026-01&hasta=2026-06').expect(200);
      expect(r.body.variaciones.misPrecios).toBe('18.00');
      expect(r.body.productos[2].unidadesVendidas).toBe(10);
    }, 120_000);

    it('por defecto cubre los últimos seis meses hasta el último IPC publicado', async () => {
      const r = await comparacion().expect(200);
      expect(r.body).toMatchObject({ desde: '2026-03', hasta: '2026-08', recortado: false });
      expect(r.body.meses).toHaveLength(6);
      expect(r.body.series.ipc[5]).toBe('113.67');
    }, 120_000);

    it('CP-15.3b recorta el período al último mes con IPC publicado', async () => {
      const r = await comparacion('?desde=2026-04&hasta=2026-09').expect(200);
      expect(r.body).toMatchObject({ desde: '2026-04', hasta: '2026-08', recortado: true });
      expect(r.body.meses).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
      const futuro = await comparacion('?desde=2026-09&hasta=2026-10').expect(200);
      expect(futuro.body).toMatchObject({ desde: '2026-08', hasta: '2026-08', recortado: true });
    }, 120_000);

    it('CP-15.3c sin ventas en el período', async () => {
      // El comercio B vendió recién en julio: entre enero y junio no tiene ventas.
      await vender(prod['FA-220']!, 2, '2026-07-10T15:00:00Z', duenioB);
      const r = await comparacion('?desde=2026-01&hasta=2026-06', duenioB).expect(200);
      expect(r.body.motivo).toBe('SIN_VENTAS');
      expect(r.body.series.misPrecios).toEqual([]);
      expect(r.body.series.misCostos).toEqual([]);
      expect(r.body.series.ipc).toHaveLength(6);
      expect(r.body.series.ipc[5]).toBe('120.00');
      expect(r.body.variaciones).toMatchObject({ misPrecios: null, misCostos: null, ipc: '20.00' });
      expect(r.body.brechas).toEqual({ preciosVsIpc: null, preciosVsCostos: null });
      expect(r.body.productos.length).toBeGreaterThan(0);
    }, 120_000);

    it('CP-15.3d período inválido', async () => {
      const invertido = await comparacion('?desde=2026-07&hasta=2026-06').expect(400);
      expect(invertido.body.code).toBe('VALIDACION');
      expect(invertido.body.details).toHaveProperty('desde');
      const largo = await comparacion('?desde=2024-08&hasta=2026-08').expect(400);
      expect(largo.body.details).toHaveProperty('hasta');
      const formato = await comparacion('?desde=2026-1').expect(400);
      expect(formato.body.details).toHaveProperty('desde');
      const sinTope = await comparacion('?desde=2020-01').expect(400);
      expect(sinTope.body.code).toBe('VALIDACION');
    }, 120_000);
  });

  describe('plan, permisos y aislamiento', () => {
    it('CP-15.5 el plan FREE ve los indicadores pero no la comparación', async () => {
      const r = await comparacion('', duenioF).expect(402);
      expect(r.body).toMatchObject({ code: 'PLAN_REQUERIDO', details: { planMinimo: 'PRO' } });
      await indicadores(duenioF).expect(200);
      const id = await crearProducto(
        { codigo: 'FREE-1', precioVenta: 100, costoReposicion: 50 },
        duenioF,
      );
      const h = await historial(id, duenioF).expect(402);
      expect(h.body.code).toBe('PLAN_REQUERIDO');
    }, 120_000);

    it('CP-15.5b el contador consulta y la empleada no', async () => {
      await comparacion('?desde=2026-01&hasta=2026-06', contador).expect(200);
      await indicadores(contador).expect(200);
      await historial(prod['A']!, contador).expect(200);
      const r = await comparacion('', empleada).expect(403);
      expect(r.body.code).toBe('SIN_PERMISO');
      const h = await historial(prod['A']!, empleada).expect(403);
      expect(h.body.code).toBe('SIN_PERMISO');
      await indicadores(empleada).expect(200);
    }, 120_000);

    it('sin sesión no se ven los indicadores', async () => {
      const r = await t.http().get('/api/v1/indicators').expect(401);
      expect(r.body.code).toBe('NO_AUTENTICADO');
    });

    it('CP-15.5c un comercio sólo ve sus productos y su historial', async () => {
      const a = await comparacion('?desde=2026-01&hasta=2026-08').expect(200);
      const b = await comparacion('?desde=2026-01&hasta=2026-08', duenioB).expect(200);
      const codigos = (r: { body: { productos: { producto: { codigo: string } }[] } }) =>
        r.body.productos.map((p) => p.producto.codigo).sort();
      expect(codigos(a)).toEqual(['A', 'B', 'C']);
      expect(codigos(b)).toEqual(['AM-1L', 'FA-220']);
      const ajeno = await historial(prod['FA-220']!, duenioA).expect(404);
      expect(ajeno.body.code).toBe('NO_ENCONTRADO');
    }, 120_000);
  });

  // Los casos de HU-17 que dependen del IPC viven en esta suite: las tablas de indicadores son
  // globales y otra suite en paralelo las pisaría.
  describe('HU-17 remarcación con los precios sugeridos', () => {
    interface Item {
      producto: { id: string; codigo: string };
      precioActual: string;
      precioNuevo: string | null;
      variacion: string | null;
      resultado: string;
      estado: string | null;
    }
    const PERIODO = { desde: '2026-01', hasta: '2026-06' };
    const vistaPrevia = (body: object, quien = duenioA) =>
      t.http().post('/api/v1/repricing/preview').set(auth(quien)).send(body);
    const item = (items: Item[], codigo: string) =>
      items.find((i) => i.producto.codigo === codigo) as Item;

    it('CP-17.1 alcanzar la inflación, sin modificar nada', async () => {
      const r = await vistaPrevia({ criterio: 'INFLACION', ...PERIODO }).expect(200);
      expect(r.body.motivo).toBeNull();
      expect(r.body.parametros).toMatchObject(PERIODO);
      expect(r.body.resumen).toEqual({ suben: 1, bajan: 0, sinCambio: 2, sinDatos: 0 });
      expect(item(r.body.items, 'A')).toMatchObject({
        precioActual: '1100.00',
        precioNuevo: '1200.00',
        variacion: '9.09',
        margenBrutoPctActual: '20.80',
        margenBrutoPctNuevo: '27.40',
        resultado: 'SUBE',
        estado: 'ATRASADO',
      });
      expect(item(r.body.items, 'B')).toMatchObject({
        precioActual: '2600.00',
        precioNuevo: '2600.00',
        resultado: 'SIN_CAMBIO',
        estado: 'ADELANTADO',
      });
      expect(item(r.body.items, 'C')).toMatchObject({
        precioNuevo: '1210.00',
        resultado: 'SIN_CAMBIO',
        estado: 'ALINEADO',
      });
      const a = await t.http().get(`/api/v1/products/${prod['A']}`).set(auth(duenioA)).expect(200);
      expect(a.body.precioVenta).toBe('1100.00');
    }, 120_000);

    it('CP-17.2 baja precios sólo si se pide', async () => {
      const r = await vistaPrevia({
        criterio: 'INFLACION',
        ...PERIODO,
        permitirBajas: true,
      }).expect(200);
      expect(item(r.body.items, 'B')).toMatchObject({
        precioNuevo: '2400.00',
        variacion: '-7.69',
        resultado: 'BAJA',
      });
      expect(r.body.resumen).toEqual({ suben: 1, bajan: 2, sinCambio: 0, sinDatos: 0 });
    }, 120_000);

    it('CP-17.1d elegir los productos por su estado frente a la inflación', async () => {
      const atrasados = await vistaPrevia({
        criterio: 'INFLACION',
        ...PERIODO,
        estado: 'ATRASADO',
      }).expect(200);
      expect(atrasados.body.items.map((i: Item) => i.producto.codigo)).toEqual(['A']);
      // El estado también sirve con los criterios que no usan la inflación.
      const conPorcentaje = await vistaPrevia({
        criterio: 'PORCENTAJE',
        porcentaje: 10,
        ...PERIODO,
        estado: 'ADELANTADO',
      }).expect(200);
      expect(conPorcentaje.body.items).toHaveLength(1);
      expect(item(conPorcentaje.body.items, 'B')).toMatchObject({
        precioNuevo: '2860.00',
        estado: 'ADELANTADO',
      });
    }, 120_000);

    it('sostener el margen del inicio del período', async () => {
      const r = await vistaPrevia({ criterio: 'MARGEN', ...PERIODO }).expect(200);
      expect(item(r.body.items, 'A')).toMatchObject({ precioNuevo: '1200.00', resultado: 'SUBE' });
      expect(item(r.body.items, 'B')).toMatchObject({
        precioNuevo: '2600.00',
        resultado: 'SIN_CAMBIO',
      });
    }, 120_000);

    it('el contador ve la vista previa y la empleada no', async () => {
      await vistaPrevia({ criterio: 'INFLACION', ...PERIODO }, contador).expect(200);
      const r = await vistaPrevia({ criterio: 'INFLACION', ...PERIODO }, empleada).expect(403);
      expect(r.body.code).toBe('SIN_PERMISO');
    }, 120_000);

    it('sin índice del INDEC el criterio de inflación no inventa precios', async () => {
      const r = await vistaPrevia({
        criterio: 'INFLACION',
        desde: '2020-01',
        hasta: '2020-06',
      }).expect(200);
      expect(r.body.motivo).toBe('SIN_IPC');
      expect(r.body.resumen).toEqual({ suben: 0, bajan: 0, sinCambio: 0, sinDatos: 3 });
      expect(item(r.body.items, 'A')).toMatchObject({ precioNuevo: null, resultado: 'SIN_DATOS' });
    }, 120_000);
  });

  it('carga sintética: 5.000 productos con historial y 50.000 movimientos en menos de 3 s', async () => {
    await conCargaExclusiva(async () => {
      const productos = Array.from({ length: 5000 }, (_, i) => ({
        id: randomUUID(),
        comercioId: comercio['c']!,
        codigo: `PERF-${i}`,
        codigoNormalizado: `PERF-${i}`,
        nombre: `Producto de carga ${String(i).padStart(4, '0')}`,
        precioVenta: 130,
        alicuotaIva: 21,
        costoReposicion: 70,
        stockActual: 100,
        stockSeguridad: 10,
      }));
      await t.prisma.comoSistema(async (tx) => {
        await tx.producto.createMany({ data: productos });
        for (const [fecha, precioVenta] of [
          ['2025-09-05T12:00:00Z', 100],
          ['2026-01-05T12:00:00Z', 115],
          ['2026-06-05T12:00:00Z', 130],
        ] as const) {
          await tx.precioVentaHistorial.createMany({
            data: productos.map((p) => ({
              comercioId: p.comercioId,
              productoId: p.id,
              precioVenta,
              alicuotaIva: 21,
              vigenteDesde: new Date(fecha),
              origen: 'INICIAL' as const,
            })),
          });
        }
      });
      const meses = Object.keys(IPC);
      const LOTE = 5000;
      for (let lote = 0; lote < 50000 / LOTE; lote += 1) {
        const movimientos = Array.from({ length: LOTE }, (_, j) => {
          const n = lote * LOTE + j;
          const dia = String((n % 28) + 1).padStart(2, '0');
          return {
            comercioId: comercio['c']!,
            productoId: productos[n % productos.length]!.id,
            usuarioId: usuario['c']!,
            tipo: 'VENTA' as const,
            cantidad: 1,
            efectoStock: -1,
            stockResultante: 99,
            precioUnitario: 121,
            fecha: new Date(`${meses[n % meses.length]}-${dia}T12:00:00-03:00`),
          };
        });
        await t.prisma.comoSistema((tx) => tx.movimiento.createMany({ data: movimientos }));
      }

      const consulta = '?desde=2025-09&hasta=2026-08';
      await comparacion(consulta, duenioC).expect(200); // calentamiento
      const inicio = Date.now();
      const r = await comparacion(consulta, duenioC).expect(200);
      const ms = Date.now() - inicio;
      expect(r.body.meses).toHaveLength(12);
      expect(r.body.productos).toHaveLength(5000);
      expect(r.body.variaciones.misPrecios).toBe('30.00');
      expect(ms).toBeLessThan(3000);
    });
  }, 600_000);
});
