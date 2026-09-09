# Mapa de capacidades OpenSpec ↔ Backlog

Cada change de OpenSpec crea o modifica specs en `openspec/specs/<capability>/spec.md`.
Los nombres de capacidad se fijan acá para que todos los changes usen el mismo path
y la trazabilidad HU → spec → CP sea directa. Formato: kebab-case, plano (sin dominios).

| Capacidad (path)        | HU    | RF            | Fase | Change sugerido (orden)          |
|-------------------------|-------|---------------|------|----------------------------------|
| (sin spec, tooling)     | —     | —             | 0    | 1 · `sprint0-esqueleto` (skip_specs) |
| `auth-tenancy`          | HU-11 | RF-11         | 1    | 2 · `auth-tenancy`               |
| `user-roles`            | HU-11 | RF-11         | 1    | 2 · `auth-tenancy` (misma change) |
| `product-catalog`       | HU-01 | RF-01, RF-02  | 1    | 3 · `product-catalog`            |
| `stock-movements`       | HU-10 | RF-13, RF-02  | 1    | 4 · `stock-movements`            |
| `suppliers-price-lists` | HU-02 | RF-03         | 1    | 5 · `suppliers-price-lists`      |
| `operating-expenses`    | HU-13 | RF-14         | 1    | 6 · `operating-expenses`         |
| `profitability`         | HU-03 | RF-04         | 1    | 7 · `profitability-engine`       |
| `financial-dashboard`   | HU-04 | RF-05         | 1    | 8 · `financial-dashboard`        |
| `excel-import`          | HU-05 | RF-08         | 1    | 9 · `excel-import-onboarding`    |
| (mobile, sin spec nuevo)| —     | RNF-06        | 1    | 10 · `mobile-mvp` (modifica specs existentes sólo si cambia comportamiento) |
| `restock-alerts`        | HU-06 | RF-06         | 2    | 11 · `restock-alerts`            |
| `purchase-orders`       | HU-07 | RF-07         | 2    | 12 · `purchase-orders-copilot`   |
| `weekly-reports`        | HU-09 | RF-09         | 2    | 13 · `weekly-reports`            |
| `supplier-comparison`   | HU-12 | RF-12         | 2    | 14 · `supplier-comparison`       |
| `ai-assistant`          | HU-08 | RF-10         | 3    | 15 · `ai-assistant`              |
| `subscription-plans`    | HU-14 | RF-15         | 3    | 16 · `subscription-plans`        |

## Reglas de uso

- Un change por historia de usuario, salvo HU-11 que abre dos capacidades (identidad y roles).
- Los criterios de aceptación de la HU se convierten uno a uno en escenarios; el nombre del
  escenario lleva el código del caso de prueba (`CP-11.3`), así la matriz de trazabilidad
  §5.3 de la Propuesta se completa sola.
- Las reglas RN-xx se citan en el texto del requisito, nunca se reescriben con otro número.
- No escribir specs por adelantado para Fases 2 y 3: OpenSpec recomienda especificar sólo
  lo que se va a construir. Las tablas previstas en el DER se crean en el change de
  `stock-movements` y `suppliers-price-lists` sin spec propio (son detalle de diseño).
