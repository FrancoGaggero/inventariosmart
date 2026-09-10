# ADR 0002 · Multi-tenencia por `comercio_id` con Row Level Security

**Estado:** aceptada · 09/09/2026

## Contexto

El tenant es el Comercio (Propuesta v2.0 §2.3). RNF-10 exige que ninguna consulta pueda devolver datos de otro comercio; RN-10 fija que un usuario pertenece a un único comercio. Se esperan muchos comercios pequeños sobre una misma instancia.

## Decisión

Base única, esquema único, fila discriminada: toda tabla de negocio lleva `comercio_id`. El aislamiento se aplica en dos capas independientes:

1. **API:** un guard fija el comercio del usuario en el contexto del request y una extensión de Prisma inyecta `where comercio_id = …` en cada consulta y `comercio_id` en cada inserción.
2. **PostgreSQL:** Row Level Security con políticas `comercio_id = current_setting('app.comercio_id')::uuid`; la API abre cada transacción con `SET LOCAL app.comercio_id`.

Un test e2e crea dos comercios y verifica que ningún endpoint devuelve datos cruzados.

## Alternativas consideradas

- **Un esquema de PostgreSQL por comercio:** aislamiento fuerte pero migraciones por esquema, conexiones más complejas y mal soporte en Prisma.
- **Una base por comercio:** inviable en costo y operación para el segmento PyME con plan Free.
- **Sólo filtro en la API, sin RLS:** un olvido en una consulta filtra datos; RLS es la red de seguridad.

## Consecuencias

- Índices compuestos `(comercio_id, …)` en todas las tablas de negocio.
- Implementado en la change `auth-tenancy` (11/09/2026) con dos ajustes respecto del plan original:
  - El rol propietario de Neon (`neondb_owner`) tiene `BYPASSRLS`, por lo que la API corre con un rol
    propio `app_api` (`NOBYPASSRLS`) y las migraciones con la propietaria. Las tablas llevan además
    `FORCE ROW LEVEL SECURITY`.
  - El alta del comercio ocurre antes de que exista el tenant: una política de sistema
    (`app.rol_sistema = 'provisioning'`) habilita esa transacción y, en el futuro, los jobs.
- El contexto de tenant se abre en un middleware Express (AsyncLocalStorage) y lo completa el guard de
  autenticación; la extensión de Prisma inyecta `comercio_id` y fija `app.comercio_id` por transacción.
- Checklist para tablas nuevas y verificación manual: `docs/runbooks/rls.md`.
- Sucursal se modela como entidad prevista (§2.2.1) sin funcionalidad.
