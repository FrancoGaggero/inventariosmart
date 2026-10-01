import { randomUUID } from 'node:crypto';
import { DIA_MS } from '@inventariosmart/shared';
import { RELOJ } from '../src/common/reloj';
import { type AppDePrueba, conCargaExclusiva, crearAppDePrueba, persona } from './helpers';

/** La hora de la consulta queda fija: así los días sin vender son exactos. */
const AHORA = new Date();
const hace = (dias: number) => new Date(AHORA.getTime() - dias * DIA_MS);

interface ParadoDato {
  producto: { id: string; codigo: string };
  stock: number;
  costoReposicion: string;
  capitalParado: string;
  ultimaVenta: string | null;
  diasSinVender: number;
}

describe('dead-stock: stock parado (e2e)', () => {
  let t: AppDePrueba;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const duenioC = persona('duenio-c');
  const duenioD = persona('duenio-d');
  const duenioE = persona('duenio-e');
  const duenioFree = persona('duenio-free');
  const duenioCarga = persona('duenio-carga');
  const contador = persona('contador');
  const empleada = persona('empleada');
  const comercio: Record<string, string> = {};
  const usuario: Record<string, string> = {};

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const parado = (query = '', quien = duenioA) =>
    t.http().get(`/api/v1/dead-stock${query}`).set(auth(quien));
  const deProducto = (items: ParadoDato[], codigo: string) =>
    items.find((i) => i.producto.codigo === codigo);

  /** Crea el producto con su fecha de alta y sus ventas (días atrás, por fecha de venta). */
  async function armar(
    clave: string,
    codigo: string,
    d: {
      alta: number;
      stock: number;
      costo: number;
      ventas?: number[];
      anuladas?: number[];
      activo?: boolean;
    },
  ): Promise<string> {
    const id = randomUUID();
    const base = { comercioId: comercio[clave]!, productoId: id, usuarioId: usuario[clave]! };
    await t.prisma.comoSistema(async (tx) => {
      await tx.producto.create({
        data: {
          id,
          comercioId: comercio[clave]!,
          codigo,
          codigoNormalizado: codigo,
          nombre: `Producto ${codigo}`,
          precioVenta: d.costo * 2,
          alicuotaIva: 21,
          costoReposicion: d.costo,
          stockActual: d.stock,
          stockSeguridad: 1,
          activo: d.activo ?? true,
          creadoEn: hace(d.alta),
        },
      });
      for (const dias of d.ventas ?? []) {
        await tx.movimiento.create({
          data: {
            ...base,
            tipo: 'VENTA',
            cantidad: 1,
            efectoStock: -1,
            stockResultante: d.stock,
            precioUnitario: d.costo * 2,
            fecha: hace(dias),
            creadoEn: hace(dias),
          },
        });
      }
      for (const dias of d.anuladas ?? []) {
        const venta = randomUUID();
        const ajuste = randomUUID();
        await tx.movimiento.create({
          data: {
            ...base,
            id: venta,
            tipo: 'VENTA',
            cantidad: 1,
            efectoStock: -1,
            stockResultante: d.stock - 1,
            precioUnitario: d.costo * 2,
            fecha: hace(dias),
            creadoEn: hace(dias),
          },
        });
        await tx.movimiento.create({
          data: {
            ...base,
            id: ajuste,
            tipo: 'AJUSTE',
            cantidad: 1,
            efectoStock: 1,
            stockResultante: d.stock,
            motivo: 'ANULACION',
            corrigeAId: venta,
            fecha: hace(dias),
            creadoEn: hace(dias),
          },
        });
        await tx.movimiento.update({ where: { id: venta }, data: { anuladoPorId: ajuste } });
      }
    });
    return id;
  }

  beforeAll(async () => {
    t = await crearAppDePrueba([], (m) => m.overrideProvider(RELOJ).useValue(() => AHORA));
    for (const [clave, p] of [
      ['a', duenioA],
      ['b', duenioB],
      ['c', duenioC],
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
        where: { id: { in: ['a', 'b', 'c', 'd', 'e', 'carga'].map((c) => comercio[c]!) } },
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

    // Comercio A: los casos de RN-15.
    await armar('a', 'S-PARADO', { alta: 200, stock: 10, costo: 2100, ventas: [120] });
    await armar('a', 'S-NUNCA', { alta: 200, stock: 5, costo: 100 });
    await armar('a', 'S-VENDIO', { alta: 200, stock: 4, costo: 100, ventas: [10] });
    await armar('a', 'S-SINSTOCK', { alta: 200, stock: 0, costo: 100, ventas: [120] });
    await armar('a', 'S-BAJA', { alta: 200, stock: 3, costo: 100, activo: false });
    await armar('a', 'S-NUEVO', { alta: 20, stock: 6, costo: 100 });
    await armar('a', 'S-ANULADA', {
      alta: 200,
      stock: 7,
      costo: 100,
      ventas: [150],
      anuladas: [5],
    });
    await armar('a', 'S-45', { alta: 200, stock: 2, costo: 100, ventas: [45] });

    // Comercio B (CP-19.6): un solo producto parado de 21.000.
    await armar('b', 'B-PARADO', { alta: 200, stock: 10, costo: 2100, ventas: [100] });
    // Comercio C (CP-19.2d): todo lo que tiene stock vendió.
    await armar('c', 'C-OK', { alta: 200, stock: 8, costo: 500, ventas: [3] });
    // Comercio D (CP-19.2): stock valorizado de 100.000, con 34.000 parados.
    await armar('d', 'D-21000', { alta: 200, stock: 10, costo: 2100, ventas: [100] });
    await armar('d', 'D-9000', { alta: 200, stock: 3, costo: 3000 });
    await armar('d', 'D-4000', { alta: 200, stock: 2, costo: 2000, ventas: [95] });
    await armar('d', 'D-OK', { alta: 200, stock: 66, costo: 1000, ventas: [5] });
    // Comercio E (CP-19.2b): 30 productos parados.
    for (let i = 0; i < 30; i += 1) {
      await armar('e', `E-${String(i).padStart(2, '0')}`, { alta: 200, stock: 1, costo: 100 + i });
    }
    await armar('free', 'F-01', { alta: 200, stock: 3, costo: 100 });
  }, 300_000);

  afterAll(async () => {
    await t.limpiar();
  }, 120_000);

  describe('detección (RN-15)', () => {
    let items: ParadoDato[];

    beforeAll(async () => {
      items = (await parado('?dias=90').expect(200)).body.items;
    });

    it('CP-19.1 producto sin ventas en el período', () => {
      expect(deProducto(items, 'S-PARADO')).toMatchObject({
        stock: 10,
        costoReposicion: '2100.00',
        capitalParado: '21000.00',
        ultimaVenta: hace(120).toISOString(),
        diasSinVender: 120,
      });
    });

    it('CP-19.1b producto que nunca se vendió', () => {
      expect(deProducto(items, 'S-NUNCA')).toMatchObject({ ultimaVenta: null, diasSinVender: 200 });
    });

    it('CP-19.1c lo que no es stock parado; una venta anulada no cuenta', () => {
      for (const codigo of ['S-VENDIO', 'S-SINSTOCK', 'S-BAJA', 'S-NUEVO']) {
        expect(deProducto(items, codigo)).toBeUndefined();
      }
      expect(deProducto(items, 'S-ANULADA')).toMatchObject({
        ultimaVenta: hace(150).toISOString(),
        diasSinVender: 150,
      });
      // S-45 vendió hace 45 días: con 90 no está parado.
      expect(items.map((i) => i.producto.codigo).sort()).toEqual([
        'S-ANULADA',
        'S-NUNCA',
        'S-PARADO',
      ]);
    });

    it('CP-19.1d el período cambia el resultado', async () => {
      const de30 = (await parado('?dias=30').expect(200)).body.items as ParadoDato[];
      const de60 = (await parado('?dias=60').expect(200)).body.items as ParadoDato[];
      expect(deProducto(de30, 'S-45')).toMatchObject({ diasSinVender: 45 });
      expect(deProducto(de60, 'S-45')).toBeUndefined();
      // Con 30 días, el producto dado de alta hace 20 sigue afuera.
      expect(deProducto(de30, 'S-NUEVO')).toBeUndefined();
    });
  });

  describe('consulta', () => {
    it('CP-19.2 totales y orden por capital parado', async () => {
      const r = await parado('', duenioD).expect(200);
      expect(r.body).toMatchObject({
        dias: 90,
        desde: hace(90).toISOString(),
        hasta: AHORA.toISOString(),
        totales: {
          capitalParado: '34000.00',
          productos: 3,
          unidades: 15,
          porcentajeDelStock: '34.00',
        },
        siguienteCursor: null,
      });
      expect(
        (r.body.items as ParadoDato[]).map((i) => [i.producto.codigo, i.capitalParado]),
      ).toEqual([
        ['D-21000', '21000.00'],
        ['D-9000', '9000.00'],
        ['D-4000', '4000.00'],
      ]);
      // El porcentaje se calcula sobre el mismo stock valorizado que muestra el panel.
      const panel = await t.http().get('/api/v1/dashboard').set(auth(duenioD)).expect(200);
      expect(panel.body.stock.valorizacion).toBe('100000.00');
    });

    it('CP-19.2b paginación por cursor con los mismos totales', async () => {
      const primera = await parado('?limit=25', duenioE).expect(200);
      expect(primera.body.items).toHaveLength(25);
      const segunda = await parado(
        `?limit=25&cursor=${primera.body.siguienteCursor}`,
        duenioE,
      ).expect(200);
      expect(segunda.body.items).toHaveLength(5);
      expect(segunda.body.siguienteCursor).toBeNull();
      const ids = [...primera.body.items, ...segunda.body.items].map(
        (i: ParadoDato) => i.producto.id,
      );
      expect(new Set(ids).size).toBe(30);
      expect(segunda.body.totales).toEqual(primera.body.totales);
    });

    it('CP-19.2c un período o un cursor inválidos responden 400', async () => {
      const r = await parado('?dias=45').expect(400);
      expect(r.body.code).toBe('VALIDACION');
      expect(r.body.details).toHaveProperty('dias');
      await parado('?cursor=nada').expect(400);
    });

    it('CP-19.2d sin stock parado', async () => {
      const r = await parado('', duenioC).expect(200);
      expect(r.body).toMatchObject({
        totales: { capitalParado: '0.00', productos: 0, unidades: 0, porcentajeDelStock: '0.00' },
        items: [],
      });
    });
  });

  describe('plan, permisos y aislamiento', () => {
    it('CP-19.3 el plan FREE recibe 402 con el plan mínimo', async () => {
      const r = await parado('', duenioFree).expect(402);
      expect(r.body).toMatchObject({ code: 'PLAN_REQUERIDO', details: { planMinimo: 'PRO' } });
    });

    it('CP-19.3b el contador consulta y la empleada recibe 403', async () => {
      await parado('', contador).expect(200);
      expect((await parado('', empleada).expect(403)).body.code).toBe('SIN_PERMISO');
    });

    it('CP-19.3c cada comercio ve sólo sus productos', async () => {
      const deA = (await parado('?dias=180').expect(200)).body.items as ParadoDato[];
      const deD = (await parado('?dias=180', duenioD).expect(200)).body.items as ParadoDato[];
      expect(deA.every((i) => i.producto.codigo.startsWith('S-'))).toBe(true);
      expect(deD.every((i) => i.producto.codigo.startsWith('D-'))).toBe(true);
    });
  });

  it('CP-19.6 el panel trae el capital parado de 90 días, sin importar el mes', async () => {
    const mesPasado = new Date(AHORA.getTime() - 40 * DIA_MS).toISOString().slice(0, 7);
    const panel = await t
      .http()
      .get(`/api/v1/dashboard?periodo=${mesPasado}`)
      .set(auth(duenioB))
      .expect(200);
    expect(panel.body.stockParado).toEqual({ capitalParado: '21000.00', productos: 1 });
    const lista = (await parado('?dias=90', duenioB).expect(200)).body.totales;
    expect(lista).toMatchObject({ capitalParado: '21000.00', productos: 1 });
    const free = await t.http().get('/api/v1/dashboard').set(auth(duenioFree)).expect(200);
    expect(free.body.stockParado).toBeNull();
  });

  it('CP-19.4 carga sintética: 5.000 productos y 50.000 movimientos en menos de 3 s', async () => {
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
        stockActual: 5,
        stockSeguridad: 1,
        creadoEn: hace(300),
      }));
      await t.prisma.comoSistema((tx) => tx.producto.createMany({ data: productos }));
      // 10 ventas por producto; los primeros 1.000 vendieron hace más de 90 días.
      const todos = productos.flatMap((p, i) =>
        Array.from({ length: 10 }, (_, k) => {
          const instante = hace(i < 1000 ? 100 + k * 10 : 5 + k * 8);
          return {
            comercioId,
            productoId: p.id,
            usuarioId,
            tipo: 'VENTA' as const,
            cantidad: 1,
            efectoStock: -1,
            stockResultante: 5,
            precioUnitario: 1210,
            fecha: instante,
            creadoEn: instante,
          };
        }),
      );
      for (let i = 0; i < todos.length; i += 5000) {
        const lote = todos.slice(i, i + 5000);
        await t.prisma.comoSistema((tx) => tx.movimiento.createMany({ data: lote }));
      }

      await parado('', duenioCarga).expect(200); // calentamiento
      const inicio = Date.now();
      const r = await parado('', duenioCarga).expect(200);
      const ms = Date.now() - inicio;
      expect(r.body.totales.productos).toBe(1000);
      expect(r.body.items[0].diasSinVender).toBe(100);
      expect(ms).toBeLessThan(3000);
    });
  }, 600_000);
});
