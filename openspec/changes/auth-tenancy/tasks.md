## 1. Modelo de datos y RLS

- [x] 1.1 Actualizar `schema.prisma`: `usuario.firebaseUid` opcional (único), `usuario.email` único global, `comercio.onboardingPendiente` (default true); generar la migración `auth_tenancy` con `prisma migrate dev --create-only`. Listo cuando: la migración contiene las tres alteraciones y `prisma migrate deploy` la aplica en la rama `dev` de Neon sin errores
- [x] 1.2 Agregar al SQL de la migración las políticas RLS de `comercio` y `usuario` con `ENABLE` + `FORCE ROW LEVEL SECURITY`, políticas por `app.comercio_id` y política de bypass por `app.rol_sistema = 'provisioning'`. Listo cuando: `psql` como `neondb_owner` sin `set_config` devuelve 0 filas de `usuario` aunque existan (CP-11.5c), y con `set_config('app.comercio_id', …)` devuelve sólo las de ese comercio
- [x] 1.3 Escribir `docs/runbooks/rls.md` con el patrón de políticas para tablas futuras y el script de rollback. Listo cuando: el runbook incluye el SQL completo y un checklist "tabla nueva"

## 2. API · contexto de tenant y provisioning

- [x] 2.1 Implementar `TenantContext` (AsyncLocalStorage) y la extensión `prisma.tenant` que inyecta `comercioId` en lecturas, escrituras y creates de `TENANT_MODELS`, ejecutando cada operación en una transacción con `set_config('app.comercio_id', …, true)`. Listo cuando: un test unitario verifica que `findMany` sin `where` llega a la base con `comercioId` y que `create` lo inyecta
- [x] 2.2 Implementar `AuthProvisioningService.resolver()` (buscar por uid → vincular invitación por email → crear comercio FREE + DUENIO) usando `prisma.raw` bajo `app.rol_sistema = 'provisioning'`, con reintento ante violación del índice único. Listo cuando: tests e2e CP-11.2, CP-11.2b (dos requests en paralelo) y CP-11.3b pasan
- [x] 2.3 Extender `FirebaseAuthGuard` para llenar `req.user` con usuario, comercio, rol, plan y bloquear inactivos con 403. Listo cuando: CP-11.6 pasa y `GET /me` devuelve la forma nueva
- [x] 2.4 Agregar `RolesGuard` (`@Roles`), `PlanGuard` (`@RequierePlan`, usa `planCumple`) y `SensitiveFieldsInterceptor` (omite `costo*` y `margen*` para EMPLEADO), registrados globalmente en el orden Throttler → Auth → Roles → Plan. Listo cuando: un controlador de prueba en los e2e demuestra CP-11.4, CP-11.4b y CP-11.7
- [x] 2.5 Agregar en `packages/shared` el código `CONFLICTO`, los esquemas `OnboardingSchema`, `ComercioPatchSchema`, `InvitacionSchema`, `UsuarioPatchSchema` y los tipos `Me`, `Usuario`, `Comercio`; crear `ZodValidationPipe` en la API que responde 400 `VALIDACION` con `details` por campo. Listo cuando: tests unitarios de los esquemas pasan y un body inválido responde con el formato del contrato
- [x] 2.6 Prohibir `prisma.raw` fuera de `apps/api/src/auth` con una regla de ESLint. Listo cuando: un uso fuera de `auth/` hace fallar `pnpm lint`

## 3. API · endpoints

- [x] 3.1 `GET /me` (forma nueva) y `POST /me/onboarding`. Listo cuando: CP-11.1, CP-11.1b (verificador simulado con dos identidades), CP-11.1c y CP-11.2c pasan
- [x] 3.2 `GET /comercio` y `PATCH /comercio` con validación de nombre, CUIT (11 dígitos, opcional) e IVA (0 a 100). Listo cuando: CP-11.2d pasa, incluido el 403 para EMPLEADO y CONTADOR
- [x] 3.3 Módulo `users`: `GET /users`, `POST /users` (invitación, 409 `CONFLICTO`, 402 `PLAN_REQUERIDO` en FREE) y `PATCH /users/:id` (rol, activo, regla del último dueño con `FOR UPDATE`). Listo cuando: CP-11.3, CP-11.3c, CP-11.3d, CP-11.3e, CP-11.3f, CP-11.7 y CP-11.7b pasan
- [x] 3.4 Test e2e de aislamiento: dos comercios, lectura y escritura cruzadas (CP-11.5, CP-11.5b) y verificación de `relforcerowsecurity` para cada modelo de `TENANT_MODELS`. Listo cuando: el test pasa y falla al quitar `FORCE` de una tabla en un entorno de prueba
- [x] 3.5 Actualizar Swagger (DTOs, `@ApiResponse` de 401/402/403/404/409) y regenerar el contrato: `pnpm openapi`. Listo cuando: `docs/openapi.json` contiene las siete rutas de D6 y CI no reporta contrato desactualizado

## 4. Web

- [ ] 4.1 `useMe()` con TanStack Query y `AuthGate` que redirige a `/onboarding` cuando `onboardingPendiente` y guarda comercio, rol y plan en contexto. Listo cuando: al entrar con Google por primera vez la web muestra el onboarding y, tras completarlo, el inicio
- [ ] 4.2 Pantalla `/registro` (nombre del comercio, email, contraseña, aceptación de términos) que crea el usuario en Firebase y llama a `POST /me/onboarding`; enlaces cruzados con `/login`. Listo cuando: un registro nuevo termina en el inicio con el nombre del comercio elegido y los errores de Firebase se muestran en español
- [ ] 4.3 Inicio mínimo (reemplaza la pantalla del sprint 0): nombre del comercio, rol, plan y accesos según rol; `RequireRole` para rutas de DUENIO. Listo cuando: un EMPLEADO no ve el acceso a Usuarios ni a Configuración y, si escribe la URL, ve "No tenés permiso"
- [ ] 4.4 Página `/configuracion/usuarios`: listado con estado (dueño, invitado, activo, inactivo), formulario de invitación (email, rol), cambio de rol y baja/reactivación, con manejo de 402 ("Disponible en el plan PRO"), 409 y 400. Listo cuando: invitar, cambiar rol y desactivar se reflejan en el listado sin recargar, y en plan FREE la invitación muestra el aviso de plan
- [ ] 4.5 Página `/configuracion/comercio` (nombre, CUIT, IVA por defecto) para DUENIO. Listo cuando: guardar actualiza los datos y `GET /comercio` los devuelve

## 5. Verificación y cierre

- [ ] 5.1 Correr `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm --filter @inventariosmart/api test:e2e` en verde; abrir PR y confirmar CI en verde. Listo cuando: el PR muestra los dos jobs en verde
- [ ] 5.2 Desplegar: merge a `main`, verificar en Render que la migración se aplicó y que `GET /me` en producción devuelve comercio, rol y plan para tu usuario; verificar con `psql` en Neon production que `usuario` tiene `FORCE ROW LEVEL SECURITY`. Listo cuando: la web publicada muestra tu comercio y rol DUENIO
- [ ] 5.3 Actualizar `docs/arquitectura.html` (§4 multi-tenencia: FORCE RLS y bypass de provisioning), `docs/adr/0002` y el README (rutas nuevas). Listo cuando: los tres documentos reflejan D1 a D6
- [ ] 5.4 Mover HU-11 a Hecho en Trello, actualizar el estado en `Backlog_InventarioSmart_v2.xlsx` y la tarea 4.3 del Gantt al 100 %. Listo cuando: Trello, backlog y Gantt coinciden
