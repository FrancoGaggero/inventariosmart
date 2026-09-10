## Why

El inventario es la primera capacidad de negocio del producto y la base de las que siguen: sin productos no hay movimientos (HU-10), proveedores con listas de precios (HU-02) ni rentabilidad (HU-03). Con la autenticación y el aislamiento por comercio ya resueltos (`auth-tenancy`), esta change estrena el patrón para toda tabla de negocio: `comercio_id` inyectado, RLS forzada, permisos por rol y campos sensibles ocultos.

Cubre **HU-01** (RF-01, RF-02) en la **Fase 1 – MVP**, con las reglas RN-03 (alícuota de IVA por producto, default 21 %), RN-05 (código único por comercio) y RN-07/RN-02 (el stock sólo cambia por movimientos). Toma de HU-14 el límite de 50 productos del plan FREE, igual que `auth-tenancy` tomó el límite de usuarios.

## What Changes

- **Entidad Producto** con código único por comercio, nombre, categoría, precio de venta, alícuota de IVA, costo de reposición vigente, stock actual, stock de seguridad y estado activo. Migración con RLS según el checklist del runbook.
- **API** `GET/POST /api/v1/products`, `GET/PATCH/DELETE /api/v1/products/:id`: listado con búsqueda por texto, filtro por estado de stock y por activo, paginación por cursor; alta con stock inicial; edición de datos comerciales; baja lógica (`activo = false`) y reactivación. Límite de 50 productos activos en plan FREE (402).
- **Estado de stock derivado** en cada producto (`SIN_STOCK`, `BAJO`, `OK`) según stock actual y stock de seguridad, para los chips de la interfaz y los filtros.
- **Web**: página Inventario con búsqueda, chips de estado y tabla; formulario de alta y edición; baja y reactivación; el rol Empleado consulta sin ver costos y sin editar.
- **Contrato**: `packages/shared` con esquemas de producto; OpenAPI y cliente regenerados.

Supuestos registrados:
- El **precio de venta se ingresa con IVA incluido** (como lo ve el cliente en el mostrador) y el **costo de reposición sin IVA** (como viene en las listas de proveedores). Los cálculos netos de HU-03 se derivan con la alícuota del producto (RN-03). Si preferís cargar ambos netos, es un cambio de un campo.
- El **costo de reposición vive en el producto** como valor vigente; HU-02 agrega el historial por proveedor (`PrecioProveedor`) y actualiza ese valor al importar listas (RN-08).
- El **stock no se edita a mano**: se fija al crear el producto y después sólo cambia por movimientos (HU-10). Cuando exista HU-10, el alta registrará el stock inicial como un movimiento de INGRESO para que el histórico sea completo.
- La **baja es siempre lógica** (`activo = false`, reactivable). Cumple el criterio "con movimientos, lógica y no física" y evita perder historial; no hay borrado físico de productos.

## Capabilities

### New Capabilities

- `product-catalog`: alta, consulta, modificación, baja lógica y reactivación de productos del comercio, con código único, estado de stock derivado, búsqueda, filtros y límite del plan FREE.

### Modified Capabilities

Ninguna. Los permisos por rol ya definidos en `user-roles` aplican tal cual: DUENIO opera el catálogo, EMPLEADO lo consulta sin costos, CONTADOR no accede.

## Impact

- **Código:** `apps/api` nuevo módulo `products`; `TENANT_MODELS` y migración con RLS; `packages/shared` esquemas de producto; `packages/api-client` regenerado; `apps/web` páginas de inventario y navegación.
- **Base de datos:** tabla `producto` con índice único `(comercio_id, codigo)` y políticas RLS. Migración aditiva.
- **Trazabilidad:** CU-01, casos de prueba CP-01.1 a CP-01.5 más aislamiento, roles y plan.
- **Fuera de alcance:** movimientos de stock (HU-10), proveedores y listas de precios (HU-02), cálculo de margen (HU-03), importación desde Excel (HU-05), pantallas mobile (`mobile-mvp`), imágenes de producto, códigos de barras (el campo `codigo` admite escribir el EAN, sin escaneo).
