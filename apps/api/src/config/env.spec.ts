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

  it('el asistente es opcional: sin clave la API arranca con el modelo y el límite por defecto', () => {
    const env = validateEnv(base);
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_MODEL).toBe('claude-sonnet-5');
    expect(env.ASISTENTE_LIMITE_DIARIO).toBe(50);
    expect(validateEnv({ ...base, ANTHROPIC_API_KEY: '' }).ANTHROPIC_API_KEY).toBe('');
  });

  it('toma la clave, el modelo y el límite del asistente cuando están', () => {
    const env = validateEnv({
      ...base,
      ANTHROPIC_API_KEY: ' clave-de-prueba ',
      ANTHROPIC_MODEL: 'claude-opus-5-5',
      ASISTENTE_LIMITE_DIARIO: '20',
    });
    expect(env.ANTHROPIC_API_KEY).toBe('clave-de-prueba');
    expect(env.ANTHROPIC_MODEL).toBe('claude-opus-5-5');
    expect(env.ASISTENTE_LIMITE_DIARIO).toBe(20);
    expect(() => validateEnv({ ...base, ASISTENTE_LIMITE_DIARIO: '0' })).toThrow(
      /ASISTENTE_LIMITE_DIARIO/,
    );
  });

  it('rechaza un PORT no numérico', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });
});
