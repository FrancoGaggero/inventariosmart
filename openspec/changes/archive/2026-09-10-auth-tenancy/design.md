## Context

Estado tras el sprint 0 (archivado): guard global `FirebaseAuthGuard` que verifica el ID token y deja `{ uid, email }` en `req.user`; `PrismaService` sin noción de tenant; tablas `comercio` y `usuario` vacías (`usuario.firebase_uid` obligatorio y único). Web con login y una pantalla de prueba. Motivación en proposal.md - Why; comportamiento en `specs/auth-tenancy` y `specs/user-roles`.

Restricción clave descubierta al preparar este diseño: en Neon la aplicación se conecta como `neondb_owner`, **propietario de las tablas**, y PostgreSQL no aplica RLS al propietario salvo que la tabla tenga `FORCE ROW LEVEL SECURITY`.

## Goals / Non-Goals

**Goals:**
- Que ninguna consulta futura de negocio pueda olvidar el filtro por comercio: la extensión de Prisma lo inyecta y RLS lo garantiza en la base.
- Un solo lugar donde se resuelve "quién es, de qué comercio, con qué rol y plan": el guard de autenticación, una vez por request.
- Contrato OpenAPI de `/me`, `/comercio` y `/users` estable para que `mobile-mvp` lo consuma sin cambios.

**Non-Goals:**
- Cambio de plan, límite de 50 productos, bloqueo de funciones por plan más allá del límite de usuarios (change `subscription-plans`).
- Emails de invitación: el invitado simplemente inicia sesión con el email invitado. El envío de correo llega con `restock-alerts` (Resend).
- Pantallas mobile.

## Decisions

**D1 · Provisionamiento en el guard, idempotente y transaccional.**
`FirebaseAuthGuard` delega en `AuthProvisioningService.resolver(identidad)`: (1) busca `usuario` por `firebase_uid`; (2) si no existe, busca por `email` con `firebase_uid IS NULL` (invitación pendiente) y vincula; (3) si tampoco, crea `comercio` (plan FREE, `nombre = "Comercio de <nombre o email>"`, `onboarding_pendiente = true`) y `usuario` DUENIO en una transacción. Las tres ramas corren con el contexto `app.rol_sistema = 'provisioning'` (ver D3). Dos requests simultáneos del mismo uid no duplican: el índice único de `firebase_uid` hace fallar al segundo, que reintenta la lectura. Resultado en `req.user: { usuarioId, comercioId, rol, plan, activo, email, uid }`.
Alternativa descartada: endpoint explícito `POST /auth/register` — el login con Google no pasa por un formulario y dejaría comercios sin crear.

**D2 · Contexto de tenant con `AsyncLocalStorage` y extensión de Prisma.**
`TenantContext` guarda `{ comercioId, usuarioId, rol, plan }` por request. **Corrección (11/09/2026):** `enterWith` desde el guard no alcanza al handler (Nest ejecuta guards y controlador en continuaciones asíncronas distintas); por eso un middleware Express abre un almacén vacío con `als.run` antes de los guards y el guard lo completa con `Object.assign`. Mismo patrón que `nestjs-cls`. `PrismaService.tenant` es un cliente extendido (`$extends`) que, para los modelos listados en `TENANT_MODELS`, agrega `where: { comercioId }` en lecturas, updates y deletes, y `data: { comercioId }` en creates. El cliente sin extender queda como `PrismaService.raw` y sólo lo usa el provisioning. Regla de código: los módulos de negocio importan `prisma.tenant`; un lint rule (`no-restricted-syntax`) prohíbe `prisma.raw` fuera de `auth/`.

**D3 · RLS con `SET LOCAL` por transacción y `FORCE ROW LEVEL SECURITY`.**
Migración SQL manual (Prisma no modela políticas): para `usuario` y para cada tabla de negocio futura, `ENABLE` + `FORCE ROW LEVEL SECURITY` y una política `USING (comercio_id = current_setting('app.comercio_id', true)::uuid)` para SELECT/UPDATE/DELETE y `WITH CHECK` para INSERT. Una segunda política permite todo cuando `current_setting('app.rol_sistema', true) = 'provisioning'`, usada exclusivamente por D1 y por los jobs futuros. `comercio` lleva la política `id = current_setting('app.comercio_id', true)::uuid`. La extensión de D2 ejecuta cada operación dentro de `$transaction([ $executeRaw SELECT set_config('app.comercio_id', $1, true), operación ])`, así el ajuste vive sólo en esa transacción y el pool de Neon no lo arrastra entre conexiones. Prueba CP-11.5c: un `SELECT` con `psql` como `neondb_owner` sin `set_config` devuelve 0 filas.
**Corrección durante la implementación (11/09/2026):** `FORCE` no alcanza. En Neon, `neondb_owner` es miembro de `neon_superuser`, que tiene `BYPASSRLS`, así que las políticas se ignoran por completo con ese rol (verificado con `psql`: sin contexto devolvía todas las filas). Por eso la API se conecta en runtime con un rol propio **`app_api`** (`LOGIN NOBYPASSRLS NOSUPERUSER`, con `SELECT/INSERT/UPDATE/DELETE` sobre las tablas de negocio y `ALTER DEFAULT PRIVILEGES` para las futuras), creado con SQL en las ramas `dev` y `production`. `DATABASE_URL` lleva las credenciales de `app_api` (pooled); `DIRECT_URL` sigue siendo `neondb_owner` y sólo la usa `prisma migrate deploy`. En CI, `postgres` es superusuario: el workflow crea `app_api` antes de los e2e. La contraseña del rol vive en la carpeta de secretos y en Render, nunca en el repo.

