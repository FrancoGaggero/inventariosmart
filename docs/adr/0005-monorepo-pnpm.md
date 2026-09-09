# ADR 0005 · Monorepo con pnpm workspaces

**Estado:** aceptada · 09/09/2026

## Contexto

El proyecto tiene tres aplicaciones (API, web, mobile), esquemas compartidos (roles, planes, errores) y un contrato OpenAPI del que se generan clientes. El formulario PL03 pide URLs de repositorio para backend, frontend y mobile.

## Decisión

Un único repositorio `inventariosmart` con pnpm workspaces:

```
apps/api  apps/web  apps/mobile  packages/shared  packages/api-client  docs/  openspec/
```

Flutter vive en `apps/mobile` sin participar del workspace de Node; comparte `docs/openapi.json` y la documentación. Sin orquestador (Turborepo, Nx): los scripts raíz encadenan `pnpm -r`. En el PL03 se informa la misma URL con la carpeta de cada componente.

## Alternativas consideradas

- **Tres repositorios:** los tipos compartidos se duplicarían o se publicarían como paquete; tres CI y tres lugares para la documentación.
- **Turborepo / Nx:** caché remota y grafo de tareas útiles con varios desarrolladores; para una persona es configuración sin retorno.

## Consecuencias

- Una CI (`.github/workflows/ci.yml`) valida todo en cada pull request.
- Render construye la API con el Dockerfile desde la raíz del repositorio; Vercel usa `apps/web` como root directory.
- pnpm 12 exige aprobar explícitamente los scripts de instalación (`allowBuilds` en `pnpm-workspace.yaml`).
