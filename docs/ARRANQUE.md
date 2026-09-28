# InventarioSmart — Arranque (Sprint 0, 14 → 25/09/2026)

Orden recomendado. Cada bloque es una tarde como máximo. Marcá y seguí.

## Día 1 · Herramientas y repositorio

Tu máquina hoy: Node 22.19 ✔ · PostgreSQL 18 local ✔ · Git ✔ · pnpm ✘ · Flutter ✘ · Docker ✘.
Con PostgreSQL 18 instalado no hace falta Docker para desarrollar: usá una base local
`inventariosmart_dev`. Neon corre Postgres 16/17; evitá funciones exclusivas de 18.

```bash
npm install -g pnpm @fission-ai/openspec@latest
```

Flutter: instalar el SDK estable desde docs.flutter.dev (Windows), agregar `flutter\bin` al PATH,
Android Studio con SDK y un emulador, y verificar con `flutter doctor`.

```bash
mkdir inventariosmart && cd inventariosmart && git init -b main
```

Estructura inicial (vacía, la llenan los changes):

```
apps/api  apps/web  apps/mobile  packages/shared  packages/api-client  docs/adr  docs/runbooks
```

## Día 1 · OpenSpec

```bash
openspec init --tools claude --language es
```

Después de `init`, reemplazá `openspec/config.yaml` por el de este kit y copiá
`openspec/CAPACIDADES.md`. Verificá con:

```bash
openspec validate --all
```

## Día 2 · Change 1: `sprint0-esqueleto` (sin specs)

En Claude Code, dentro del repo:

```
/opsx:propose sprint0-esqueleto: monorepo pnpm, NestJS con Prisma y /health y Swagger, React+Vite con login Google y GET /me, Flutter que llama a /health, CI en GitHub Actions y deploy a Railway + Vercel. Es tooling e infraestructura: skip_specs.
```

Revisá proposal → design → tasks antes de aplicar. Luego:

```
/opsx:apply
```

Listo cuando: `https://<api>.up.railway.app/health` responde, la web en Vercel muestra
el botón de Google, y `flutter run` muestra el JSON de `/health`.

## Día 4 · Change 2: `auth-tenancy` (HU-11)

```
/opsx:propose auth-tenancy: HU-11. Verificar ID token de Firebase en la API, alta automática de comercio FREE y usuario DUENIO en el primer ingreso, contexto de tenant con comercio_id, RLS en PostgreSQL, roles DUENIO/EMPLEADO/CONTADOR, gestión de usuarios por el dueño. Capacidades nuevas: auth-tenancy y user-roles.
```

El spec de `auth-tenancy` ya está redactado en este kit como referencia de formato
(`openspec/changes/auth-tenancy/specs/auth-tenancy/spec.md`). Pegalo cuando OpenSpec
cree el directorio del change, o dejá que lo genere y compará.

## Semana 2 · Change 3: `product-catalog` (HU-01)

Mismo ciclo: propose → revisar specs contra los criterios de aceptación de HU-01 →
apply → `openspec archive`. Al archivar, los deltas se fusionan en `openspec/specs/`
y ese directorio pasa a ser la especificación viva que se entrega con la tesis.

## Ritual por change

1. `/opsx:propose <nombre>: <qué, HU, RF>`
2. Leer `proposal.md`; corregir alcance.
3. Leer `specs/`; verificar que cada criterio de aceptación tiene su escenario CP-xx.y.
4. Leer `design.md`; confirmar comercio_id, RLS, endpoints y roles.
5. `/opsx:apply` y correr tests.
6. `openspec validate` · `openspec archive <nombre> --yes`
7. Commit `feat(<módulo>): <qué> (HU-xx)`; mover la tarjeta en Trello; actualizar el Backlog v2.

## Cuentas a crear (una sola vez)

Firebase (habilitar Google y email) · Neon · Railway · Vercel · Resend · GitHub (repo privado) · Anthropic (asistente, HU-08).
Credenciales en un gestor de contraseñas y en variables de entorno; nunca en el repo.

## Asistente con IA (HU-08): clave de Anthropic

El asistente usa la API de Anthropic, que se paga por uso. Sin clave responde 503 y el resto del sistema funciona igual.

1. En la consola de Anthropic, crear una API key para este proyecto y, si se puede, ponerle un límite de gasto mensual.
2. Guardarla en el gestor de contraseñas y en `C:\Users\gagge\secrets\inventariosmart\`. No pegarla en chats, issues ni commits.
3. Local: agregar `ANTHROPIC_API_KEY=...` a `apps/api/.env` (ignorado por git) y reiniciar la API.
4. Producción: cargar `ANTHROPIC_API_KEY` en Render → Environment. Render redepliega solo.
5. Opcionales: `ANTHROPIC_MODEL` (por defecto `claude-sonnet-5`) y `ASISTENTE_LIMITE_DIARIO` (por defecto 50).
6. Probar con el modelo real, fuera de CI: `pnpm --filter @inventariosmart/api test:asistente`.

Si la clave se expone, se revoca en la consola y se crea otra.
