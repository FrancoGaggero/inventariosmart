## Context

Repositorio recién creado, sin código: sólo `openspec/`, `docs/` (arquitectura, guía de arranque) y `README.md`. Máquina de desarrollo Windows 11 con Node 22.19, pnpm 12, Git y PostgreSQL 18 local; sin Docker, sin Flutter. Motivación en proposal.md - Why. Las decisiones de arquitectura de fondo (monolito modular, multi-tenencia, Firebase, OpenAPI, nube) ya están tomadas en `docs/arquitectura.html`; este diseño fija cómo se materializan en el esqueleto.

## Goals / Non-Goals

**Goals:**
- Un comando (`pnpm dev`) levanta API y web contra la base local.
- Un push a `main` despliega API y web; un pull request corre lint, tests y build.
- El contrato OpenAPI se genera desde el código y produce el cliente TypeScript; el cliente Dart queda preparado pero no se genera hasta que exista un endpoint de negocio.
- La cadena Firebase → API → PostgreSQL funciona de punta a punta con un usuario real de Google.

**Non-Goals:**
- Row Level Security y extensión de tenant de Prisma (se introducen en `auth-tenancy`, cuando aparecen tablas con `comercio_id` que proteger).
- Cualquier módulo de negocio, seeds de demostración, correo, jobs, respaldos, Sentry.
- Publicación de la app en Play Store.

## Decisions

**D1 · Monorepo pnpm con workspaces, sin Turborepo ni Nx.**
Tres apps y dos paquetes no justifican un orquestador; los scripts raíz encadenan `pnpm -r`. Alternativa descartada: Turborepo (caché útil recién con varios desarrolladores).

**D2 · Base local nativa en PostgreSQL 18, Neon en producción.**
La máquina ya tiene PostgreSQL 18 y no tiene Docker. Se crea `inventariosmart_dev` con `createdb`; `docker-compose.yml` se agrega sólo si otro entorno lo necesita. Verificado el 09/09/2026: el proyecto de Neon corre PostgreSQL 18.6, misma versión mayor que la local, así que no hay restricción de funciones. Ramas: `production` (API en Railway) y `dev` (previews y CI).

**D3 · Prisma con `prisma migrate` desde el día uno.**
La migración inicial crea `comercio` (id, nombre, plan, iva_default, moneda, created_at) y `usuario` (id, comercio_id, firebase_uid único, email, rol, created_at). Se crean ahora para que `GET /me` tenga dónde persistir en el change siguiente, pero este change no las llena.

**D4 · Verificación de Firebase con `firebase-admin` en un guard global, salvo rutas marcadas `@Public()`.**
`/health` y `/docs` son públicas. `GET /me` devuelve `{ uid, email }` del token verificado. Las credenciales del service account se cargan desde la variable `FIREBASE_SERVICE_ACCOUNT_JSON` (base64), nunca desde un archivo en el repo. Alternativa descartada: verificar el JWT a mano con la clave pública de Google (más código, sin ganancia).

**D5 · OpenAPI como artefacto versionado.**
`@nestjs/swagger` sirve `/docs` y un script `pnpm --filter api openapi:export` escribe `docs/openapi.json`. `packages/api-client` corre `openapi-typescript` sobre ese archivo. CI falla si `docs/openapi.json` está desactualizado respecto del código (paso `git diff --exit-code`). El cliente Dart (`openapi-generator`) se agrega en `mobile-mvp`.

**D6 · Web con React 19 + Vite + Tailwind v4 + TanStack Query + React Router.**
Estructura `src/app` (router, providers), `src/features/<capacidad>`, `src/lib/api.ts` (fetch con el ID token de Firebase en `Authorization: Bearer`). Misma base que el landing de Krowd Supply, ya conocida.

**D7 · Flutter con Riverpod, dio y go_router; sólo Android.**
Pantalla única `HealthScreen` que llama a `GET /health` con la URL base leída de `--dart-define=API_URL`. `firebase_auth` se agrega en este change para no repetir la configuración de `google-services.json` después, pero el login mobile se implementa en `mobile-mvp`.

**D8 · CI en GitHub Actions con dos workflows.**
`ci.yml` (pull request y `main`): `pnpm install --frozen-lockfile`, lint, typecheck, test, build, verificación de `openapi.json`; job separado `flutter analyze` con `subosito/flutter-action`. Despliegue: Render y Vercel despliegan `main` por su integración Git nativa, así que no hace falta `deploy.yml`; CI sólo valida. Los tests e2e de API usan PostgreSQL como servicio del job.

