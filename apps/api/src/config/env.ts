import { z } from 'zod';

/**
 * Variables de entorno validadas al arrancar. Si falta algo, la API no levanta
 * y el error dice exactamente qué variable está mal.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  DIRECT_URL: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  /** Correo transaccional (HU-06). Sin API key, los envíos se registran en el log. */
  RESEND_API_KEY: z.string().trim().optional(),
  MAIL_FROM: z.string().trim().min(3).default('InventarioSmart <onboarding@resend.dev>'),
  /** URL de la web publicada, para los enlaces de los correos. */
  WEB_URL: z.string().url().default('https://inventariosmart0.vercel.app'),
  /** Fuentes públicas de indicadores económicos (HU-15); sin credenciales. */
  INDEC_API_URL: z.string().url().default('https://apis.datos.gob.ar/series/api'),
  BCRA_API_URL: z.string().url().default('https://api.bcra.gob.ar/estadisticas/v4.0'),
  /** Asistente con IA (HU-08). Sin API key, el asistente responde 503 y el resto funciona igual. */
  ANTHROPIC_API_KEY: z.string().trim().optional(),
  ANTHROPIC_MODEL: z.string().trim().min(1).default('claude-sonnet-5'),
  /** Mensajes al asistente por día y por comercio. */
  ASISTENTE_LIMITE_DIARIO: z.coerce.number().int().min(1).max(1000).default(50),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const detalle = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida: ${detalle}`);
  }
  return result.data;
}
