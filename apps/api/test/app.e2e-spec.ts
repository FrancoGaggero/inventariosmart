import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TokenVerifier } from '../src/auth/firebase.service';
import { configurarApp } from '../src/bootstrap';
import type { AuthUser } from '../src/common/decorators/current-user.decorator';

/** Doble del verificador: acepta un único token conocido. */
class VerificadorSimulado extends TokenVerifier {
  async verificar(idToken: string): Promise<AuthUser> {
    if (idToken === 'token-valido')
      return { uid: 'uid-carlos', email: 'carlos@repuestoscarlos.com.ar' };
    throw new Error('token inválido');
  }
}

describe('API sprint 0 (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenVerifier)
      .useClass(VerificadorSimulado)
      .compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('responde 200 con status ok y la base conectada', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
      expect(typeof res.body.timestamp).toBe('string');
    });

    it('no exige token (ruta pública)', async () => {
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    });
  });

  describe('formato de errores', () => {
    it('una ruta inexistente responde 404 con { code, message }', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/ruta-inexistente')
        .set('Authorization', 'Bearer token-valido')
        .expect(404);
      expect(res.body).toEqual({
        code: 'NO_ENCONTRADO',
        message: expect.any(String),
      });
    });
  });

  describe('GET /api/v1/me', () => {
    it('sin token responde 401 NO_AUTENTICADO', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/me').expect(401);
      expect(res.body.code).toBe('NO_AUTENTICADO');
      expect(typeof res.body.message).toBe('string');
    });

    it('con token inválido responde 401 NO_AUTENTICADO', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', 'Bearer cualquier-cosa')
        .expect(401);
      expect(res.body.code).toBe('NO_AUTENTICADO');
    });

    it('con token válido responde 200 con uid y email', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', 'Bearer token-valido')
        .expect(200);
      expect(res.body).toEqual({ uid: 'uid-carlos', email: 'carlos@repuestoscarlos.com.ar' });
    });
  });
});
