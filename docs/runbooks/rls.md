# Runbook · Row Level Security por comercio

Toda tabla de negocio lleva `comercio_id` y una política de PostgreSQL que sólo deja ver y escribir
filas del comercio fijado en la variable de sesión `app.comercio_id`. La API la fija con
`set_config('app.comercio_id', <uuid>, true)` al inicio de cada transacción (el tercer parámetro
`true` la limita a esa transacción, así el pooler de Neon no la arrastra entre conexiones).

Dos funciones auxiliares viven en la base (migración `20260911_auth_tenancy`):

- `app_comercio_actual()` → uuid del comercio de la transacción, o NULL.
- `app_es_sistema()` → true cuando `app.rol_sistema = 'provisioning'`; lo usa sólo el alta de
  comercio y, en el futuro, los jobs programados.

## Dos roles de base

| Rol            | Quién lo usa                           | Por qué                                                                                           |
| -------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `neondb_owner` | `prisma migrate deploy` (`DIRECT_URL`) | Propietaria de las tablas. Es miembro de `neon_superuser`, que tiene `BYPASSRLS`: **ignora RLS**. |
| `app_api`      | la API en runtime (`DATABASE_URL`)     | `NOBYPASSRLS`: las políticas se aplican. Sólo `SELECT/INSERT/UPDATE/DELETE` sobre las tablas.     |

Crear el rol una vez por rama de Neon (dev y production), como `neondb_owner`:

```sql
CREATE ROLE app_api LOGIN PASSWORD '<clave-fuerte>' NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT USAGE ON SCHEMA public TO app_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_api;
REVOKE ALL ON TABLE _prisma_migrations FROM app_api;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_api;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_api;
```

La cadena de `DATABASE_URL` es la misma de Neon reemplazando `neondb_owner:<clave>` por `app_api:<clave>`.
`FORCE ROW LEVEL SECURITY` se mantiene igual como defensa adicional.

## Checklist para una tabla nueva

1. En `schema.prisma`, la tabla tiene `comercioId String @map("comercio_id") @db.Uuid` y un índice
   que empieza por `comercio_id`.
2. El modelo está en `TENANT_MODELS` (`apps/api/src/prisma/tenant.extension.ts`), así la extensión
   inyecta `comercio_id` en cada consulta.
3. La migración incluye este bloque (reemplazar `TABLA`):

```sql
ALTER TABLE "TABLA" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TABLA" FORCE ROW LEVEL SECURITY;
CREATE POLICY tabla_tenant ON "TABLA"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY tabla_sistema ON "TABLA"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());
```

4. El test e2e `rls.e2e-spec.ts` verifica `relforcerowsecurity = true` para cada modelo de
   `TENANT_MODELS`: falla si se olvida el paso 3.

## Verificación manual

```sql
-- Sin contexto: 0 filas aunque haya datos.
SELECT count(*) FROM usuario;
-- Con contexto: sólo el comercio indicado.
SELECT set_config('app.comercio_id', '<uuid>', false); SELECT email FROM usuario;
-- Como sistema: todo.
SELECT set_config('app.rol_sistema', 'provisioning', false); SELECT count(*) FROM usuario;
```

## Rollback de una política

```sql
DROP POLICY IF EXISTS tabla_tenant ON "TABLA";
DROP POLICY IF EXISTS tabla_sistema ON "TABLA";
ALTER TABLE "TABLA" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "TABLA" DISABLE ROW LEVEL SECURITY;
```

Las columnas agregadas por la migración (`onboarding_pendiente`, `firebase_uid` nulo, índice único
de `email`) son aditivas y no requieren rollback.
