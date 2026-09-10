import { type AppDePrueba, crearAppDePrueba, persona, UUID_V4 } from './helpers';

describe('auth-tenancy: identidad, alta del comercio, onboarding (e2e)', () => {
  let t: AppDePrueba;
  const carlos = persona('carlos');
  const google = persona('google'); // simula ingreso con Google (mismo verificador)

  beforeAll(async () => {
    t = await crearAppDePrueba();
  });

  afterAll(async () => {
    await t.limpiar();
  });

  const me = (token: string) => t.http().get('/api/v1/me').set('Authorization', `Bearer ${token}`);

  it('CP-11.1c sin token responde 401 NO_AUTENTICADO', async () => {
    const res = await t.http().get('/api/v1/me').expect(401);
    expect(res.body.code).toBe('NO_AUTENTICADO');
  });

  it('CP-11.1c token alterado responde 401 NO_AUTENTICADO', async () => {
    const res = await me('cualquier-cosa').expect(401);
    expect(res.body.code).toBe('NO_AUTENTICADO');
  });

  it('CP-11.2 el primer ingreso crea comercio FREE y usuario DUENIO con onboarding pendiente', async () => {
    const res = await me(carlos.token).expect(200);
    expect(res.body).toMatchObject({
      rol: 'DUENIO',
      plan: 'FREE',
      onboardingPendiente: true,
      usuario: { email: carlos.email, rol: 'DUENIO', activo: true, estado: 'ACTIVO' },
      comercio: { plan: 'FREE', onboardingPendiente: true, moneda: 'ARS', ivaDefault: '21' },
    });
    expect(res.body.comercio.nombre).toContain('Comercio de');
    // CP-11.5d: identificadores UUID v4
    expect(res.body.usuario.id).toMatch(UUID_V4);
    expect(res.body.comercio.id).toMatch(UUID_V4);
  });

  it('CP-11.1 / CP-11.1b ingresos posteriores devuelven el mismo comercio (Google o email)', async () => {
    const a = await me(carlos.token).expect(200);
    const b = await me(carlos.token).expect(200);
    expect(b.body.comercio.id).toBe(a.body.comercio.id);
    expect(b.body.usuario.id).toBe(a.body.usuario.id);
  });

  it('CP-11.2b dos ingresos simultáneos de una identidad nueva no duplican comercio', async () => {
    const [r1, r2, r3] = await Promise.all([
      me(google.token),
      me(google.token),
      me(google.token),
    ]);
    for (const r of [r1, r2, r3]) expect(r.status).toBe(200);
    const ids = new Set([r1.body.comercio.id, r2.body.comercio.id, r3.body.comercio.id]);
    expect(ids.size).toBe(1);
    const cuantos = await t.prisma.comoSistema((tx) =>
      tx.usuario.count({ where: { email: google.email } }),
    );
    expect(cuantos).toBe(1);
  });

  it('CP-11.2c el onboarding fija el nombre del comercio y cierra el pendiente', async () => {
    const res = await t
      .http()
      .post('/api/v1/me/onboarding')
      .set('Authorization', `Bearer ${carlos.token}`)
      .send({ nombreComercio: '  Repuestos Carlos  ' })
      .expect(200);
    expect(res.body.comercio.nombre).toBe('Repuestos Carlos');
    expect(res.body.onboardingPendiente).toBe(false);

    const otra = await me(carlos.token).expect(200);
    expect(otra.body.comercio.nombre).toBe('Repuestos Carlos');
    expect(otra.body.onboardingPendiente).toBe(false);
  });

  it('CP-11.2c nombre vacío responde 400 VALIDACION', async () => {
    const res = await t
      .http()
      .post('/api/v1/me/onboarding')
      .set('Authorization', `Bearer ${carlos.token}`)
      .send({ nombreComercio: '' })
      .expect(400);
    expect(res.body.code).toBe('VALIDACION');
  });

  it('CP-11.2d el dueño edita nombre, CUIT e IVA; GET /comercio los devuelve', async () => {
    const res = await t
      .http()
      .patch('/api/v1/comercio')
      .set('Authorization', `Bearer ${carlos.token}`)
      .send({ cuit: '20123456789', ivaDefault: 10.5 })
      .expect(200);
    expect(res.body).toMatchObject({ nombre: 'Repuestos Carlos', cuit: '20123456789', ivaDefault: '10.5' });

    const get = await t
      .http()
      .get('/api/v1/comercio')
      .set('Authorization', `Bearer ${carlos.token}`)
      .expect(200);
    expect(get.body.cuit).toBe('20123456789');

    const malo = await t
      .http()
      .patch('/api/v1/comercio')
      .set('Authorization', `Bearer ${carlos.token}`)
      .send({ cuit: '20-12345678-9' })
      .expect(400);
    expect(malo.body.details).toHaveProperty('cuit');
  });

  it('CP-11.6 un usuario dado de baja recibe 403 aunque su token sea válido', async () => {
    await t.prisma.comoSistema((tx) =>
      tx.usuario.update({ where: { email: google.email }, data: { activo: false } }),
    );
    const res = await me(google.token).expect(403);
    expect(res.body.code).toBe('SIN_PERMISO');
    expect(res.body.message).toMatch(/baja/);
  });
});
