# InventarioSmart

Plataforma SaaS de gestión de inventario e inteligencia financiera para PyMEs.
Trabajo final de carrera — Analista de Sistemas, Escuela Da Vinci. Franco Gaggero.

## Estado

Sprint 0 (esqueleto técnico). Todavía no hay código de aplicación: el repositorio
arranca con la especificación y la documentación de diseño.

## Cómo se trabaja

Desarrollo guiado por especificación con [OpenSpec](https://github.com/Fission-AI/OpenSpec).
Cada historia de usuario es una *change*:

1. `/opsx:propose <nombre>: <qué, HU, RF>` genera proposal, specs, design y tasks en `openspec/changes/<nombre>/`.
2. Revisar los cuatro artefactos.
3. `/opsx:apply` implementa las tareas.
4. `openspec archive <nombre> --yes` fusiona los specs en `openspec/specs/`.

Orden de las changes y nombres de capacidad: `openspec/CAPACIDADES.md`.
Guía de arranque paso a paso: `docs/ARRANQUE.md`.
Documento de arquitectura: `docs/arquitectura.html`.

## Estructura prevista

```
apps/api        NestJS + Prisma (API REST /api/v1)
apps/web        React + Vite
apps/mobile     Flutter (Android)
packages/shared esquemas zod y tipos compartidos
packages/api-client cliente TypeScript generado desde OpenAPI
docs/adr        decisiones de arquitectura
openspec/       especificación viva
```