**D4 · Roles y plan como guards declarativos, campos sensibles como interceptor.**
`@Roles('DUENIO')` → `RolesGuard`; `@RequierePlan('PRO')` → `PlanGuard` (usa `planCumple` de `shared`); ambos leen `req.user`. `SensitiveFieldsInterceptor` elimina las claves `costo*`, `margen*` de cualquier respuesta cuando `rol === 'EMPLEADO'`; hoy no hay recursos con esos campos, pero el interceptor queda montado y probado con un DTO de prueba para que `product-catalog` no tenga que recordarlo. Orden de guards: Throttler → FirebaseAuth (provisiona y bloquea inactivos con 403) → Roles → Plan.

**D5 · Modelo de datos.**
`usuario.firebase_uid` nullable (sigue único); `usuario.email` único global (índice `usuario_email_key`), en minúsculas; nuevo `comercio.onboarding_pendiente boolean default true`. Estado del usuario derivado: `invitado` si `firebase_uid IS NULL`, `activo`/`inactivo` según `activo`. Sin borrado físico de usuarios (auditoría). La restricción "al menos un DUENIO activo" se valida en el servicio dentro de una transacción con `SELECT … FOR UPDATE` sobre los dueños del comercio.

**D6 · Endpoints (todos bajo `/api/v1`, Bearer obligatorio).**

| Método y ruta | Roles | Plan mínimo | Notas |
| --- | --- | --- | --- |
| `GET /me` | todos | FREE | usuario + comercio + rol + plan + `onboardingPendiente` |
| `POST /me/onboarding` | DUENIO | FREE | `{ nombreComercio }`; idempotente |
| `GET /comercio` | DUENIO, CONTADOR | FREE | |
| `PATCH /comercio` | DUENIO | FREE | `{ nombre?, cuit?, ivaDefault? }` |
| `GET /users` | DUENIO | FREE | incluye estado derivado |
| `POST /users` | DUENIO | FREE (bloquea al 2.º usuario), PRO | `{ email, rol }` → 201; 409 `CONFLICTO` si el email existe |
| `PATCH /users/:id` | DUENIO | FREE | `{ rol?, activo? }`; 400 si deja al comercio sin dueño |

Código de error nuevo en `shared`: `CONFLICTO` (409). DTOs con `zod` en `packages/shared` (`OnboardingSchema`, `ComercioPatchSchema`, `InvitacionSchema`, `UsuarioPatchSchema`) y un `ZodValidationPipe` en la API que traduce errores a `VALIDACION` con `details` por campo.

**D7 · Web.**
Rutas nuevas: `/registro` (nombre del comercio, email, contraseña → `createUserWithEmailAndPassword` → `POST /me/onboarding`), `/onboarding` (para quien entró con Google y tiene `onboardingPendiente`), `/configuracion/usuarios` (sólo DUENIO). `useMe()` (TanStack Query) alimenta un `AuthGate` que redirige según `onboardingPendiente` y `rol`; `RequireRole` envuelve las rutas por rol. Errores 402 muestran un aviso "Disponible en el plan PRO"; 403, "No tenés permiso". La pantalla de prueba del sprint 0 se reemplaza por un inicio mínimo con comercio, rol y plan hasta que llegue HU-04.

## Risks / Trade-offs

- [Cada operación Prisma abre una transacción por el `SET LOCAL`] → Costo de un round-trip extra por operación; aceptable para RNF-04 (medido en el sprint 0: health con base en 0,65 s desde Render). Las operaciones compuestas usan una única transacción interactiva con el `set_config` al inicio.
- [Olvidar `FORCE` en una tabla nueva deja RLS inactivo para el propietario] → Test e2e genérico que recorre `TENANT_MODELS` y verifica en `pg_class` que `relforcerowsecurity = true`; falla si una tabla futura lo omite.
- [Email de Google en mayúsculas o con alias] → Se normaliza a minúsculas al vincular invitaciones; los alias `+` no se tratan especialmente.
- [Un DUENIO podría invitarse a sí mismo o invitar un email que después nunca ingresa] → Los invitados cuentan para el límite del plan; el DUENIO puede desactivarlos.
- [Los tests e2e dependen de la rama `dev` de Neon (decisión D2 del sprint 0)] → CI usa PostgreSQL efímero; localmente los tests crean comercios con prefijo `test-` y los limpian al terminar.

## Migration Plan

1. Migración Prisma `20260911_auth_tenancy` (columnas y unicidad) seguida de un archivo SQL en la misma migración con las políticas RLS.
2. `prisma migrate deploy` corre solo en Render al desplegar; antes, aplicar en `dev` desde local y correr los e2e.
3. Rollback: las columnas nuevas son aditivas; las políticas se eliminan con `DROP POLICY` si hiciera falta (script en `docs/runbooks/rls.md`).

## Open Questions

- Texto exacto del nombre provisorio del comercio ("Comercio de Franco" vs. "Mi comercio"): decisión de copy que no cambia specs ni tareas.