**D9 · Despliegue de la API como contenedor Docker en Render (plan Free).**
Decidido el 09/09/2026: el período de prueba de Railway venció y el plan Hobby exige tarjeta. Render ofrece un servicio web gratuito con Docker y deploy automático desde GitHub. `apps/api/Dockerfile` multi-stage (build con pnpm, runtime `node:22-alpine`), `prisma migrate deploy` en el arranque, `render.yaml` en la raíz para declarar el servicio. Variables: `DATABASE_URL` (Neon pooled), `DIRECT_URL` (Neon directa), `FIREBASE_SERVICE_ACCOUNT_JSON`, `CORS_ORIGINS`. Limitación conocida: el servicio Free se suspende tras 15 minutos sin tráfico y tarda 30 a 50 s en despertar; aceptable para la tesis, se revisa en el sprint 5 (alternativas: Render Starter pago, Koyeb, o créditos del GitHub Student Developer Pack con el correo institucional).

**D11 · Versiones fijadas durante la implementación (09/09/2026).**
- NestJS **11.2** y no 12: la línea 12 se publicó como ESM puro y Jest no puede cargarla en Node 22 (`require(esm)` recién llega a Jest en Node 24.9). NestJS 11 sigue soportado; se revisa cuando el ecosistema (Jest, ts-jest, nestjs-pino, throttler) esté alineado con 12.
- TypeScript **5.9** y no 7: NestJS depende de `emitDecoratorMetadata`, que el compilador 7 (nativo) no cubre aún.
- Prisma **7.10** con `@prisma/adapter-pg` y `prisma.config.ts` (la URL ya no vive en el schema). El cliente se genera en `apps/api/src/generated` (ignorado por git) y cada script de build, typecheck y e2e corre `prisma generate` antes.
- `firebase-admin` 14 trae `jose` (sólo ESM): los tests e2e mapean `firebase-admin/app` y `firebase-admin/auth` a stubs (`test/stubs`) y reemplazan `TokenVerifier` por un doble. El SDK real se verificó levantando la API y enviando tokens inválidos (401 con el error de decodificación de Firebase en el log).
- Tests del paquete `shared` con Vitest (ESM nativo) en lugar de Jest; la API mantiene Jest + ts-jest + Supertest.

**D10 · Convenciones fijadas ahora para no renegociarlas.**
Código en inglés, UI en español; Conventional Commits con el ID de HU; ramas `feat/hu-xx-nombre`; errores `{ code, message, details }` desde el primer filtro de excepciones; prefijo global `/api/v1`.

## Risks / Trade-offs

- [Flutter no está instalado; la instalación de Android Studio y el emulador puede consumir medio día] → Tarea explícita al inicio; el resto del sprint no depende de ella.
- [El servicio Free de Render se duerme sin tráfico y la primera respuesta puede tardar hasta 50 s] → Para la demo, abrir la API un minuto antes; evaluar plan pago o créditos estudiantiles en el sprint 5.
- [Cuentas y credenciales externas (Firebase, Neon, Render, Vercel) deben crearlas Franco a mano] → Tareas marcadas como manuales con el dato exacto que hay que obtener; el agente no ingresa credenciales.
- [La clave privada del service account de Firebase pasó por el chat durante el setup] → Rotarla (generar nueva y eliminar la actual) antes del hito H4, tarea del sprint 5.
- [Verificar el token de Firebase en cada request agrega latencia] → `firebase-admin` cachea las claves públicas; suficiente para RNF-04. Se mide en el change `financial-dashboard`.
- [`GET /me` sin persistencia puede confundirse con la funcionalidad final] → Comentario en el código y en el proposal: es prueba de humo; `auth-tenancy` lo reemplaza.

## Migration Plan

Sin datos previos. Despliegue: crear proyecto en Railway y Neon, cargar variables, primer `railway up` manual, luego automático. Rollback: Railway conserva el despliegue anterior; `prisma migrate deploy` es aditivo en este change.

## Open Questions

- Nombre del proyecto en Firebase y región de Neon (recomendación: `southamerica-east1` / São Paulo o `us-east-1`). No cambia el diseño ni las tareas.
