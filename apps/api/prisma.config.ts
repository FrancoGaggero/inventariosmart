import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7: la URL ya no vive en schema.prisma sino en este archivo.
// DIRECT_URL evita el pooler (PgBouncer) para migraciones; si no está, usa DATABASE_URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'] ?? '',
  },
});
