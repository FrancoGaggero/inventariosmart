import { SensibleTestController } from './fixtures/sensible.controller';
import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

describe('user-roles: permisos, invitaciones y plan (e2e)', () => {
  let t: AppDePrueba;
  const duenio = persona('duenio');
  const ana = persona('ana'); // será invitada como EMPLEADO
  const luis = persona('luis'); // será invitado como CONTADOR
  let comercioId: string;
  let anaId: string;
  let luisId: string;

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const me = (p: { token: string }) => t.http().get('/api/v1/me').set(auth(p));

  beforeAll(async () => {
    t = await crearAppDePrueba([SensibleTestController]);
    const res = await me(duenio).expect(200);
    comercioId = res.body.comercio.id;
  });

  afterAll(async () => {
    await t.limpiar();
  });

  it('CP-11.7 en plan FREE la invitación responde 402 PLAN_REQUERIDO', async () => {
    const res = await t
      .http()
      .post('/api/v1/users')
      .set(auth(duenio))
      .send({ email: ana.email, rol: 'EMPLEADO' })
      .expect(402);
    expect(res.body).toMatchObject({ code: 'PLAN_REQUERIDO', details: { planMinimo: 'PRO' } });
  });

  it('CP-11.7b con plan PRO la invitación se crea (CP-11.3) y aparece como INVITADO', async () => {
    await t.prisma.comoSistema((tx) =>
      tx.comercio.update({ where: { id: comercioId }, data: { plan: 'PRO' } }),
    );
    const res = await t
      .http()
      .post('/api/v1/users')
      .set(auth(duenio))
      .send({ email: ana.email.toUpperCase(), rol: 'EMPLEADO' })
      .expect(201);
    expect(res.body).toMatchObject({ email: ana.email, rol: 'EMPLEADO', estado: 'INVITADO' });
    anaId = res.body.id;

    const lista = await t.http().get('/api/v1/users').set(auth(duenio)).expect(200);
    expect(lista.body.map((u: { email: string }) => u.email)).toEqual(
      expect.arrayContaining([duenio.email, ana.email]),
    );
  });

  it('CP-11.3e un email ya en uso responde 409 CONFLICTO', async () => {
    const res = await t
      .http()
      .post('/api/v1/users')
      .set(auth(duenio))
      .send({ email: ana.email, rol: 'CONTADOR' })
      .expect(409);
    expect(res.body.code).toBe('CONFLICTO');
  });

  it('CP-11.3b la invitada entra al comercio que la invitó, no crea uno nuevo', async () => {
    const res = await me(ana).expect(200);
    expect(res.body.comercio.id).toBe(comercioId);
    expect(res.body.rol).toBe('EMPLEADO');
    expect(res.body.usuario.estado).toBe('ACTIVO');
  });

  it('CP-11.4 EMPLEADO no accede a la configuración del comercio ni a usuarios', async () => {
    const c = await t.http().get('/api/v1/comercio').set(auth(ana)).expect(403);
    expect(c.body.code).toBe('SIN_PERMISO');
    await t.http().patch('/api/v1/comercio').set(auth(ana)).send({ nombre: 'Hack' }).expect(403);
  });

  it('CP-11.3f EMPLEADO no lista, invita ni modifica usuarios', async () => {
    await t.http().get('/api/v1/users').set(auth(ana)).expect(403);
    await t
      .http()
      .post('/api/v1/users')
      .set(auth(ana))
      .send({ email: luis.email, rol: 'EMPLEADO' })
      .expect(403);
    await t
      .http()
      .patch(`/api/v1/users/${anaId}`)
      .set(auth(ana))
      .send({ rol: 'DUENIO' })
      .expect(403);
  });

  it('CP-11.4b EMPLEADO no ve costos ni márgenes, ni anidados', async () => {
    const res = await t.http().get('/api/v1/_test/sensible').set(auth(ana)).expect(200);
    expect(res.body).toEqual({
      nombre: 'Filtro Aire FA-220',
      precioVenta: '3900.00',
      proveedor: { nombre: 'AutoParts' },
      historial: [{ fecha: '2026-09-01' }],
    });
    const completo = await t.http().get('/api/v1/_test/sensible').set(auth(duenio)).expect(200);
    expect(completo.body.costo).toBe('2340.00');
  });

  it('CP-11.4c CONTADOR lee el comercio pero no lo modifica', async () => {
    const inv = await t
      .http()
      .post('/api/v1/users')
      .set(auth(duenio))
      .send({ email: luis.email, rol: 'CONTADOR' })
      .expect(201);
    luisId = inv.body.id;
    await me(luis).expect(200);
    await t.http().get('/api/v1/comercio').set(auth(luis)).expect(200);
    const res = await t
      .http()
      .patch('/api/v1/comercio')
      .set(auth(luis))
      .send({ nombre: 'Otro' })
      .expect(403);
    expect(res.body.code).toBe('SIN_PERMISO');
  });

  it('CP-11.3c / CP-11.4d el cambio de rol aplica en la siguiente solicitud', async () => {
    await t
      .http()
      .patch(`/api/v1/users/${anaId}`)
      .set(auth(duenio))
      .send({ rol: 'CONTADOR' })
      .expect(200);
    const res = await me(ana).expect(200);
    expect(res.body.rol).toBe('CONTADOR');
    await t.http().get('/api/v1/comercio').set(auth(ana)).expect(200);
  });

  it('CP-11.3c desactivar y reactivar', async () => {
    await t
      .http()
      .patch(`/api/v1/users/${luisId}`)
      .set(auth(duenio))
      .send({ activo: false })
      .expect(200);
    await me(luis).expect(403);
    await t
      .http()
      .patch(`/api/v1/users/${luisId}`)
      .set(auth(duenio))
      .send({ activo: true })
      .expect(200);
    await me(luis).expect(200);
  });

  it('CP-11.3d el único dueño activo no puede degradarse ni darse de baja', async () => {
    const yo = await me(duenio).expect(200);
    const r1 = await t
      .http()
      .patch(`/api/v1/users/${yo.body.usuario.id}`)
      .set(auth(duenio))
      .send({ rol: 'EMPLEADO' })
      .expect(400);
    expect(r1.body.code).toBe('VALIDACION');
    expect(r1.body.message).toMatch(/dueño/);
    await t
      .http()
      .patch(`/api/v1/users/${yo.body.usuario.id}`)
      .set(auth(duenio))
      .send({ activo: false })
      .expect(400);

    // Con un segundo dueño, sí puede.
    await t
      .http()
      .patch(`/api/v1/users/${anaId}`)
      .set(auth(duenio))
      .send({ rol: 'DUENIO' })
      .expect(200);
    await t
      .http()
      .patch(`/api/v1/users/${yo.body.usuario.id}`)
      .set(auth(duenio))
      .send({ rol: 'CONTADOR' })
      .expect(200);
    expect((await me(duenio).expect(200)).body.rol).toBe('CONTADOR');
  });

  it('PATCH con id inexistente responde 404 y con body vacío 400', async () => {
    await t
      .http()
      .patch('/api/v1/users/00000000-0000-4000-8000-000000000000')
      .set(auth(ana))
      .send({ activo: false })
      .expect(404);
    await t.http().patch(`/api/v1/users/${luisId}`).set(auth(ana)).send({}).expect(400);
  });
});
