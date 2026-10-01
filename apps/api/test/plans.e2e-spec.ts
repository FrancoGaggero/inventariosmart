import { randomUUID } from 'node:crypto';
import { FUNCIONALIDADES, type ClaveFuncionalidad, type Plan } from '@inventariosmart/shared';
import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

/**
 * Una ruta de consulta por funcionalidad, para comprobar que el catálogo dice lo mismo que los
 * bloqueos reales (CP-14.3). `null`: la funcionalidad no tiene una consulta sin parámetros.
 */
const RUTA: Record<ClaveFuncionalidad, string | null> = {
  inventario: '/api/v1/products',
  panel: '/api/v1/dashboard',
  gastos: '/api/v1/expenses',
  proveedores: '/api/v1/suppliers',
  importacion: null,
  alertas: '/api/v1/alerts',
  quiebres: '/api/v1/stockouts',
  ordenes: '/api/v1/purchase-orders',
  reportes: '/api/v1/reports/weekly',
  inflacion: '/api/v1/insights/inflation',
  remarcacion: '/api/v1/repricing/batches',
  comparador: '/api/v1/supplier-comparison',
  asistente: '/api/v1/assistant/conversations',
};

interface Detalle {
  plan: Plan;
  limites: { productos: number | null; usuarios: number | null };
  uso: { productos: number; usuarios: number };
  funcionalidades: { clave: string; planMinimo: Plan; incluida: boolean }[];
}

