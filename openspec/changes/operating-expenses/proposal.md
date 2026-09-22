## Why

El margen bruto (precio menos costo) ya se puede calcular con lo construido, pero la Propuesta compromete el margen neto: bruto menos gastos operativos prorrateados por unidad vendida del período (RN-02). Sin gastos cargados, HU-03 y el dashboard sólo podrían mostrar el bruto, y la Propuesta exige informar que el neto "no puede calcularse" en lugar de disfrazar el bruto como neto. Esta change carga los gastos y expone el prorrateo del período, que HU-03 consume.

Cubre **HU-13** (RF-14) en la **Fase 1 – MVP**, con RN-02 (prorrateo sobre unidades vendidas) y RN-03 (importes netos de IVA). Es la sexta capacidad del mapa de `openspec/CAPACIDADES.md`.

## What Changes

- **Entidad Gasto** del comercio: concepto, tipo (`FIJO` o `VARIABLE`), importe neto sin IVA, período (mes de inicio), periodicidad (`UNICO`, `MENSUAL`, `ANUAL`), fin opcional para los recurrentes, notas y usuario. Alta, edición y eliminación (los gastos no son historial contable: se pueden corregir y borrar). Migración con RLS según el runbook.
- **Listado por mes**: `GET /api/v1/expenses?periodo=YYYY-MM` devuelve los gastos que aplican a ese mes (los únicos de ese mes, los mensuales vigentes y los anuales prorrateados a un doceavo) con el importe aplicado al mes, más totales fijos, variables y general.
- **Resumen del período** `GET /api/v1/expenses/summary?periodo=YYYY-MM`: total de gastos del mes, unidades vendidas del mes (ventas no anuladas de `stock-movements`) y gasto prorrateado por unidad; cuando no hay gastos el prorrateo es `null` con un motivo explícito, y cuando hay gastos pero no ventas también, con otro motivo. Es la entrada de RN-02 para HU-03 y HU-04.
- **Web**: página Gastos con selector de mes, tabla con tipo, importe del mes y periodicidad, totales y tarjeta de resumen ("N unidades vendidas · $X de gasto por unidad" o el aviso de no calculable); formulario de alta y edición; DUENIO opera y CONTADOR consulta.
- **Contrato**: `packages/shared` con esquemas de gasto y resumen; OpenAPI y cliente regenerados.

Supuestos registrados:
- **Importes netos de IVA** (RN-03), como el costo de reposición. La web lo aclara en el formulario.
- **Periodicidad** en tres valores: único (aplica sólo a su mes), mensual (aplica desde su mes hasta el fin opcional) y anual (aplica un doceavo por mes desde su mes, durante doce meses o hasta el fin). Sin quincenal ni semanal por ahora.
- **Unidades vendidas del período** = suma de las cantidades de los movimientos `VENTA` con fecha en el mes cuyo original no fue anulado. Las devoluciones (`AJUSTE` positivo) no restan: son excepcionales y HU-03 puede refinarlo.
- **Eliminación física** de gastos, porque no forman parte del historial inmutable (RN-07 aplica a movimientos y costos, no a gastos). El criterio de la HU dice "eliminar".
- **Sin límite de plan**: FREE carga gastos; los reportes que los usan (HU-04) sí pueden depender del plan.

## Capabilities

### New Capabilities

- `operating-expenses`: ABM de gastos operativos fijos y variables con período y periodicidad, listado mensual con totales y resumen del período con unidades vendidas y gasto prorrateado por unidad (RN-02), explícitamente "no calculable" sin gastos o sin ventas.

### Modified Capabilities

Ninguna. Los permisos siguen `user-roles` (CP-11.4: EMPLEADO 403 en gastos; CONTADOR lectura); `stock-movements` no cambia, sólo se consulta.

## Impact

- **Código:** `apps/api` nuevo módulo `expenses`; `TENANT_MODELS`; `packages/shared` esquemas; `packages/api-client` regenerado; `apps/web` página de gastos, formulario, enlace y tarjeta en el inicio.
- **Base de datos:** tabla `gasto` con RLS, índice `(comercio_id, periodo)`; sin cambios en otras tablas. Migración aditiva.
- **Trazabilidad:** CU-13, casos de prueba CP-13.1 a CP-13.5, más aislamiento y roles.
- **Fuera de alcance:** margen bruto y neto por producto (HU-03), dashboard (HU-04), categorías de gasto configurables, adjuntos o comprobantes, gastos por sucursal, importación de gastos, pantallas mobile.
