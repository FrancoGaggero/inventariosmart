import { type AppDePrueba, crearAppDePrueba, persona } from './helpers';

describe('API base (e2e)', () => {
  let t: AppDePrueba;
  const carlos = persona('carlos-base');

  beforeAll(async () => {
    t = await crearAppDePrueba();
  });

  afterAll(async () => {
    await t.limpiar();
  });

  describe('GET /api/v1/health', () => {
    it('responde 200 con status ok y la base conectada, sin token', async () => {
      const res = await t.http().get('/api/v1/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
      expect(typeof res.body.timestamp).toBe('string');
    });
  });

  describe('formato de errores', () => {
    it('una ruta inexistente responde 404 con { code, message } en español', async () => {
      const res = await t
        .http()
        .get('/api/v1/ruta-inexistente')
        .set('Authorization', `Bearer ${carlos.token}`)
        .expect(404);
      expect(res.body).toEqual({ code: 'NO_ENCONTRADO', message: expect.any(String) });
      expect(res.body.message).not.toMatch(/Cannot GET/);
    });

    it('un body inválido responde 400 VALIDACION con details por campo', async () => {
      const res = await t
        .http()
        .post('/api/v1/me/onboarding')
        .set('Authorization', `Bearer ${carlos.token}`)
        .send({ nombreComercio: ' ' })
        .expect(400);
      expect(res.body.code).toBe('VALIDACION');
      expect(res.body.details).toHaveProperty('nombreComercio');
    });
  });
});