describe('subscription-plans: gestión de plan (e2e)', () => {
  let t: AppDePrueba;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const duenioC = persona('duenio-c');
  const empleada = persona('empleada');
  const contador = persona('contador');
  const comercio: Record<string, string> = {};
  const usuario: Record<string, string> = {};

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const plan = (quien = duenioA) => t.http().get('/api/v1/plan').set(auth(quien));
  const cambiar = (a: unknown, quien = duenioA) =>
    t.http().post('/api/v1/plan/change').set(auth(quien)).send({ plan: a });
  const historial = (query = '', quien = duenioA) =>
    t.http().get(`/api/v1/plan/history${query}`).set(auth(quien));
  const consultar = (ruta: string, quien = duenioA) => t.http().get(ruta).set(auth(quien));
  const cambiosDe = (clave: string) =>
    t.prisma.comoSistema((tx) => tx.cambioPlan.count({ where: { comercioId: comercio[clave]! } }));

  /** Productos cargados directo en la base: los límites se prueban con la API en el borde. */
  const cargarProductos = (clave: string, cantidad: number, prefijo: string) =>
    t.prisma.comoSistema((tx) =>
      tx.producto.createMany({
        data: Array.from({ length: cantidad }, (_, i) => ({
          id: randomUUID(),
          comercioId: comercio[clave]!,
          codigo: `${prefijo}-${i}`,
          codigoNormalizado: `${prefijo}-${i}`,
          nombre: `Producto ${prefijo} ${i}`,
          precioVenta: 1000,
          alicuotaIva: 21,
          costoReposicion: 600,
          stockActual: 5,
          stockSeguridad: 1,
        })),
      }),
    );

  beforeAll(async () => {
    t = await crearAppDePrueba();
    for (const [clave, p] of [
      ['a', duenioA],
      ['b', duenioB],
      ['c', duenioC],
    ] as const) {
      const me = (await t.http().get('/api/v1/me').set(auth(p)).expect(200)).body;
      comercio[clave] = me.comercio.id;
      usuario[clave] = me.usuario.id;
    }
  }, 300_000);

  afterAll(async () => {
    await t.limpiar();
  }, 120_000);

  describe('consulta del plan', () => {
    it('CP-14.1 el comercio nace en FREE y sin cambios registrados', async () => {
      const r = await plan().expect(200);
      expect(r.body).toMatchObject({
        plan: 'FREE',
        limites: { productos: 50, usuarios: 1 },
        uso: { productos: 0, usuarios: 1 },
      });
      expect(r.body.funcionalidades.map((f: { clave: string }) => f.clave)).toEqual(
        FUNCIONALIDADES.map((f) => f.clave),
      );
      expect((await historial().expect(200)).body).toEqual({ items: [], siguienteCursor: null });
      await t.http().get('/api/v1/plan').expect(401);
    }, 120_000);

    it('CP-14.3 el catálogo coincide con los bloqueos reales', async () => {
      const detalle = (await plan().expect(200)).body as Detalle;
      // Toda funcionalidad paga tiene una ruta para comprobarla.
      for (const f of FUNCIONALIDADES) {
        if (f.planMinimo !== 'FREE') expect(RUTA[f.clave]).not.toBeNull();
      }
      for (const f of detalle.funcionalidades) {
        const ruta = RUTA[f.clave as ClaveFuncionalidad];
        if (ruta === null) continue;
        const r = await consultar(ruta);
        if (f.incluida) {
          expect({ clave: f.clave, status: r.status }).toEqual({ clave: f.clave, status: 200 });
        } else {
          expect({ clave: f.clave, status: r.status, code: r.body.code }).toEqual({
            clave: f.clave,
            status: 402,
            code: 'PLAN_REQUERIDO',
          });
          expect(r.body.details.planMinimo).toBe(f.planMinimo);
        }
      }
      expect(detalle.funcionalidades.filter((f) => !f.incluida)).toHaveLength(8);
    }, 120_000);

    it('CP-14.2b y CP-14.4 el plan FREE en el límite', async () => {
      await cargarProductos('c', 50, 'LIM');
      const r = await plan(duenioC).expect(200);
      expect(r.body).toMatchObject({
        plan: 'FREE',
        limites: { productos: 50, usuarios: 1 },
        uso: { productos: 50, usuarios: 1 },
      });

      const producto = await t
        .http()
        .post('/api/v1/products')
        .set(auth(duenioC))
        .send({
          codigo: 'UNO-MAS',
          nombre: 'Uno más',
          precioVenta: 1000,
          costoReposicion: 600,
          alicuotaIva: 21,
          stockInicial: 0,
        })
        .expect(402);
      expect(producto.body).toMatchObject({
        code: 'PLAN_REQUERIDO',
        details: { planMinimo: 'PRO' },
      });
      const invitacion = await t
        .http()
        .post('/api/v1/users')
        .set(auth(duenioC))
        .send({ email: persona('sobra').email, rol: 'EMPLEADO' })
        .expect(402);
      expect(invitacion.body.details.planMinimo).toBe('PRO');
      expect((await plan(duenioC).expect(200)).body.uso).toEqual({ productos: 50, usuarios: 1 });
    }, 120_000);
  });

  describe('cambio de plan', () => {
    it('CP-14.5 subir de plan habilita de inmediato, con la misma sesión', async () => {
      await consultar('/api/v1/alerts').expect(402);

      const r = await cambiar('PRO').expect(200);
      expect(r.body).toMatchObject({ plan: 'PRO', limites: { productos: null, usuarios: null } });
      expect(
        r.body.funcionalidades
          .filter((f: { incluida: boolean }) => !f.incluida)
          .map((f: { clave: string }) => f.clave),
      ).toEqual(['comparador', 'asistente']);

      await consultar('/api/v1/alerts').expect(200);
      const comparador = await consultar('/api/v1/supplier-comparison').expect(402);
      expect(comparador.body.details.planMinimo).toBe('PREMIUM');
      const me = await t.http().get('/api/v1/me').set(auth(duenioA)).expect(200);
      expect(me.body.plan).toBe('PRO');
    }, 120_000);

    it('CP-14.2 y CP-14.2c plan PRO con su uso, visible para todos los roles', async () => {
      await cargarProductos('a', 12, 'PRO');
      for (const [p, rol] of [
        [empleada, 'EMPLEADO'],
        [contador, 'CONTADOR'],
      ] as const) {
        const invitado = await t
          .http()
          .post('/api/v1/users')
          .set(auth(duenioA))
          .send({ email: p.email, rol })
          .expect(201);
        usuario[rol] = invitado.body.id;
      }
      // Los invitados cuentan aunque todavía no hayan ingresado.
      expect((await plan().expect(200)).body).toMatchObject({
        plan: 'PRO',
        limites: { productos: null, usuarios: null },
        uso: { productos: 12, usuarios: 3 },
      });
      const deA = (await plan().expect(200)).body.funcionalidades as Detalle['funcionalidades'];
      expect(deA.find((f) => f.clave === 'quiebres')).toMatchObject({
        incluida: true,
        planMinimo: 'PRO',
      });

      for (const quien of [empleada, contador]) {
        await t.http().get('/api/v1/me').set(auth(quien)).expect(200);
        const r = await plan(quien).expect(200);
        expect(r.body.plan).toBe('PRO');
        expect(r.body.funcionalidades).toHaveLength(FUNCIONALIDADES.length);
      }
    }, 120_000);

    it('CP-14.5d pedidos inválidos y permisos: el plan no cambia', async () => {
      const antes = await cambiosDe('a');
      const mismo = await cambiar('PRO').expect(409);
      expect(mismo.body).toMatchObject({
        code: 'CONFLICTO',
        message: 'Tu comercio ya está en el plan Pro.',
        details: { motivo: 'MISMO_PLAN', excesos: [] },
      });
      for (const invalido of ['GOLD', 'pro', '', null]) {
        const r = await cambiar(invalido).expect(400);
        expect(r.body.code).toBe('VALIDACION');
        expect(r.body.details).toHaveProperty('plan');
      }
      await t.http().post('/api/v1/plan/change').set(auth(duenioA)).send({}).expect(400);
      for (const quien of [empleada, contador]) {
        expect((await cambiar('PREMIUM', quien).expect(403)).body.code).toBe('SIN_PERMISO');
        expect((await historial('', quien).expect(403)).body.code).toBe('SIN_PERMISO');
      }
      await t.http().post('/api/v1/plan/change').send({ plan: 'PREMIUM' }).expect(401);

      expect((await plan().expect(200)).body.plan).toBe('PRO');
      expect(await cambiosDe('a')).toBe(antes);
    }, 120_000);

    it('CP-14.5c bajar a FREE por encima de los límites se rechaza e informa cuánto sobra', async () => {
      await cargarProductos('a', 48, 'MAS');
      const antes = await cambiosDe('a');

      const r = await cambiar('FREE').expect(409);
      expect(r.body).toMatchObject({
        code: 'CONFLICTO',
        details: {
          motivo: 'SUPERA_LIMITES',
          excesos: [
            { recurso: 'productos', cantidad: 60, limite: 50 },
            { recurso: 'usuarios', cantidad: 3, limite: 1 },
          ],
        },
      });
      expect(r.body.message).toBe(
        'No se puede pasar al plan Free: tenés 60 productos activos y el plan admite 50; tenés 3 usuarios activos y el plan admite 1. Dá de baja lo que sobra y volvé a intentar.',
      );
      expect((await plan().expect(200)).body.plan).toBe('PRO');
      expect(await cambiosDe('a')).toBe(antes);

      // Con los usuarios en regla todavía sobran productos.
      for (const rol of ['EMPLEADO', 'CONTADOR']) {
        await t
          .http()
          .patch(`/api/v1/users/${usuario[rol]}`)
          .set(auth(duenioA))
          .send({ activo: false })
          .expect(200);
      }
      const soloProductos = await cambiar('FREE').expect(409);
      expect(soloProductos.body.details.excesos).toEqual([
        { recurso: 'productos', cantidad: 60, limite: 50 },
      ]);

      // Dar de baja no borra: los productos quedan inactivos.
      await t.prisma.comoSistema(
        (tx) =>
          tx.$executeRaw`UPDATE producto SET activo = false
            WHERE comercio_id = ${comercio['a']}::uuid AND codigo_normalizado LIKE 'MAS-%'
              AND codigo_normalizado IN ('MAS-0','MAS-1','MAS-2','MAS-3','MAS-4','MAS-5','MAS-6','MAS-7','MAS-8','MAS-9')`,
      );
      const ok = await cambiar('FREE').expect(200);
      expect(ok.body).toMatchObject({
        plan: 'FREE',
        limites: { productos: 50, usuarios: 1 },
        uso: { productos: 50, usuarios: 1 },
      });
      expect(await cambiosDe('a')).toBe(antes + 1);
      await consultar('/api/v1/alerts').expect(402);
    }, 120_000);

    it('CP-14.5b bajar de plan restringe de inmediato y conserva los datos', async () => {
      await cambiar('PREMIUM').expect(200);
      const productos = await consultar('/api/v1/products?limit=1').expect(200);
      const proveedor = await t
        .http()
        .post('/api/v1/suppliers')
        .set(auth(duenioA))
        .send({ nombre: 'Distribuidora Norte', email: 'ventas@norte.test' })
        .expect(201);
      const orden = await t
        .http()
        .post('/api/v1/purchase-orders')
        .set(auth(duenioA))
        .send({
          proveedorId: proveedor.body.id,
          items: [{ productoId: productos.body.items[0].id, cantidad: 5 }],
        })
        .expect(201);
      const conversacion = await t
        .http()
        .post('/api/v1/assistant/messages')
        .set(auth(duenioA))
        .send({ mensaje: '¿Qué tengo que reponer?' })
        .expect(201);

      const bajado = await cambiar('FREE').expect(200);
      expect(bajado.body.plan).toBe('FREE');
      for (const ruta of [
        `/api/v1/purchase-orders/${orden.body.id}`,
        '/api/v1/purchase-orders',
        `/api/v1/assistant/conversations/${conversacion.body.conversacionId}`,
      ]) {
        const r = await consultar(ruta).expect(402);
        expect(r.body.code).toBe('PLAN_REQUERIDO');
      }
      const sinAsistente = await t
        .http()
        .post('/api/v1/assistant/messages')
        .set(auth(duenioA))
        .send({ mensaje: 'hola' })
        .expect(402);
      expect(sinAsistente.body.details.planMinimo).toBe('PREMIUM');
      // Lo que es de FREE sigue funcionando.
      await consultar('/api/v1/products').expect(200);
      await consultar('/api/v1/suppliers').expect(200);

      await cambiar('PREMIUM').expect(200);
      const ordenDespues = await consultar(`/api/v1/purchase-orders/${orden.body.id}`).expect(200);
      expect(ordenDespues.body).toMatchObject({ numero: orden.body.numero, estado: 'BORRADOR' });
      const conversacionDespues = await consultar(
        `/api/v1/assistant/conversations/${conversacion.body.conversacionId}`,
      ).expect(200);
      expect(conversacionDespues.body.mensajes).toHaveLength(2);
    }, 120_000);
  });

  describe('historial y aislamiento', () => {
    it('CP-14.5e historial con quién y cuándo, del más reciente al más antiguo', async () => {
      await cambiar('PRO', duenioB).expect(200);
      await cambiar('PREMIUM', duenioB).expect(200);

      const r = await historial('', duenioB).expect(200);
      expect(
        r.body.items.map((c: { planAnterior: string; planNuevo: string }) => [
          c.planAnterior,
          c.planNuevo,
        ]),
      ).toEqual([
        ['PRO', 'PREMIUM'],
        ['FREE', 'PRO'],
      ]);
      for (const c of r.body.items) {
        expect(c.usuario).toEqual({ id: usuario['b'], nombre: duenioB.nombre });
        expect(Date.now() - new Date(c.creadoEn).getTime()).toBeLessThan(120_000);
      }
      expect(r.body.siguienteCursor).toBeNull();

      const primera = await historial('?limit=1', duenioB).expect(200);
      expect(primera.body.items).toHaveLength(1);
      expect(primera.body.items[0].planNuevo).toBe('PREMIUM');
      const segunda = await historial(
        `?limit=1&cursor=${encodeURIComponent(primera.body.siguienteCursor)}`,
        duenioB,
      ).expect(200);
      expect(segunda.body.items[0].planNuevo).toBe('PRO');
      expect(segunda.body.siguienteCursor).toBeNull();
      await historial('?cursor=xx', duenioB).expect(400);
    }, 120_000);

    it('CP-14.5f el cambio de un comercio no toca a otro', async () => {
      const deA = await historial().expect(200);
      expect(
        deA.body.items.map((c: { planAnterior: string; planNuevo: string }) => [
          c.planAnterior,
          c.planNuevo,
        ]),
      ).toEqual([
        ['FREE', 'PREMIUM'],
        ['PREMIUM', 'FREE'],
        ['FREE', 'PREMIUM'],
        ['PRO', 'FREE'],
        ['FREE', 'PRO'],
      ]);
      expect(
        deA.body.items.every((c: { usuario: { id: string } }) => c.usuario.id === usuario['a']),
      ).toBe(true);
      expect((await plan().expect(200)).body.plan).toBe('PREMIUM');
      expect((await plan(duenioB).expect(200)).body.plan).toBe('PREMIUM');
      // C nunca cambió de plan.
      expect((await plan(duenioC).expect(200)).body.plan).toBe('FREE');
      expect((await historial('', duenioC).expect(200)).body.items).toEqual([]);
    }, 120_000);
  });
});
