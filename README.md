# InventarioSmart

Plataforma SaaS de gestión de inventario e inteligencia financiera para PyMEs.
Trabajo final de carrera — Analista de Sistemas, Escuela Da Vinci. Franco Gaggero.

| Componente | Tecnología                                            | Carpeta               |
| ---------- | ----------------------------------------------------- | --------------------- |
| API        | NestJS 11 · Prisma 7 · PostgreSQL 18 · Firebase Admin | `apps/api`            |
| Web        | React 19 · Vite · Tailwind v4 · TanStack Query        | `apps/web`            |
| Mobile     | Flutter 3.47 (Android) · Riverpod · dio · go_router   | `apps/mobile`         |
| Compartido | Esquemas zod, roles, planes, errores                  | `packages/shared`     |
| Cliente    | Tipos y cliente generados desde `docs/openapi.json`   | `packages/api-client` |

## Arranque local en cinco comandos

Requisitos: Node 22, pnpm 12 (`npm i -g pnpm`), acceso a la rama `dev` de Neon (no hace falta PostgreSQL local), Flutter 3.47 (sólo para mobile).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env   # completar valores
pnpm --filter @inventariosmart/shared build && pnpm openapi
pnpm --filter @inventariosmart/api prisma:deploy
pnpm dev
```

- API: http://localhost:3000/api/v1 · Swagger: http://localhost:3000/docs
  Rutas de HU-11: `GET /me`, `POST /me/onboarding`, `GET/PATCH /comercio`, `GET/POST /users`, `PATCH /users/:id`.
  Rutas de HU-01: `GET/POST /products`, `GET/PATCH/DELETE /products/:id` (búsqueda `q`, filtro `estado`, `activo`).
  Rutas de HU-10: `GET/POST /movements`, `GET /movements/:id`, `POST /movements/:id/anular` (filtros `productoId`, `tipo`, `desde`, `hasta`).
  `POST /movements` acepta la cabecera `Idempotency-Key`: repetir la clave devuelve 200 con el movimiento ya registrado.
  Rutas de HU-05: `POST /import/preview` (multipart `archivo`: `.xlsx` o `.csv`; columnas `codigo`, `nombre`, `precio`
  obligatorias; `costo`, `stock`, `stock minimo`, `categoria`, `iva` opcionales) y `POST /import/commit`.
  Plantilla: `apps/web/public/plantillas/productos.csv`.
  Ruta de HU-04: `GET /dashboard?periodo` (panel del mes: stock, ventas y márgenes, mes anterior, top rentables y
  alertas; la web lo consulta cada 60 s).
  Rutas de HU-03: `GET /profitability/products?periodo&q` y `GET /profitability/summary?periodo` (márgenes bruto y
  neto sobre importes netos de IVA; nada se almacena).
  Rutas de HU-13: `GET/POST /expenses`, `GET/PATCH/DELETE /expenses/:id`, `GET /expenses/summary` (todas con
  `?periodo=YYYY-MM`, default mes actual en Buenos Aires); el resumen devuelve `gastoPorUnidad` o `null` con motivo.
  Rutas de HU-02: `GET/POST /suppliers`, `GET/PATCH/DELETE /suppliers/:id`, `GET/POST /suppliers/:id/prices`,
  `POST /suppliers/:id/price-list/preview` (multipart `archivo`: `.xlsx` o `.csv`, 2 MB, 5.000 filas) y
  `POST /suppliers/:id/price-list`; `GET /products/:id/prices` (historial de costos). Planilla de ejemplo:
  `apps/web/public/plantillas/lista-de-precios.csv` (columnas `codigo;costo`, costo neto sin IVA).
  Convención de listados: paginación por cursor, respuesta `{ items, siguienteCursor }`; `siguienteCursor` null en la última página.
- Web: http://localhost:5173
- Mobile (con el emulador abierto): `cd apps/mobile && flutter run --dart-define=API_URL=http://10.0.2.2:3000`

  App Android (`mobile-mvp`): login (email/contraseña y Google), panel resumido del mes, inventario de mostrador con alta
  rápida y registro de movimientos; pestañas según rol (DUENIO: Inicio · Inventario · Movimiento; EMPLEADO sin Inicio;
  CONTADOR sólo Inicio). Contra la API publicada: `flutter run --dart-define=API_URL=https://inventariosmart-api.onrender.com`.
  APK de demo: `flutter build apk --release --dart-define=API_URL=https://inventariosmart-api.onrender.com`
  (queda en `apps/mobile/build/app/outputs/flutter-apk/app-release.apk`, ignorado por git).
  Google en Android exige registrar la huella SHA-1 en Firebase → Configuración del proyecto → app Android
  (`cd apps/mobile/android && ./gradlew signingReport` muestra la de depuración) y volver a descargar `google-services.json`;
  hasta entonces el botón de Google avisa que no está disponible y el acceso con email y contraseña funciona igual.
  Tests: `cd apps/mobile && flutter analyze --fatal-infos && flutter test` (sin red ni Firebase: auth falsa y servidor en memoria).

