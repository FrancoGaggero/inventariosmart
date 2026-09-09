import { validateEnv } from './env';

describe('validateEnv', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

  it('aplica valores por defecto', () => {
    const env = validateEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('separa CORS_ORIGINS por coma y recorta espacios', () => {
    const env = validateEnv({
      ...base,
      CORS_ORIGINS: 'https://a.vercel.app, http://localhost:5173 ,',
    });
    expect(env.CORS_ORIGINS).toEqual(['https://a.vercel.app', 'http://localhost:5173']);
  });

  it('falla con un mensaje claro si falta DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rechaza un PORT no numérico', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });
});
