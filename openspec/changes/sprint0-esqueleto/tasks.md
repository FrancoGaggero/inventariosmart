## 1. Herramientas y cuentas (manual, Franco)

- [x] 1.1 Instalar Flutter SDK estable y Android Studio con un emulador Android; verificar que `flutter doctor` no reporta errores en las secciones Flutter, Android toolchain y Android Studio
- [x] 1.2 Crear el repositorio privado `inventariosmart` en GitHub y agregarlo como `origin`; verificar con `git remote -v`
- [x] 1.3 Crear el proyecto en Firebase, habilitar los proveedores Google y Email/Password, registrar la app web y la app Android (`com.inventariosmart.app`), descargar la configuración web y `google-services.json`, y generar la clave del service account; verificar que los tres archivos existen fuera del repo
- [x] 1.4 Crear el proyecto en Neon con la rama `main` como producción y una rama `dev`; verificar que `psql "<DATABASE_URL>" -c "select 1"` responde
- [x] 1.5 Crear las cuentas en Render y en Vercel con el usuario de GitHub y autorizar el acceso al repositorio `inventariosmart` (ambas hechas el 09/09/2026); la creación de los servicios se hace en las tareas 6.2 y 6.3 cuando exista el código; verificar que ambas cuentas listan el repositorio

## 2. Monorepo

- [x] 2.1 Crear `package.json` raíz, `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `tsconfig.base.json`, ESLint y Prettier compartidos, y `.nvmrc` con Node 22; verificar que `pnpm install` termina sin errores
- [x] 2.2 Crear `packages/shared` con esquemas `zod` de `Rol` (DUENIO, EMPLEADO, CONTADOR) y `Plan` (FREE, PRO, PREMIUM) y un test unitario; verificar que `pnpm --filter shared test` pasa
- [x] 2.3 Definir scripts raíz `dev`, `build`, `lint`, `typecheck`, `test`; verificar que `pnpm lint` y `pnpm typecheck` corren sobre todos los paquetes

## 3. API NestJS

- [x] 3.1 Generar `apps/api` con NestJS, prefijo global `/api/v1`, `helmet`, CORS desde `CORS_ORIGINS` y filtro global de excepciones con formato `{ code, message, details }`; verificar que `GET /api/v1/ruta-inexistente` responde 404 con ese formato
- [ ] 3.2 Configurar Prisma con `DATABASE_URL`, crear la base local `inventariosmart_dev` con `createdb`, y escribir la migración inicial con `comercio` y `usuario` (índice único en `firebase_uid`); verificar que `pnpm --filter api prisma migrate dev` aplica sin errores y `psql` lista las dos tablas
- [x] 3.3 Implementar `GET /api/v1/health` (estado de la API y de la conexión a la base) marcado `@Public()`; verificar con un test e2e que responde 200 y `{ status: "ok", db: "ok" }`
- [x] 3.4 Configurar `@nestjs/swagger` en `/docs` y el script `openapi:export` que escribe `docs/openapi.json`; verificar que el archivo contiene las rutas `health` y `me`
- [x] 3.5 Implementar el guard global de Firebase con `firebase-admin` (credencial desde `FIREBASE_SERVICE_ACCOUNT_JSON` en base64) y `GET /api/v1/me` que devuelve `{ uid, email }` del token; verificar con tests e2e que sin token responde 401 `{ code: "NO_AUTENTICADO" }` y con un token válido simulado responde 200
- [x] 3.6 Escribir `apps/api/Dockerfile` multi-stage con `prisma migrate deploy` al arrancar y `.env.example` con todas las variables; verificar que `.env.example` cubre cada variable leída por el código (no hay Docker local: la imagen se construye en Render en la tarea 6.2)

## 4. Web React

- [x] 4.1 Generar `apps/web` con Vite, React, TypeScript, Tailwind CSS v4, React Router y TanStack Query, con la estructura `src/app`, `src/features`, `src/lib`; verificar que `pnpm --filter web build` produce `dist/`
- [x] 4.2 Integrar Firebase Web SDK con inicio de sesión con Google y cierre de sesión, configuración desde variables `VITE_FIREBASE_*`; verificar manualmente que el popup de Google completa el login y el usuario queda en el estado de la app
- [x] 4.3 Crear `src/lib/api.ts` que adjunta el ID token en `Authorization: Bearer` y una pantalla que muestra el resultado de `GET /api/v1/me`; verificar que muestra el email del usuario logueado y que sin sesión redirige al login
- [x] 4.4 Generar `packages/api-client` con `openapi-typescript` desde `docs/openapi.json` y usarlo en `api.ts`; verificar que `pnpm --filter api-client build` genera los tipos y que la web compila usándolos

## 5. Mobile Flutter

- [x] 5.1 Crear `apps/mobile` con `flutter create` (paquete `com.inventariosmart.app`, sólo Android), agregar Riverpod, dio, go_router y firebase_auth, y colocar `google-services.json` fuera del control de versiones; verificar que `flutter analyze` no reporta problemas
- [x] 5.2 Implementar `HealthScreen` que llama a `GET /api/v1/health` con la URL de `--dart-define=API_URL` y muestra el JSON; verificar en el emulador contra la API local (`10.0.2.2:3000`) que aparece `status: ok`

## 6. CI y despliegue

- [ ] 6.1 Escribir `.github/workflows/ci.yml`: install con lockfile, lint, typecheck, test (PostgreSQL 16 como servicio), build, verificación de que `docs/openapi.json` está al día, y job `flutter analyze`; verificar que el workflow pasa en verde en un pull request de prueba (no hay `deploy.yml`: Render y Vercel despliegan `main` por su integración con GitHub)
- [x] 6.2 Escribir `render.yaml` que declara el servicio web Free desde `apps/api/Dockerfile`, crear el servicio en Render desde ese blueprint y cargar `DATABASE_URL`, `DIRECT_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON` y `CORS_ORIGINS`; verificar que `https://<servicio>.onrender.com/api/v1/health` responde 200 y que un push a `main` redespliega solo
- [x] 6.3 Configurar Vercel con root `apps/web`, comando de build de pnpm y variables `VITE_*`; agregar el dominio de Vercel a `CORS_ORIGINS` y a los dominios autorizados de Firebase; verificar que la web publicada completa el login con Google y muestra el email desde `GET /me`
- [ ] 6.4 Configurar la rama `dev` de Neon para los previews de Vercel; verificar que un pull request obtiene un preview funcional

## 7. Documentación y cierre

- [x] 7.1 Escribir los ADR 0001 a 0005 en `docs/adr` (monolito modular, multi-tenencia por comercio_id + RLS, Firebase Auth, OpenAPI como contrato, monorepo); verificar que cada uno tiene Contexto, Decisión, Alternativas y Consecuencias
- [x] 7.2 Actualizar `README.md` con el arranque local en cinco comandos y las variables de entorno; verificar siguiendo el README en una carpeta limpia que `pnpm dev` levanta API y web
- [ ] 7.3 Registrar el avance: tarea 4.1 del Gantt al 100 %, tarjeta "Sprint 0" en Trello a Hecho; verificar que el Gantt y Trello reflejan el estado