`pnpm dev` levanta API y web en paralelo. La base de desarrollo es la rama `dev` de Neon (decisión D2 del sprint 0); las migraciones nuevas se crean con `pnpm --filter @inventariosmart/api prisma:migrate`.

## Variables de entorno

| Archivo         | Variables                                                                                                   | Origen                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `apps/api/.env` | `DATABASE_URL`, `DIRECT_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON` (base64), `CORS_ORIGINS`, `PORT`, `LOG_LEVEL` | Neon / Firebase → Cuentas de servicio           |
| `apps/web/.env` | `VITE_API_URL`, `VITE_FIREBASE_*`                                                                           | Firebase → Configuración del proyecto → app web |
| `apps/mobile`   | `android/app/google-services.json` (ignorado por git); `--dart-define=API_URL`                              | Firebase → app Android                          |

Los valores reales viven fuera del repositorio (carpeta de secretos del desarrollador, panel de Render y de Vercel). Ningún `.env` se commitea.

## Scripts

| Comando                                       | Qué hace                                                          |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                                    | API (`nest start --watch`) y web (`vite`) en paralelo             |
| `pnpm lint`                                   | ESLint en todo el monorepo                                        |
| `pnpm typecheck`                              | `tsc --noEmit` en cada paquete (regenera el cliente Prisma antes) |
| `pnpm test`                                   | Vitest (shared) y Jest (API, unitarios)                           |
| `pnpm --filter @inventariosmart/api test:e2e` | Tests e2e de la API contra la base de `DATABASE_URL`              |
| `pnpm build`                                  | Compila todos los paquetes                                        |
| `pnpm openapi`                                | Exporta `docs/openapi.json` y regenera `packages/api-client`      |
| `pnpm format`                                 | Prettier                                                          |

## Cómo se trabaja

Desarrollo guiado por especificación con [OpenSpec](https://github.com/Fission-AI/OpenSpec). Cada historia de usuario es una _change_:

1. `/opsx:propose <nombre>: <qué, HU, RF>` genera proposal, specs, design y tasks en `openspec/changes/<nombre>/`.
2. Revisar los cuatro artefactos.
3. `/opsx:apply` implementa las tareas.
4. `openspec archive <nombre> --yes` fusiona los specs en `openspec/specs/`.

Orden de las changes y nombres de capacidad: `openspec/CAPACIDADES.md`. Guía de arranque: `docs/ARRANQUE.md`. Arquitectura: `docs/arquitectura.html`. Decisiones: `docs/adr/`. Despliegue: `docs/runbooks/deploy.md`.

## Despliegue

- **API:** Render (plan Free, Docker) desde `render.yaml`. Cada push a `main` redespliega y corre `prisma migrate deploy`.
- **Web:** Vercel con root directory `apps/web`.
- **Base:** Neon (rama `production` para la API, rama `dev` para previews y CI).
- **CI:** GitHub Actions (`.github/workflows/ci.yml`): lint, formato, typecheck, tests, e2e contra PostgreSQL, build, verificación del contrato OpenAPI y análisis de Flutter.
