import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7: la URL ya no vive en schema.prisma sino en este archivo.
// DIRECT_URL evita el pooler (PgBouncer) para migraciones; si no está o está vacía, usa DATABASE_URL.
const limpiar = (v: string | undefined) => v?.trim().replace(/^["']|["']$/g, '') || undefined;
const url = limpiar(process.env['DIRECT_URL']) ?? limpiar(process.env['DATABASE_URL']) ?? '';

if (url && !/^postgres(ql)?:\/\//.test(url)) {
  throw new Error(
    `DIRECT_URL/DATABASE_URL inválida: debe empezar con postgresql:// (recibido: "${url.slice(0, 20)}…")`,
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: { url },
});
