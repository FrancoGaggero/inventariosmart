import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './config/env';

export const API_PREFIX = 'api/v1';

/** Crea la aplicación con toda la configuración transversal, sin escuchar en un puerto. */
export async function crearApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configurarApp(app);
  return app;
}

/** Configuración compartida entre main.ts y los tests e2e. */
export function configurarApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  });
  app.enableShutdownHooks();
}

export function crearDocumentoOpenApi(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('InventarioSmart API')
    .setDescription(
      'API REST de InventarioSmart. Todas las rutas salvo /health requieren `Authorization: Bearer <ID token de Firebase>`.',
    )
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addServer('http://localhost:3000', 'Desarrollo local')
    .build();
  return SwaggerModule.createDocument(app, builder);
}
