## Why

El cronograma (Gantt v2) concentra todo el desarrollo del MVP entre el 12/10 y el 04/12/2026 y deja la app Flutter para los últimos seis días. Levantar ahora el esqueleto técnico completo (monorepo, API, web, mobile, CI y despliegue en la nube) elimina el riesgo de infraestructura antes de la Etapa 4 y deja un camino desplegado por el que después sólo pasa código de negocio.

Este change es tooling e infraestructura: no cambia comportamiento observable del producto, por eso se declara `skip_specs: true`. Los comportamientos que roza (inicio de sesión, `GET /me`) se especifican en el change siguiente, `auth-tenancy` (HU-11, RF-11).

## What Changes

- Monorepo `pnpm` con `apps/api`, `apps/web`, `apps/mobile`, `packages/shared` y `packages/api-client`, con TypeScript, ESLint y Prettier compartidos.
- `apps/api`: proyecto NestJS con Prisma conectado a PostgreSQL, migración inicial con las tablas `comercio` y `usuario`, endpoint `GET /api/v1/health` y documentación OpenAPI servida en `/docs` y exportada a `docs/openapi.json`.
- `apps/web`: proyecto React + Vite + Tailwind CSS v4 con pantalla de inicio de sesión mediante Firebase Authentication (Google) y una llamada autenticada de prueba a `GET /api/v1/me`.
- `apps/mobile`: proyecto Flutter para Android con una pantalla que muestra la respuesta de `GET /api/v1/health`.
- `packages/shared`: esquemas `zod` y constantes de roles y planes, consumidos por API y web.
- `packages/api-client`: cliente TypeScript generado desde `docs/openapi.json` con `openapi-typescript`.
- Entorno local: base PostgreSQL 18 ya instalada en la máquina de desarrollo (sin Docker), `.env.example` documentado, scripts `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm build`.
- CI con GitHub Actions: lint, typecheck, tests y build de API y web en cada pull request; `flutter analyze` para mobile.
- Despliegue: API en Render plan Free (Docker), web en Vercel, base en Neon; deploy automático de la rama `main` por la integración Git de cada servicio.
- `docs/adr`: cinco ADR iniciales (monolito modular, multi-tenencia por `comercio_id` + RLS, Firebase Auth, OpenAPI como contrato, monorepo).

Supuesto registrado: la verificación del ID token de Firebase y `GET /me` se implementan en este change sólo como prueba de humo técnica (devuelven `uid` y `email` del token). El alta automática de comercio, los roles y el aislamiento por tenant quedan en `auth-tenancy`.

## Capabilities

### New Capabilities

Ninguna. Este change no introduce comportamiento observable del producto (`skip_specs: true`).

### Modified Capabilities

Ninguna.

## Impact

- Backlog: no cierra ninguna HU; habilita HU-11 (RF-11) y todas las de Fase 1. Corresponde a la tarea 4.1 del Gantt, adelantada al sprint 0 (14 al 25/09/2026).
- Fuera de alcance: cualquier regla de negocio (RN-01 a RN-10), pantallas de inventario, movimientos, proveedores, gastos, dashboard o importación; Row Level Security (se agrega en `auth-tenancy` junto con las tablas de negocio); correo, jobs programados y respaldos (van con las historias que los necesitan).
- Dependencias nuevas: NestJS, Prisma, firebase-admin, zod, React, Vite, Tailwind, TanStack Query, Firebase Web SDK, Flutter SDK, openapi-typescript.
- Sistemas externos que requieren cuentas creadas por Franco: GitHub (repositorio privado, listo), Firebase (listo), Neon (listo), Render, Vercel.
- Herramientas de la máquina de desarrollo: Flutter 3.47.3 y Android Studio ya instalados el 09/09/2026.
