## Why

La página "Falta de stock" (HU-18) muestra la plata que se pierde por no tener mercadería. El problema opuesto es igual de caro para una PyME y tampoco se ve en ningún lado: productos que están en el depósito hace meses sin venderse, con plata del comercio inmovilizada que podría ir a reponer lo que sí sale. El panel muestra el stock valorizado total, pero no cuánto de ese valor está parado. Esta change crea la historia **HU-19 "Plata parada en stock"** (nuevo **RF-20**; RN-08; nueva **RN-15**), de la **Fase 2** y del plan **PRO**, igual que las alertas y los quiebres.

## What Changes

- **RN-15 (nueva)**:
  - Un producto activo con stock mayor a 0 está **parado** si no tuvo ventas no anuladas en los últimos N días (30, 60, 90 o 180; 90 por defecto).
  - Los productos dados de alta hace menos de N días no se cuentan, porque todavía no tuvieron tiempo de venderse.
  - El **capital parado** es stock × costo de reposición vigente, neto de IVA (RN-08).
  - Los **días sin vender** se cuentan desde la última venta no anulada o, si nunca se vendió, desde el alta.
- **API**: `GET /api/v1/dead-stock?dias=30|60|90|180` (90 por defecto) devuelve los totales y los productos parados ordenados por capital parado, con paginación por cursor.
  - Totales: capital parado, productos, unidades y qué porcentaje es del stock valorizado total.
  - Por producto: código, nombre, stock, costo, capital parado, fecha de la última venta (o `null` si nunca se vendió) y días sin vender.
- **Panel**: `GET /dashboard` suma `stockParado` (capital parado y productos con el criterio de 90 días), que vale `null` si el plan no lo incluye. La web muestra una tarjeta "Plata parada en stock" junto a la de falta de stock.
- **Planes**: el catálogo suma "Stock parado" en PRO.
- **Web**: página `/stock-parado` "Stock parado":
  - tarjetas con los totales y un selector de 30, 60, 90 o 180 días;
  - tabla de productos con capital parado, stock, última venta y días sin vender;
  - una línea con ideas para liberar esa plata (promoción, combo, devolución al proveedor, o dar de baja lo que ya no se vende).

  Se llega desde el panel y desde "Falta de stock", y "Falta de stock" enlaza de vuelta.
- Contrato OpenAPI y cliente TS regenerados.

### Fuera de alcance

- **Productos de rotación lenta** que sí venden pero tienen stock para muchos meses: pide una definición de cobertura distinta y queda para una change posterior.
- **Acciones desde la página**, como armar una promoción, remarcar en baja o generar una devolución. La remarcación (HU-17) ya permite bajar precios con pedido explícito.
- Una consulta del asistente sobre stock parado.
- Cambios en la app móvil.

## Capabilities

### New Capabilities

- `dead-stock`: detección de productos sin ventas en un período y del capital inmovilizado en ellos (RN-15), por API y en la web.

### Modified Capabilities

- `financial-dashboard`: el panel suma el bloque `stockParado`.
- `subscription-plans`: el catálogo de funcionalidades suma "Stock parado" en el plan PRO.

## Impact

- **API**: módulo nuevo `dead-stock` (servicio, controller y DTOs), `dashboard.service.ts` y `AppModule`.
- **Shared**: `packages/shared/src/stock-parado.ts` con los esquemas y las funciones puras de RN-15; `planes.ts` suma la funcionalidad; `dashboard.ts` suma el bloque.
- **Base de datos**: sin tablas, migraciones ni índices nuevos. Las ventas del período se leen con el índice `movimiento (comercio_id, fecha)`, y la última venta de cada producto parado, con el índice por producto y fecha. Todo corre con la extensión de tenant y RLS existentes.
- **Web**: `features/stock-parado/StockParadoPage.tsx`, `lib/stock-parado.ts` y `lib/stock-parado-formato.ts`, una tarjeta en el panel, el enlace cruzado con "Falta de stock" y la ruta.
- **Tests**: unitarios de RN-15 en shared, e2e de la API por cada criterio de aceptación (incluidos aislamiento, roles y plan), los e2e de planes y del panel actualizados, y una prueba de carga.
- **Documentos de Franco**: HU-19, RF-20 y RN-15 hay que sumarlos a la Propuesta, el backlog, el Gantt y Trello.
