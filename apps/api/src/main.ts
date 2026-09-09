import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { crearApp, crearDocumentoOpenApi } from './bootstrap';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await crearApp();
  const config = app.get(ConfigService<Env, true>);

  // Documentación interactiva en /docs (fuera del prefijo /api/v1).
  SwaggerModule.setup('docs', app, crearDocumentoOpenApi(app), {
    customSiteTitle: 'InventarioSmart API',
    jsonDocumentUrl: 'docs/openapi.json',
  });

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  app.get(Logger).log(`API escuchando en http://localhost:${port}/api/v1 · docs en /docs`);
}

void bootstrap();
