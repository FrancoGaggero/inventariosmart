import { config } from 'dotenv';
import { resolve } from 'node:path';

// Los e2e usan .env.test si existe (base de pruebas), si no el .env de desarrollo.
config({ path: resolve(__dirname, '../.env.test') });
config({ path: resolve(__dirname, '../.env') });

process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error';
// El verificador de Firebase se reemplaza por un doble en los tests: la credencial real no hace falta.
delete process.env['FIREBASE_SERVICE_ACCOUNT_JSON'];
