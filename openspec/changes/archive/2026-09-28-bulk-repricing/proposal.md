## Why

HU-15 le muestra al dueño qué productos quedaron atrasados frente a la inflación y cuánto deberían costar, pero para corregirlos tiene que abrir cada producto y tipear el precio. El comerciante entrevistado señaló eso mismo como su mayor cuello de botella: actualizar precios a mano y recalcular márgenes. Con 200 productos, una remarcación mensual son 200 ediciones.

Esta change cierra el circuito: del diagnóstico a la acción, en lote, con vista previa y posibilidad de deshacer. Es la continuación que `inflation-insights` dejó anotada como change posterior.

Cubre una historia nueva, **HU-17 "Remarcación asistida"** (RF-18 nuevo; RN-01, RN-03, RN-11 y la nueva **RN-12**), en la **Fase 2**, plan **PRO**.

## What Changes

- **Vista previa de remarcación** (`POST /repricing/preview`, sólo lectura): el dueño elige un criterio y el sistema calcula el precio nuevo de cada producto, con su variación y el margen bruto antes y después. Criterios: alcanzar la inflación del período, sostener el margen del inicio del período, porcentaje fijo y margen bruto objetivo.
- **Redondeo**: sin redondeo, al peso, a la decena o a la centena, siempre hacia arriba.
- **RN-12 (nueva)**: una remarcación en lote no baja precios salvo que el dueño lo pida, se aplica completa o no se aplica, y puede deshacerse mientras los precios remarcados no hayan vuelto a cambiar.
- **Aplicar** (`POST /repricing/apply`): recibe los precios de la vista previa, que el dueño pudo ajustar uno por uno, y los aplica en una sola transacción. Si el precio de algún producto cambió desde la vista previa, no aplica nada y avisa cuáles.
- **Lotes y deshacer**: cada remarcación queda registrada con su criterio, quién la hizo y el precio anterior y nuevo de cada producto (`GET /repricing/batches`). `POST /repricing/batches/:id/revert` vuelve al precio anterior los productos que siguen con el precio remarcado.
- **Historial de precios**: las filas de una remarcación llevan el origen nuevo `REMARCACION`.
- **Web**: desde "Precios e inflación", botón "Remarcar" que abre el asistente con los productos atrasados ya elegidos; página "Remarcaciones" con los lotes y "Deshacer".
- **Contrato**: shared, OpenAPI y cliente regenerados; migración `20261001_bulk_repricing`.

Supuestos registrados:
- **Precios con IVA**: la remarcación trabaja sobre el precio de venta con IVA, como se carga; el margen se calcula neto (RN-03).
- **Sólo productos activos**; hasta 5.000 por lote.
- **Los costos no cambian**: remarcar no toca costos ni proveedores.
- **Deshacer es una sola vez por lote** y no toca los productos cuyo precio cambió después.
- **Backlog**: HU-17, RF-18 y RN-12 son altas nuevas que Franco debe sumar al backlog y a la Propuesta.

## Capabilities

### New Capabilities

- `bulk-repricing`: vista previa de remarcación por criterio con redondeo, aplicación atómica con control de cambios, registro de lotes, deshacer, plan y permisos.

### Modified Capabilities

- `inflation-insights`: el historial de precios de venta suma el origen `REMARCACION`.

## Impact

- **Código:** `packages/shared` `remarcacion.ts` (criterios, redondeo, precio por margen objetivo, RN-12, esquemas); `apps/api` módulo nuevo `repricing` (servicio, controller, DTOs) que usa `InsightsService` para los criterios de inflación y margen y `registrarPreciosVenta` para el historial; `packages/api-client` regenerado; `apps/web` `lib/remarcacion.ts`, `features/remarcacion/{RemarcarPage,RemarcacionesPage}.tsx`, botón en `InflacionPage`, enlace en `AppShell`.
- **Base de datos:** migración con el valor `REMARCACION` en `origen_precio_venta` y las tablas `remarcacion` y `remarcacion_item` (por comercio, RLS, sin borrado).
- **Documentación:** ADR 0016 (remarcación con vista previa, aplicación atómica y deshacer), README, `docs/arquitectura.html`, `docs/runbooks/rls.md`, `openspec/config.yaml` (HU-17, RF-18, RN-12), `openspec/CAPACIDADES.md`.
- **Trazabilidad:** CU-17, casos CP-17.1 a CP-17.6.
- **Fuera de alcance:** remarcación programada o automática, reglas por categoría o proveedor, actualización de costos, etiquetas o listas de precios impresas, aviso a clientes, app Android.
