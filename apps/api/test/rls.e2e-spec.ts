import { TENANT_MODELS } from '../src/prisma/tenant.extension';
import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

/** Nombre de tabla en PostgreSQL de cada modelo (convención @@map en snake_case). */
const TABLA: Record<string, string> = {
  Usuario: 'usuario',
  Comercio: 'comercio',
  Producto: 'producto',
  Movimiento: 'movimiento',
  Proveedor: 'proveedor',
  PrecioProveedor: 'precio_proveedor',
  Gasto: 'gasto',
  Alerta: 'alerta',
  OrdenCompra: 'orden_compra',
  OrdenCompraItem: 'orden_compra_item',
  ReporteSemanal: 'reporte_semanal',
};

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

  it('CP-10.7b sin contexto la base no devuelve movimientos', async () => {
    const [sinContexto] = await t.prisma.raw.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*)::bigint AS n FROM movimiento`;
    expect(Number(sinContexto!.n)).toBe(0);
  });

  it('CP-10.7c el rol de la aplicación no puede modificar ni borrar el historial (RN-07)', async () => {
    const privilegios = await t.prisma.raw.$queryRaw<{ privilege_type: string }[]>`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_name = 'movimiento' AND grantee = current_user`;
    const tipos = privilegios.map((p) => p.privilege_type).sort();
    expect(tipos).toEqual(['INSERT', 'SELECT']);

    const columnas = await t.prisma.raw.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.column_privileges
      WHERE table_name = 'movimiento' AND grantee = current_user AND privilege_type = 'UPDATE'`;
    expect(columnas.map((c) => c.column_name)).toEqual(['anulado_por_id']);

    await expect(
      t.prisma.raw.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.comercio_id', ${comercioA}, true)`;
        await tx.$executeRaw`DELETE FROM movimiento WHERE comercio_id = ${comercioA}::uuid`;
      }),
    ).rejects.toThrow(/permission denied|permiso denegado/i);
    await expect(
      t.prisma.raw.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.comercio_id', ${comercioA}, true)`;
        await tx.$executeRaw`UPDATE movimiento SET cantidad = 1 WHERE comercio_id = ${comercioA}::uuid`;
      }),
    ).rejects.toThrow(/permission denied|permiso denegado/i);
  });

  it('CP-13.6b sin contexto la base no devuelve gastos', async () => {
    const [g] = await t.prisma.raw.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*)::bigint AS n FROM gasto`;
    expect(Number(g!.n)).toBe(0);
  });

  it('CP-02.6b sin contexto la base no devuelve proveedores ni precios', async () => {
    const [p] = await t.prisma.raw.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*)::bigint AS n FROM proveedor`;
    const [pp] = await t.prisma.raw.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*)::bigint AS n FROM precio_proveedor`;
    expect(Number(p!.n)).toBe(0);
    expect(Number(pp!.n)).toBe(0);
  });

  it('CP-02.4c el rol de la aplicación no puede modificar ni borrar el historial de costos (RN-08)', async () => {
    const privilegios = await t.prisma.raw.$queryRaw<{ privilege_type: string }[]>`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_name = 'precio_proveedor' AND grantee = current_user`;
    expect(privilegios.map((p) => p.privilege_type).sort()).toEqual(['INSERT', 'SELECT']);
    await expect(
      t.prisma.raw.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.comercio_id', ${comercioA}, true)`;
        await tx.$executeRaw`DELETE FROM precio_proveedor WHERE comercio_id = ${comercioA}::uuid`;
      }),
    ).rejects.toThrow(/permission denied|permiso denegado/i);
  });

  it('CP-06.6c sin contexto la base no devuelve alertas y el rol de la aplicación no las borra', async () => {
    const [n] = await t.prisma.raw.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*)::bigint AS n FROM alerta`;
    expect(Number(n!.n)).toBe(0);
    const privilegios = await t.prisma.raw.$queryRaw<{ privilege_type: string }[]>`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_name = 'alerta' AND grantee = current_user`;
    expect(privilegios.map((p) => p.privilege_type).sort()).toEqual(['INSERT', 'SELECT', 'UPDATE']);
    await expect(
      t.prisma.raw.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.comercio_id', ${comercioA}, true)`;
        await tx.$executeRaw`DELETE FROM alerta WHERE comercio_id = ${comercioA}::uuid`;
      }),
    ).rejects.toThrow(/permission denied|permiso denegado/i);
  });

  it('CP-07.6c sin contexto la base no devuelve órdenes y el rol de la aplicación no las borra', async () => {
    const [n] = await t.prisma.raw.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*)::bigint AS n FROM orden_compra`;
    expect(Number(n!.n)).toBe(0);
    const privilegios = await t.prisma.raw.$queryRaw<{ privilege_type: string }[]>`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_name = 'orden_compra' AND grantee = current_user`;
    expect(privilegios.map((p) => p.privilege_type).sort()).toEqual(['INSERT', 'SELECT', 'UPDATE']);
    const items = await t.prisma.raw.$queryRaw<{ privilege_type: string }[]>`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_name = 'orden_compra_item' AND grantee = current_user`;
    expect(items.map((p) => p.privilege_type).sort()).toEqual([
      'DELETE',
      'INSERT',
      'SELECT',
      'UPDATE',
    ]);
    await expect(
      t.prisma.raw.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.comercio_id', ${comercioA}, true)`;
        await tx.$executeRaw`DELETE FROM orden_compra WHERE comercio_id = ${comercioA}::uuid`;
      }),
    ).rejects.toThrow(/permission denied|permiso denegado/i);
  });

  it('CP-09.6c sin contexto la base no devuelve reportes y el rol de la aplicación no los borra', async () => {
    const [n] = await t.prisma.raw.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*)::bigint AS n FROM reporte_semanal`;
    expect(Number(n!.n)).toBe(0);
    const privilegios = await t.prisma.raw.$queryRaw<{ privilege_type: string }[]>`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_name = 'reporte_semanal' AND grantee = current_user`;
    expect(privilegios.map((p) => p.privilege_type).sort()).toEqual(['INSERT', 'SELECT', 'UPDATE']);
    await expect(
      t.prisma.raw.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.comercio_id', ${comercioA}, true)`;
        await tx.$executeRaw`DELETE FROM reporte_semanal WHERE comercio_id = ${comercioA}::uuid`;
      }),
    ).rejects.toThrow(/permission denied|permiso denegado/i);
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
