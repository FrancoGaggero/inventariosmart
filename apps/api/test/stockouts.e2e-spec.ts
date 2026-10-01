import { randomUUID } from 'node:crypto';
import { DIA_MS } from '@inventariosmart/shared';
import { RELOJ } from '../src/common/reloj';
import { type AppDePrueba, conCargaExclusiva, crearAppDePrueba, persona } from './helpers';

/** La hora de la consulta queda fija: un quiebre en curso cambia de cifra con cada segundo. */
const AHORA = new Date();
const hace = (dias: number) => new Date(AHORA.getTime() - dias * DIA_MS);
const HORA = 60 * 60 * 1000;

type Tipo = 'VENTA' | 'INGRESO' | 'AJUSTE';
/** [días atrás, tipo, stock que deja]. La cantidad sale de la diferencia con el anterior. */
type Paso = [number, Tipo, number];

interface ProductoDato {
  producto: { id: string; codigo: string };
  quiebres: number;
  diasSinStock: number;
  enCurso: boolean;
  inicioUltimo: string;
  demandaDiaria: string | null;
  unidadesPerdidas: string | null;
  ventaPerdida: string | null;
  gananciaPerdida: string | null;
  motivo: string | null;
}

describe('stockout-losses: pérdidas por falta de stock (e2e)', () => {
  let t: AppDePrueba;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const duenioD = persona('duenio-d');
  const duenioE = persona('duenio-e');
  const duenioFree = persona('duenio-free');
  const duenioCarga = persona('duenio-carga');
  const contador = persona('contador');
  const empleada = persona('empleada');
  const comercio: Record<string, string> = {};
  const usuario: Record<string, string> = {};
  const prod: Record<string, string> = {};

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const quiebres = (query = '', quien = duenioA) =>
    t.http().get(`/api/v1/stockouts${query}`).set(auth(quien));
  const deProducto = (items: ProductoDato[], codigo: string) =>
    items.find((i) => i.producto.codigo === codigo);

  /** Crea el producto con su historia de stock, con las fechas de registro que indica cada paso. */
  async function armar(
    clave: string,
    codigo: string,
    pasos: Paso[],
    opciones: { precioVenta?: number; costo?: number; activo?: boolean } = {},
  ): Promise<string> {
    const id = randomUUID();
    const comercioId = comercio[clave]!;
    const usuarioId = usuario[clave]!;
    let stock = 0;
    const movimientos = pasos.map(([dias, tipo, stockResultante], i) => {
      const efectoStock = stockResultante - stock;
      stock = stockResultante;
      const instante = hace(dias);
      return {
        id: randomUUID(),
        comercioId,
        productoId: id,
        usuarioId,
        tipo,
        cantidad: tipo === 'AJUSTE' ? efectoStock : Math.abs(efectoStock),
        efectoStock,
        stockResultante,
        precioUnitario: tipo === 'VENTA' ? (opciones.precioVenta ?? 1210) : null,
        motivo: i === 0 && tipo === 'INGRESO' ? ('STOCK_INICIAL' as const) : null,
        fecha: instante,
        creadoEn: instante,
      };
    });
    await t.prisma.comoSistema(async (tx) => {
      await tx.producto.create({
        data: {
          id,
          comercioId,
          codigo,
          codigoNormalizado: codigo,
          nombre: `Producto ${codigo}`,
          precioVenta: opciones.precioVenta ?? 1210,
          alicuotaIva: 21,
          costoReposicion: opciones.costo ?? 600,
          stockActual: stock,
          stockSeguridad: 2,
          activo: opciones.activo ?? true,
        },
      });
      if (movimientos.length > 0) await tx.movimiento.createMany({ data: movimientos });
    });
    prod[codigo] = id;
    return id;
  }

  beforeAll(async () => {
    t = await crearAppDePrueba([], (m) => m.overrideProvider(RELOJ).useValue(() => AHORA));
    for (const [clave, p] of [
      ['a', duenioA],
      ['b', duenioB],
      ['d', duenioD],
      ['e', duenioE],
      ['free', duenioFree],
      ['carga', duenioCarga],
    ] as const) {
      const me = (await t.http().get('/api/v1/me').set(auth(p)).expect(200)).body;
      comercio[clave] = me.comercio.id;
      usuario[clave] = me.usuario.id;
    }
    await t.prisma.comoSistema((tx) =>
      tx.comercio.updateMany({
        where: { id: { in: ['a', 'b', 'd', 'e', 'carga'].map((c) => comercio[c]!) } },
        data: { plan: 'PRO' },
      }),
    );
    for (const [p, rol] of [
      [contador, 'CONTADOR'],
      [empleada, 'EMPLEADO'],
    ] as const) {
      await t
        .http()
        .post('/api/v1/users')
        .set(auth(duenioA))
        .send({ email: p.email, rol })
        .expect(201);
      await t.http().get('/api/v1/me').set(auth(p)).expect(200);
    }

    // Comercio A: los casos de RN-14.
    await armar('a', 'Q-CERRADO', [
      [60, 'INGRESO', 20],
      [12, 'VENTA', 0],
      [7, 'INGRESO', 30],
    ]);
    await armar('a', 'Q-CURSO', [
      [30, 'INGRESO', 10],
      [4, 'VENTA', 0],
    ]);
    await armar('a', 'Q-VARIOS', [
      [60, 'INGRESO', 5],
      [14, 'VENTA', 0],
      [11, 'INGRESO', 8],
      [7, 'VENTA', 0],
      [5, 'INGRESO', 3],
    ]);
    await armar('a', 'Q-ANTES', [
      [120, 'INGRESO', 2],
      [40, 'VENTA', 0],
      [25, 'INGRESO', 10],
    ]);
    await armar('a', 'Q-DEMANDA', [
      [35, 'INGRESO', 60],
      [5, 'VENTA', 0],
    ]);
    await armar('a', 'Q-POCOS', [
      [10, 'INGRESO', 3],
      [7, 'VENTA', 0],
    ]);
    await armar('a', 'Q-SINVENTAS', [
      [25, 'INGRESO', 5],
      [5, 'AJUSTE', 0],
    ]);
    // Nunca tuvo stock, nunca quedó en cero, y uno dado de baja: no aparecen.
    await armar('a', 'Q-NUNCA', []);
    await armar('a', 'Q-OK', [
      [50, 'INGRESO', 40],
      [10, 'VENTA', 30],
    ]);
    await armar(
      'a',
      'Q-BAJA',
      [
        [20, 'INGRESO', 4],
        [3, 'VENTA', 0],
      ],
      { activo: false },
    );

    // CP-18.1d: una venta que dejó el stock en 0 y se anuló una hora después.
    const anulada = randomUUID();
    const ajuste = randomUUID();
    const id = randomUUID();
    const v = hace(3);
    const a = new Date(v.getTime() + HORA);
    await t.prisma.comoSistema(async (tx) => {
      await tx.producto.create({
        data: {
          id,
          comercioId: comercio['a']!,
          codigo: 'Q-ANULADA',
          codigoNormalizado: 'Q-ANULADA',
          nombre: 'Producto Q-ANULADA',
          precioVenta: 1210,
          alicuotaIva: 21,
          costoReposicion: 600,
          stockActual: 4,
          stockSeguridad: 1,
        },
      });
      const base = { comercioId: comercio['a']!, productoId: id, usuarioId: usuario['a']! };
      await tx.movimiento.create({
        data: {
          ...base,
          tipo: 'INGRESO',
          cantidad: 4,
          efectoStock: 4,
          stockResultante: 4,
          motivo: 'STOCK_INICIAL',
          fecha: hace(30),
          creadoEn: hace(30),
        },
      });
      await tx.movimiento.create({
        data: {
          ...base,
          id: anulada,
          tipo: 'VENTA',
          cantidad: 4,
          efectoStock: -4,
          stockResultante: 0,
          precioUnitario: 1210,
          fecha: v,
          creadoEn: v,
        },
      });
      await tx.movimiento.create({
        data: {
          ...base,
          id: ajuste,
          tipo: 'AJUSTE',
          cantidad: 4,
          efectoStock: 4,
          stockResultante: 4,
          motivo: 'ANULACION',
          corrigeAId: anulada,
          fecha: a,
          creadoEn: a,
        },
      });
      await tx.movimiento.update({ where: { id: anulada }, data: { anuladoPorId: ajuste } });
    });
    prod['Q-ANULADA'] = id;

    // Comercio B: un producto que nunca se quedó sin stock.
    await armar('b', 'B-OK', [
      [40, 'INGRESO', 10],
      [2, 'VENTA', 8],
    ]);

    // Comercio D (CP-18.3, CP-18.7): ganancias perdidas de 4.000, 9.000 y una no calculable.
    await armar('d', 'D-4000', [
      [35, 'INGRESO', 60],
      [5, 'VENTA', 0],
    ]);
    // 150 unidades en 30 días con stock = 5 por día; 4,5 días sin stock = 22,5 × 400 = 9.000.
    await armar('d', 'D-9000', [
      [34.5, 'INGRESO', 150],
      [4.5, 'VENTA', 0],
    ]);
    await armar('d', 'D-NC', [
      [6, 'INGRESO', 2],
      [2, 'VENTA', 0],
    ]);

    // Comercio E (CP-18.3b): 30 productos con quiebres.
    for (let i = 0; i < 30; i += 1) {
      await armar('e', `E-${String(i).padStart(2, '0')}`, [
        [40, 'INGRESO', 30],
        [10 + i * 0.1, 'VENTA', 0],
      ]);
    }

    // Comercio FREE, con un producto que estuvo sin stock.
    await armar('free', 'F-01', [
      [20, 'INGRESO', 3],
      [2, 'VENTA', 0],
    ]);
  }, 300_000);

  afterAll(async () => {
    await t.limpiar();
  }, 120_000);

  describe('detección de quiebres (RN-14)', () => {
    let items: ProductoDato[];

    beforeAll(async () => {
      const r = await quiebres('?dias=30').expect(200);
      items = r.body.items;
      expect(r.body.siguienteCursor).toBeNull();
    });

    it('CP-18.1 un quiebre cerrado', () => {
      expect(deProducto(items, 'Q-CERRADO')).toMatchObject({
        quiebres: 1,
        diasSinStock: 5,
        enCurso: false,
        inicioUltimo: hace(12).toISOString(),
      });
    });

    it('CP-18.1b un quiebre en curso cuenta hasta ahora', async () => {
      expect(deProducto(items, 'Q-CURSO')).toMatchObject({
        quiebres: 1,
        diasSinStock: 4,
        enCurso: true,
        inicioUltimo: hace(4).toISOString(),
      });
      const r = await quiebres('?dias=30').expect(200);
      expect(r.body.totales.enCurso).toBe(items.filter((i) => i.enCurso).length);
    });

    it('CP-18.1c varios quiebres, y sólo la parte del período de uno que empezó antes', () => {
      expect(deProducto(items, 'Q-VARIOS')).toMatchObject({ quiebres: 2, diasSinStock: 5 });
      expect(deProducto(items, 'Q-ANTES')).toMatchObject({
        quiebres: 1,
        diasSinStock: 5,
        enCurso: false,
      });
    });

    it('CP-18.1d una venta anulada deja un quiebre de una hora y no cuenta para la demanda', () => {
      const p = deProducto(items, 'Q-ANULADA');
      expect(p).toMatchObject({ quiebres: 1, diasSinStock: 0, enCurso: false });
      // Sin la venta anulada no hay ventas: no se estima.
      expect(p?.motivo).toBe('SIN_HISTORIAL');
    });

    it('no aparecen los que nunca tuvieron stock, los que nunca quedaron en cero ni los dados de baja', () => {
      for (const codigo of ['Q-NUNCA', 'Q-OK', 'Q-BAJA']) {
        expect(deProducto(items, codigo)).toBeUndefined();
      }
    });
  });

  describe('estimación de la pérdida (RN-14)', () => {
    it('CP-18.2 la demanda sale de los días con stock', async () => {
      const r = await quiebres('?dias=30').expect(200);
      expect(deProducto(r.body.items, 'Q-DEMANDA')).toMatchObject({
        diasSinStock: 5,
        enCurso: true,
        demandaDiaria: '2.0',
        unidadesPerdidas: '10.0',
        ventaPerdida: '10000.00',
        gananciaPerdida: '4000.00',
        motivo: null,
      });
    });

    it('CP-18.2b sin historial suficiente no se estima ni suma', async () => {
      const r = await quiebres('?dias=30').expect(200);
      const items: ProductoDato[] = r.body.items;
      for (const codigo of ['Q-POCOS', 'Q-SINVENTAS']) {
        expect(deProducto(items, codigo)).toMatchObject({
          motivo: 'SIN_HISTORIAL',
          demandaDiaria: null,
          unidadesPerdidas: null,
          ventaPerdida: null,
          gananciaPerdida: null,
        });
      }
      expect(deProducto(items, 'Q-POCOS')!.diasSinStock).toBe(7);
      const suma = items.reduce((s, i) => s + Number(i.gananciaPerdida ?? 0), 0);
      expect(Number(r.body.totales.gananciaPerdida)).toBeCloseTo(suma, 2);
      expect(r.body.totales.productosAfectados).toBe(items.length);
    });
  });

  describe('consulta', () => {
    it('CP-18.3 totales y orden por ganancia perdida, con los no calculables al final', async () => {
      const r = await quiebres('', duenioD).expect(200);
      expect(r.body.dias).toBe(30);
      expect(r.body.hasta).toBe(AHORA.toISOString());
      expect(r.body.desde).toBe(hace(30).toISOString());
      expect(r.body.totales).toMatchObject({
        gananciaPerdida: '13000.00',
        productosAfectados: 3,
        enCurso: 3,
      });
      expect(
        (r.body.items as ProductoDato[]).map((i) => [i.producto.codigo, i.gananciaPerdida]),
      ).toEqual([
        ['D-9000', '9000.00'],
        ['D-4000', '4000.00'],
        ['D-NC', null],
      ]);
    });

    it('CP-18.3b paginación por cursor con los mismos totales', async () => {
      const primera = await quiebres('?limit=25', duenioE).expect(200);
      expect(primera.body.items).toHaveLength(25);
      expect(primera.body.siguienteCursor).toEqual(expect.any(String));
      const segunda = await quiebres(
        `?limit=25&cursor=${primera.body.siguienteCursor}`,
        duenioE,
      ).expect(200);
      expect(segunda.body.items).toHaveLength(5);
      expect(segunda.body.siguienteCursor).toBeNull();
      const ids = [...primera.body.items, ...segunda.body.items].map(
        (i: ProductoDato) => i.producto.id,
      );
      expect(new Set(ids).size).toBe(30);
      expect(segunda.body.totales).toEqual(primera.body.totales);
      expect(primera.body.totales.productosAfectados).toBe(30);
    });

    it('CP-18.3c un período o un cursor inválidos responden 400', async () => {
      const r = await quiebres('?dias=45').expect(400);
      expect(r.body.code).toBe('VALIDACION');
      expect(r.body.details).toHaveProperty('dias');
      await quiebres('?cursor=nada').expect(400);
    });

    it('CP-18.3d sin quiebres, totales en cero y lista vacía', async () => {
      const r = await quiebres('', duenioB).expect(200);
      expect(r.body).toMatchObject({
        totales: {
          gananciaPerdida: '0.00',
          ventaPerdida: '0.00',
          unidadesPerdidas: '0.0',
          productosAfectados: 0,
          enCurso: 0,
        },
        items: [],
        siguienteCursor: null,
      });
    });

    it('con 90 días entra también el quiebre de hace 40 días entero', async () => {
      const r = await quiebres('?dias=90').expect(200);
      expect(deProducto(r.body.items, 'Q-ANTES')).toMatchObject({ diasSinStock: 15 });
    });
  });

  describe('plan, permisos y aislamiento', () => {
    it('CP-18.4 el plan FREE recibe 402 con el plan mínimo', async () => {
      const r = await quiebres('', duenioFree).expect(402);
      expect(r.body).toMatchObject({ code: 'PLAN_REQUERIDO', details: { planMinimo: 'PRO' } });
    });

    it('CP-18.4b el contador consulta y la empleada recibe 403', async () => {
      await quiebres('', contador).expect(200);
      const r = await quiebres('', empleada).expect(403);
      expect(r.body.code).toBe('SIN_PERMISO');
    });

    it('CP-18.4c cada comercio ve sólo sus productos', async () => {
      const deA = (await quiebres('?dias=90').expect(200)).body.items as ProductoDato[];
      const deD = (await quiebres('?dias=90', duenioD).expect(200)).body.items as ProductoDato[];
      const idsD = new Set(deD.map((i) => i.producto.id));
      expect(deA.some((i) => idsD.has(i.producto.id))).toBe(false);
      expect(deD.map((i) => i.producto.codigo).sort()).toEqual(['D-4000', 'D-9000', 'D-NC']);
    });
  });

  describe('panel', () => {
    it('CP-18.7 el panel trae los totales de los últimos 30 días, sin importar el mes', async () => {
      const lista = (await quiebres('', duenioD).expect(200)).body.totales;
      const mesPasado = new Date(AHORA.getTime() - 40 * DIA_MS).toISOString().slice(0, 7);
      const panel = await t
        .http()
        .get(`/api/v1/dashboard?periodo=${mesPasado}`)
        .set(auth(duenioD))
        .expect(200);
      expect(panel.body.quiebres).toEqual({
        gananciaPerdida: '13000.00',
        ventaPerdida: lista.ventaPerdida,
        productosAfectados: 3,
      });
      const free = await t.http().get('/api/v1/dashboard').set(auth(duenioFree)).expect(200);
      expect(free.body.quiebres).toBeNull();
    });
  });

  it('CP-18.5 carga sintética: 5.000 productos y 50.000 movimientos en menos de 3 s', async () => {
    await conCargaExclusiva(async () => {
      const comercioId = comercio['carga']!;
      const usuarioId = usuario['carga']!;
      const productos = Array.from({ length: 5000 }, (_, i) => ({
        id: randomUUID(),
        comercioId,
        codigo: `PERF-${i}`,
        codigoNormalizado: `PERF-${i}`,
        nombre: `Producto de carga ${String(i).padStart(4, '0')}`,
        precioVenta: 1210,
        alicuotaIva: 21,
        costoReposicion: 600,
        // Los primeros 500 terminan en 0: un quiebre en curso cada uno.
        stockActual: i < 500 ? 0 : 1,
        stockSeguridad: 1,
      }));
      await t.prisma.comoSistema((tx) => tx.producto.createMany({ data: productos }));
      // 10 movimientos por producto en los últimos 80 días: un ingreso de 10 y nueve ventas.
      const LOTE = 5000;
      const todos = productos.flatMap((p, i) => {
        const final = i < 500 ? 0 : 1;
        return Array.from({ length: 10 }, (_, k) => {
          // La última venta de los que terminan en 0 es de 2 unidades.
          const vendidas = k === 9 && final === 0 ? 2 : 1;
          const efectoStock = k === 0 ? 10 : -vendidas;
          const stockResultante = k === 0 ? 10 : 10 - k - (vendidas - 1);
          const instante = hace(80 - k * 8 - (i % 7) * 0.01);
          return {
            comercioId,
            productoId: p.id,
            usuarioId,
            tipo: k === 0 ? ('INGRESO' as const) : ('VENTA' as const),
            cantidad: Math.abs(efectoStock),
            efectoStock,
            stockResultante,
            precioUnitario: k === 0 ? null : 1210,
            fecha: instante,
            creadoEn: instante,
          };
        });
      });
      for (let i = 0; i < todos.length; i += LOTE) {
        const lote = todos.slice(i, i + LOTE);
        await t.prisma.comoSistema((tx) => tx.movimiento.createMany({ data: lote }));
      }

      await quiebres('?dias=90', duenioCarga).expect(200); // calentamiento
      const inicio = Date.now();
      const r = await quiebres('?dias=90', duenioCarga).expect(200);
      const ms = Date.now() - inicio;
      expect(r.body.totales.productosAfectados).toBe(500);
      expect(ms).toBeLessThan(3000);

      // El panel, que ahora incluye el bloque de quiebres, también.
      await t.http().get('/api/v1/dashboard').set(auth(duenioCarga)).expect(200);
      const inicioPanel = Date.now();
      const panel = await t.http().get('/api/v1/dashboard').set(auth(duenioCarga)).expect(200);
      expect(Date.now() - inicioPanel).toBeLessThan(3000);
      expect(panel.body.quiebres.productosAfectados).toBe(500);
    });
  }, 600_000);
});
