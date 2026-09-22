## Why

El costo de reposición de cada producto hoy se escribe a mano en el formulario del producto. La Propuesta fija que el costo vigente es el de la última lista de precios del proveedor (RN-08) y que del proveedor sale el lead time del punto de reposición (RN-04). Sin proveedores ni listas de precios no hay costo confiable, y sin costo confiable la rentabilidad (HU-03) y el dashboard (HU-04) calculan sobre datos viejos.

Cubre **HU-02** (RF-03) en la **Fase 1 – MVP**, con RN-08 (costo vigente = última lista importada) y deja cargado el `lead_time_dias` que RN-04 usa en HU-06. Es la quinta capacidad del mapa de `openspec/CAPACIDADES.md`.

## What Changes

- **Entidad Proveedor** del comercio: nombre, contacto, email, teléfono, CUIT, lead time en días, índice de confiabilidad (1 a 5) y notas; baja lógica (`activo`). Migración con RLS según el runbook.
- **Entidad PrecioProveedor**, historial de sólo inserción: producto, proveedor, costo neto sin IVA, vigente desde, origen (`MANUAL` o `IMPORT`), lote de importación y usuario. Nunca se edita ni se borra: una corrección es una fila nueva.
- **Proveedor principal por producto** (`producto.proveedor_principal_id`): el primer proveedor que informa un costo queda como principal si el producto no tenía; el DUENIO puede cambiarlo desde el producto.
- **Costo vigente automático (RN-08)**: al registrar un costo del proveedor principal, `producto.costo_reposicion` pasa a ese valor; al cambiar el proveedor principal, toma el último costo de ese proveedor. Los márgenes de HU-03 se calcularán sobre este campo, así que "se recalculan solos".
- **API** `GET/POST /api/v1/suppliers`, `GET/PATCH/DELETE /api/v1/suppliers/:id`, `GET /api/v1/suppliers/:id/prices` (lista vigente del proveedor), `POST /api/v1/suppliers/:id/prices` (carga manual de uno o varios costos), `POST /api/v1/suppliers/:id/price-list/preview` (archivo Excel o CSV → vista previa: coincidentes, cambios de costo, sin producto, inválidas) y `POST /api/v1/suppliers/:id/price-list` (confirmación de la vista previa), `GET /api/v1/products/:id/prices` (historial de costos del producto).
- **Web**: página Proveedores (listado, alta, edición, baja y reactivación), ficha del proveedor con su lista vigente, carga manual e importación en dos pasos (subir, revisar, confirmar); en el producto, selector de proveedor principal e historial de costos. Todo sólo para DUENIO.
- **Contrato**: `packages/shared` con esquemas de proveedor, precios y vista previa; OpenAPI y cliente regenerados.

Supuestos registrados:
- **Formato del archivo**: `.xlsx` o `.csv`, hasta 5.000 filas y 2 MB, con una columna de código de producto y una de costo neto sin IVA. Se detectan los encabezados `codigo`/`código`/`sku` y `costo`/`costo_neto`/`precio`; si no hay encabezados reconocibles se toman las dos primeras columnas. Coma o punto decimal. El archivo no se persiste: la vista previa devuelve las filas interpretadas y la confirmación las recibe de vuelta.
- **Códigos sin producto no crean productos**: se informan en la vista previa como "sin producto" y se omiten. Crear productos desde una planilla es HU-05.
- **Confiabilidad** como entero de 1 a 5 (estrellas), default 3, editable a mano; el comparador (HU-12) lo consumirá. Sin cálculo automático por ahora.
- **Sin límite de plan**: FREE puede cargar proveedores y listas.
- **Sólo DUENIO**: EMPLEADO y CONTADOR reciben 403 en todo lo de proveedores y precios, porque son datos de costo (Propuesta §2.4).

## Capabilities

### New Capabilities

- `suppliers-price-lists`: ABM de proveedores con lead time y confiabilidad, historial de costos por producto y proveedor de sólo inserción, carga manual e importación de listas de precios con vista previa, proveedor principal por producto y actualización automática del costo vigente (RN-08).

### Modified Capabilities

- `product-catalog`: el requisito "Modificación de producto" agrega el proveedor principal como campo editable y el producto expone `proveedorPrincipal`; el costo de reposición sigue siendo editable a mano (queda registrado como costo `MANUAL` del proveedor principal si lo hay).

## Impact

- **Código:** `apps/api` nuevo módulo `suppliers` (proveedores, precios, importación) y ajustes en `products` (proveedor principal, historial de costos, costo manual como fila de historial); `TENANT_MODELS`; nueva dependencia `exceljs` en la API para leer `.xlsx`; `packages/shared` esquemas; `packages/api-client` regenerado; `apps/web` páginas de proveedores y cambios en el formulario de producto.
- **Base de datos:** tablas `proveedor` y `precio_proveedor` con RLS, `precio_proveedor` de sólo inserción para `app_api` (como `movimiento`), columna `producto.proveedor_principal_id`. Migración aditiva.
- **Trazabilidad:** CU-02, casos de prueba CP-02.1 a CP-02.5, más aislamiento y roles.
- **Fuera de alcance:** cálculo de márgenes (HU-03), punto de reposición y alertas (HU-06), comparador de proveedores (HU-12), órdenes de compra (HU-07), importación de productos nuevos desde planilla (HU-05), precios por cantidad o descuentos, moneda extranjera, pantallas mobile.
