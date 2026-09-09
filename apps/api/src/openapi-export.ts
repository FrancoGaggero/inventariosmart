import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { crearApp, crearDocumentoOpenApi } from './bootstrap';

/**
 * Exporta el contrato OpenAPI a docs/openapi.json (raíz del monorepo).
 * CI verifica que el archivo esté al día respecto del código.
 */
async function main(): Promise<void> {
  process.env['NODE_ENV'] ??= 'test';
  process.env['DATABASE_URL'] ??= 'postgresql://openapi:openapi@localhost:5432/openapi';
  process.env['LOG_LEVEL'] = 'error';

  const app = await crearApp();
  const doc = crearDocumentoOpenApi(app);
  const destino = resolve(__dirname, '../../../docs/openapi.json');
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  await app.close();
  console.log(`OpenAPI exportado a ${destino} (${Object.keys(doc.paths).length} rutas)`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
