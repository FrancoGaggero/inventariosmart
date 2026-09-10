## Why

Toda historia de la Fase 1 (inventario, movimientos, proveedores, gastos, dashboard) opera sobre datos de un comercio y con permisos por rol. Hoy la API sólo verifica el token de Firebase y devuelve `uid` y `email` sin persistir nada (prueba de humo del sprint 0). Sin comercio, rol ni aislamiento por tenant no se puede construir ninguna otra capacidad, y RNF-10 exige que el aislamiento esté garantizado desde la primera tabla de negocio.

Cubre **HU-11** (RF-11) en la **Fase 1 – MVP**, y las reglas RN-10 (un usuario, un comercio), RNF-03 (OAuth 2.0 y control por roles) y RNF-10 (aislamiento total entre comercios). Toma prestado de HU-14 sólo el límite de 1 usuario del plan Free, porque la invitación de usuarios lo necesita; el resto de la gestión de planes queda para la change `subscription-plans`.

## What Changes

- **Alta automática del comercio.** La primera vez que una identidad válida de Firebase llega a la API se crea su Comercio (plan FREE) y su Usuario con rol DUENIO, sin pasos adicionales. `GET /api/v1/me` pasa a devolver usuario, comercio, rol y plan.
- **Registro con nombre del comercio.** La web incorpora la pantalla de registro (nombre del comercio, email, contraseña) y `POST /api/v1/me/onboarding` guarda el nombre elegido; también se puede editar después con `PATCH /api/v1/comercio`.
- **Contexto de tenant.** Cada request autenticado fija `comercio_id` en el contexto; una extensión de Prisma filtra e inyecta ese valor en toda consulta de modelos con `comercio_id`.
- **Row Level Security.** Políticas de PostgreSQL sobre `usuario` (y sobre toda tabla de negocio futura) que comparan `comercio_id` con `current_setting('app.comercio_id')`, forzadas también para el rol propietario de la base.
- **Roles y permisos.** Guard `@Roles(...)` con los tres roles de la Propuesta §2.4; interceptor que omite campos sensibles (costo, margen) para EMPLEADO; usuarios inactivos rechazados.
- **Gestión de usuarios del comercio.** `GET/POST /api/v1/users`, `PATCH /api/v1/users/:id` (rol, activo) para el DUENIO, con invitación por email: el invitado entra con Google o email y queda vinculado al comercio en lugar de crear uno nuevo. Guard `@RequierePlan(...)` con el límite de 1 usuario del plan FREE.
- **Web.** Registro, onboarding del nombre del comercio, cabecera con comercio/rol/plan, página **Usuarios** (sólo DUENIO) para invitar, cambiar rol y desactivar; manejo de los errores 403 y 402 en la interfaz.
- **Modelo de datos.** `usuario.firebase_uid` pasa a ser opcional (invitación pendiente) y `usuario.email` único a nivel global (RN-10). Migración aditiva.

Supuesto registrado: el "alta del comercio" del registro se resuelve creando el comercio con un nombre provisorio al primer ingreso y completándolo en el onboarding; así el login con Google (sin formulario de registro) también deja un comercio usable. La app Flutter no cambia en este change (sólo consume `/health`); el login mobile llega en `mobile-mvp`.

## Capabilities

### New Capabilities

- `auth-tenancy`: identidad verificada por Firebase, alta automática del comercio, contexto de tenant y aislamiento de datos entre comercios.
- `user-roles`: roles DUENIO / EMPLEADO / CONTADOR, permisos por función, gestión de usuarios del comercio (invitación, cambio de rol, baja) y límite de usuarios del plan FREE.

### Modified Capabilities

Ninguna (no existen specs previos).

## Impact

- **Código:** `apps/api` módulos `auth` (provisioning, tenant context, guards, decorators), `prisma` (extensión de tenant, migración con RLS), `me`, nuevo `users` y `comercio`; `packages/shared` (esquemas zod de usuario, comercio, invitación); `packages/api-client` regenerado; `apps/web` (registro, onboarding, usuarios, cabecera).
- **API:** `GET /me` cambia de forma (deja de ser `{ uid, email }`); rutas nuevas `POST /me/onboarding`, `PATCH /comercio`, `GET/POST/PATCH /users`. **BREAKING** sólo respecto de la prueba de humo del sprint 0, que no tiene consumidores.
- **Base de datos:** migración `usuario` (firebase_uid opcional, email único) y políticas RLS. Se aplica en Neon `dev` y `production` con `prisma migrate deploy`.
- **Trazabilidad:** CU-11, casos de prueba CP-11.1 a CP-11.5 más los de aislamiento y plan. Fuera de alcance: recuperación de contraseña por email (lo hace Firebase), eliminación física de usuarios, Sucursal, y todo lo de HU-14 salvo el límite de usuarios.
