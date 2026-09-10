import { TENANT_MODELS } from '../src/prisma/tenant.extension';
import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

/** Nombre de tabla en PostgreSQL de cada modelo (convención @@map en snake_case). */
const TABLA: Record<string, string> = { Usuario: 'usuario', Comercio: 'comercio' };

describe('aislamiento entre comercios (e2e)', () => {
  let t: AppDePrueba;
  const a = persona('duenio-a');
  const b = persona('duenio-b');
  let comercioA: string;
  let comercioB: string;
  let usuarioB: string;

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });

  beforeAll(async () => {
    t = await crearAppDePrueba();
    const ra = await t.http().get('/api/v1/me').set(auth(a)).expect(200);
    const rb = await t.http().get('/api/v1/me').set(auth(b)).expect(200);
    comercioA = ra.body.comercio.id;
    comercioB = rb.body.comercio.id;
    usuarioB = rb.body.usuario.id;
    expect(comercioA).not.toBe(comercioB);
  });

  afterAll(async () => {
    await t.limpiar();
  });

  it('CP-11.5 un usuario de A sólo lista usuarios de A y no puede leer uno de B por id', async () => {
    const lista = await t.http().get('/api/v1/users').set(auth(a)).expect(200);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].email).toBe(a.email);

    const cruzado = await t
      .http()
      .patch(`/api/v1/users/${usuarioB}`)
      .set(auth(a))
      .send({ activo: true })
      .expect(404);
    expect(cruzado.body.code).toBe('NO_ENCONTRADO');
  });

  it('CP-11.5b una escritura cruzada no modifica datos de B', async () => {
    await t
      .http()
      .patch(`/api/v1/users/${usuarioB}`)
      .set(auth(a))
      .send({ rol: 'EMPLEADO' })
      .expect(404);
    const rb = await t.http().get('/api/v1/me').set(auth(b)).expect(200);
    expect(rb.body.rol).toBe('DUENIO');
  });

  it('CP-11.5c sin contexto de comercio la base no devuelve filas (RLS con rol app_api)', async () => {
    const [sinContexto] = await t.prisma.raw.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*)::bigint AS n FROM usuario`;
    const comoSistema = await t.prisma.comoSistema((tx) => tx.usuario.count());
    expect(Number(sinContexto!.n)).toBe(0);
    expect(comoSistema).toBeGreaterThanOrEqual(2);

    const [bypass] = await t.prisma.raw.$queryRaw<{ rolbypassrls: boolean }[]>`
      SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(bypass!.rolbypassrls).toBe(false);
  });

  it('CP-11.5c con contexto de A, la base sólo muestra usuarios de A', async () => {
    const filas = await t.prisma.raw.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.comercio_id', ${comercioA}, true)`;
      return tx.$queryRaw<{ email: string }[]>`SELECT email FROM usuario`;
    });
    expect(filas.map((f) => f.email)).toEqual([a.email]);
  });

  it('toda tabla de negocio tiene RLS activa y forzada (checklist de docs/runbooks/rls.md)', async () => {
    const tablas = [...TENANT_MODELS, 'Comercio'].map((m) => TABLA[m] ?? m.toLowerCase());
    const filas = await t.prisma.raw.$queryRaw<
      { relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]
    >`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = ANY(${tablas})`;
    expect(filas.map((f) => f.relname).sort()).toEqual([...tablas].sort());
    for (const f of filas) {
      expect({ tabla: f.relname, rls: f.relrowsecurity, force: f.relforcerowsecurity }).toEqual({
        tabla: f.relname,
        rls: true,
        force: true,
      });
    }
  });
});
