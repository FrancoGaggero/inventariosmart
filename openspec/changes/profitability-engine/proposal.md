## Why

Es la promesa central del producto: "cuánto gano de verdad, no sólo la diferencia entre costo y precio". Ya existen todos los insumos (precio de venta con IVA y alícuota por producto, costo de reposición vigente que siguen las listas de proveedores, ventas del período y gastos operativos prorrateados), pero ningún endpoint los combina. Esta change agrega el motor que calcula margen bruto y neto por producto y consolidado, que el dashboard (HU-04) mostrará.

Cubre **HU-03** (RF-04) en la **Fase 1 – MVP**, con RN-01 (margen bruto en pesos y porcentaje), RN-02 (margen neto = bruto − gastos prorrateados por unidad vendida) y RN-03 (todo neto de IVA con alícuota por producto). Es la séptima capacidad del mapa de `openspec/CAPACIDADES.md`.

## What Changes

- **Cálculo derivado, nunca almacenado**: márgenes calculados en cada consulta a partir de `precio_venta`, `alicuota_iva`, `costo_reposicion`, las ventas del mes y el resumen de gastos del mes. Cambiar precio, costo o gastos cambia el margen en la siguiente consulta (HU-03 criterio 4), sin jobs ni columnas nuevas.
- **Funciones puras compartidas** (`packages/shared`): precio neto desde el precio con IVA, margen bruto en pesos y porcentaje, margen neto con motivo cuando no es calculable; con tests unitarios de RN-01 a RN-03 (evidencia para la cátedra).
- **API** `GET /api/v1/profitability/products?periodo=YYYY-MM&q=`: por producto activo, precio neto, costo, margen bruto ($ y %), unidades vendidas en el mes, margen bruto del mes, gasto por unidad, margen neto ($ y %) o `null` con motivo; paginado por cursor. `GET /api/v1/profitability/summary?periodo=`: consolidado del mes con ventas netas, costo de lo vendido, margen bruto ($ y %), gastos del mes y margen neto ($ y %) o `null` con motivo.
- **Web**: página Rentabilidad con selector de mes, tarjetas consolidadas (ventas netas, margen bruto, gastos, margen neto con su aviso) y tabla por producto con buscador; acceso para DUENIO y CONTADOR desde el menú y el inicio. EMPLEADO no accede (403), porque el margen es información sensible.
- **Contrato**: `packages/shared` con esquemas de rentabilidad; OpenAPI y cliente regenerados.

Supuestos registrados:
- **Precio neto = precio de venta ÷ (1 + alícuota/100)**, porque el precio del producto se carga con IVA incluido (decisión de `product-catalog`) y el costo ya es neto (RN-03).
- **Costo de lo vendido con el costo vigente** (RN-08: al cambiar el costo, los márgenes se recalculan), no con el costo histórico a la fecha de cada venta. Es coherente con la Propuesta y evita depender del historial de HU-02 para el MVP; se anota como refinamiento posible.
- **Ventas netas del mes** = suma de cantidad × precio unitario de la venta (congelado en el movimiento) ÷ (1 + alícuota actual del producto), sobre ventas no anuladas con fecha en el mes (misma definición de "unidades vendidas" que `operating-expenses`).
- **Margen neto por producto** = margen bruto unitario − gasto por unidad del mes (`operating-expenses` resumen); si el prorrateo no es calculable (`SIN_GASTOS` o `SIN_VENTAS`), el margen neto es `null` con ese motivo, nunca igual al bruto (HU-13 criterio 5).
- **Sin límite de plan**: FREE ve su rentabilidad; el dashboard (HU-04) y los reportes (HU-09) pueden depender del plan.

## Capabilities

### New Capabilities

- `profitability`: márgenes bruto y neto por producto y consolidados del mes, derivados de precio, alícuota, costo vigente, ventas y gastos, con porcentaje sobre el precio neto y motivo explícito cuando el neto no es calculable.

### Modified Capabilities

Ninguna. `operating-expenses` y `stock-movements` se consultan tal cual; los permisos siguen `user-roles`.

## Impact

- **Código:** `apps/api` nuevo módulo `profitability` (importa `ExpensesModule`); `packages/shared` funciones y esquemas; `packages/api-client` regenerado; `apps/web` página de rentabilidad, enlace y tarjeta.
- **Base de datos:** sin migración; sólo lecturas con `JOIN` y agregación sobre `producto` y `movimiento`.
- **Trazabilidad:** CU-03, casos de prueba CP-03.1 a CP-03.5, más roles y aislamiento.
- **Fuera de alcance:** dashboard e indicadores de stock (HU-04), reportes semanales (HU-09), costo histórico a la fecha de venta, rentabilidad por categoría o proveedor, exportación, pantallas mobile.
