## Why

El comercio ya carga las listas de precios de varios proveedores (HU-02), pero para saber a quién conviene comprarle cada insumo tiene que abrir el historial de costos producto por producto y comparar de memoria. Tampoco tiene cómo pesar que el más barato tarde el doble o falle seguido: hoy la sugerencia de órdenes (HU-07) elige sólo por menor costo y el reporte semanal (HU-09) sólo detecta "hay uno más barato".

Esta change construye **HU-12 "Comparador de precios entre proveedores"** (RF-12; RN-08 y la nueva **RN-13**), la última historia de la **Fase 2** del backlog. Según la Propuesta, pertenece al plan **PREMIUM**.

## What Changes

- **Comparación por insumo** (`GET /products/:id/supplier-comparison`): todos los proveedores activos con precio cargado para el producto, con su costo vigente, plazo de entrega, confiabilidad, diferencia contra el más barato y puntaje.
- **RN-13 (nueva)**: puntaje del proveedor para un insumo = 0,60 × precio + 0,25 × plazo + 0,15 × confiabilidad, cada componente de 0 a 100. Precio = costo mínimo ÷ costo; plazo = (plazo mínimo + 1) ÷ (plazo + 1); confiabilidad = estrellas ÷ 5. El recomendado es el de mayor puntaje.
- **Resumen de todos los insumos** (`GET /supplier-comparison`): los productos con dos o más proveedores, con el recomendado, el proveedor principal actual y el ahorro mensual estimado si se cambia; filtro para ver sólo los que conviene cambiar.
- **Siempre al día**: nada se guarda; la comparación se calcula con el último costo de cada proveedor, así que una lista recién importada cambia el resultado en el momento.
- **Web**: página "Comparador" dentro de Proveedores, con el resumen, el detalle por insumo con barras de puntaje y la acción "Usar como principal", que reutiliza la edición del producto (RN-08).
- **Contrato**: shared, OpenAPI y cliente regenerados. **Sin migración**: usa las tablas de HU-02.

Supuestos registrados:
- **Pesos fijos** (60 / 25 / 15), visibles en la pantalla. Pesos configurables por comercio quedan como evolución.
- **La sugerencia de órdenes de HU-07 no cambia**: sigue eligiendo por menor costo. Unificar las dos reglas es una decisión aparte, porque cambia los casos CP-07.1 ya aprobados.
- **Sólo proveedores activos** y sólo el último costo de cada uno para ese producto.
- **Ahorro estimado** = (costo del principal − costo del recomendado) × unidades vendidas en los últimos 30 días; sin proveedor principal o sin ventas no se informa.
- **Plan PREMIUM**: para probarlo en producción hay que pasar el comercio de la demo a PREMIUM, porque la gestión de planes (HU-14) todavía no existe.

## Capabilities

### New Capabilities

- `supplier-comparison`: comparación de proveedores por insumo con puntaje (RN-13), proveedor recomendado, resumen de insumos con ahorro estimado, plan y permisos.

### Modified Capabilities

Ninguna.

## Impact

- **Código:** `packages/shared` `comparador.ts` (RN-13, recomendado, ahorro, esquemas); `apps/api` módulo nuevo `supplier-comparison` (servicio, controller, DTOs); `packages/api-client` regenerado; `apps/web` `lib/comparador.ts`, `lib/comparador-formato.ts`, `features/proveedores/{ComparadorPage,ComparacionProductoPage}.tsx`, accesos desde `ProveedoresPage` y `ProductoFormPage`.
- **Base de datos:** sin cambios.
- **Documentación:** ADR 0017 (puntaje ponderado calculado al leer), README, `docs/arquitectura.html` (módulo, RN-13), `openspec/config.yaml` (RN-13), `openspec/CAPACIDADES.md`.
- **Trazabilidad:** CU-12, casos CP-12.1 a CP-12.6.
- **Fuera de alcance:** pesos configurables, cambiar la regla de HU-07, negociación o pedido de cotizaciones, historial de puntajes, precios de mercado externos, app Android.
