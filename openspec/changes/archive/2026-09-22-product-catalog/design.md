## Context

Tras `auth-tenancy`: `PrismaService.tenant` inyecta `comercio_id` y fija `app.comercio_id` por transacción; `TENANT_MODELS` sólo contiene `Usuario`; guards `@Roles` y `@RequierePlan`; `SensitiveFieldsInterceptor` oculta claves `costo*`/`margen*` al EMPLEADO; `ZodValidationPipe` y esquemas compartidos en `packages/shared`; runbook `docs/runbooks/rls.md` con el checklist para tablas nuevas. La web tiene `AppShell` con navegación por rol, `useMe`, `Campo` y `Aviso`. Comportamiento en `specs/product-catalog`; motivación en proposal.md.

## Goals / Non-Goals

**Goals:**
- Primer módulo de negocio que sirva de plantilla para los siguientes (movimientos, proveedores, gastos): estructura, validación, paginación, tests.
- Listado rápido para el mostrador: búsqueda por código o nombre en menos de 300 ms con 5.000 productos (RNF-04).

**Non-Goals:**
- Movimientos, costos por proveedor, márgenes, importación, imágenes, variantes, unidades de medida distintas de "unidad".

## Decisions

**D1 · Modelo `Producto`.**

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | |
| `comercio_id` | uuid | índice único `(comercio_id, codigo_normalizado)` |
| `codigo` | varchar(64) | como lo escribió el usuario |
| `codigo_normalizado` | varchar(64) | `upper(trim(codigo))`, para la unicidad sin distinguir mayúsculas (CP-01.2) |
| `nombre` | varchar(120) | |
| `categoria` | varchar(60) nullable | texto libre en HU-01; catálogo de categorías más adelante si hace falta |
| `precio_venta` | decimal(14,2) | con IVA incluido |
| `alicuota_iva` | decimal(5,2) | default: `comercio.iva_default` al crear |
| `costo_reposicion` | decimal(14,2) | sin IVA; HU-02 lo actualiza desde listas de proveedores (RN-08) |
| `stock_actual` | integer ≥ 0 | sólo cambia por movimientos (HU-10) |
| `stock_seguridad` | integer ≥ 0 | default 0; alimenta RN-04 en HU-06 |
| `activo` | boolean | baja lógica |
| `creado_en`, `actualizado_en` | timestamptz | |

Índices: único `(comercio_id, codigo_normalizado)`; `(comercio_id, activo, nombre)` para el listado; trigram `gin (nombre gin_trgm_ops)` y `(codigo_normalizado)` para la búsqueda `ILIKE` (extensión `pg_trgm`, disponible en Neon). RLS con `ENABLE` + `FORCE`, políticas `producto_tenant` y `producto_sistema` (runbook). `Producto` entra en `TENANT_MODELS`.

**D2 · Estado de stock derivado, no almacenado.**
`estadoStock = stockActual === 0 ? 'SIN_STOCK' : stockActual <= stockSeguridad ? 'BAJO' : 'OK'`, calculado en el servicio al mapear la fila. El filtro `?estado=` se traduce a condiciones SQL (`stock_actual = 0`, `stock_actual > 0 AND stock_actual <= stock_seguridad`, `stock_actual > stock_seguridad`). HU-06 sumará el punto de reposición (RN-04) sin cambiar este contrato: agregará un cuarto estado.

**D3 · Paginación por cursor sobre `(nombre, id)`.**
Orden `nombre ASC, id ASC`; el cursor es base64url de `nombre|id`; la consulta siguiente usa `(nombre, id) > (cursor.nombre, cursor.id)` (comparación de tupla). `limit` entre 1 y 100, default 25. Respuesta `{ items, siguienteCursor }`. Este formato queda como convención para todos los listados.

**D4 · Búsqueda.**
`q` se normaliza (trim, upper para el código) y filtra `codigo_normalizado LIKE 'Q%' OR nombre ILIKE '%q%'`. Con el índice trigram el `ILIKE` es aceptable para el volumen previsto (5.000 productos). Sin búsqueda de texto completo por ahora.

**D5 · Endpoints (bajo `/api/v1`, Bearer).**

| Método y ruta | Roles | Plan | Notas |
| --- | --- | --- | --- |
| `GET /products` | DUENIO, EMPLEADO | FREE | `q`, `estado`, `activo` (default `true`), `cursor`, `limit` |
| `GET /products/:id` | DUENIO, EMPLEADO | FREE | 404 si es de otro comercio |
| `POST /products` | DUENIO | FREE (cuenta el límite), PRO | 201; 409 `CONFLICTO` por código; 402 al superar 50 activos en FREE |
| `PATCH /products/:id` | DUENIO | FREE | `stockActual` rechazado con 400; `activo: true` reactiva (cuenta el límite) |
| `DELETE /products/:id` | DUENIO | FREE | baja lógica; 200 con el producto `activo: false` |

`CONTADOR` recibe 403 por `@Roles('DUENIO', 'EMPLEADO')` en el controlador. El EMPLEADO ve el listado sin `costoReposicion` gracias al interceptor global (la clave empieza con `costo`).

**D6 · Límite del plan.**
`ProductsService` cuenta `activo = true` dentro de la misma transacción de tenant antes de crear o reactivar (`transaccionTenant` con `SELECT count(*) … FOR UPDATE` sobre `comercio` para serializar altas concurrentes). `LIMITES_PLAN[plan].productos` de `shared`.

**D7 · Esquemas compartidos (`packages/shared`).**
`ProductoSchema` (respuesta), `ProductoCreateSchema` (código 1–64, nombre 2–120, categoría ≤ 60, precioVenta ≥ 0 con 2 decimales, alicuotaIva 0–100 opcional, costoReposicion ≥ 0, stockInicial entero ≥ 0, stockSeguridad entero ≥ 0), `ProductoPatchSchema` (los mismos campos opcionales más `activo`, y rechaza `stockActual` con mensaje propio), `ListaProductosSchema`, `ESTADOS_STOCK`, `calcularEstadoStock()` (misma función en API y web). Montos como string decimal en JSON (convención).

**D8 · Web.**
Rutas `/productos` (listado: buscador con debounce, chips Todos/OK/Bajo/Sin stock, tabla con código, nombre, stock, precio y, sólo para DUENIO, costo; botón "Nuevo producto"; acción de baja/reactivar por fila), `/productos/nuevo` y `/productos/:id` (mismo formulario `ProductoForm`, validación con los esquemas compartidos, errores por campo del `details` de la API). Enlace "Inventario" en `AppShell` para DUENIO y EMPLEADO. El EMPLEADO ve el listado y el detalle en modo lectura. Aviso de plan al llegar a 50 en FREE (402 → "Disponible en el plan PRO").

**D9 · Tests.**
e2e `products.e2e-spec.ts` con dos comercios (CP-01.1 a CP-01.7, roles, plan) y un caso de rendimiento ligero: 300 productos creados en lote (`comoSistema` + `createMany`) y búsqueda `q=` en menos de 500 ms. Unit tests de `calcularEstadoStock` y de la codificación del cursor. El test de RLS existente (`rls.e2e-spec.ts`) cubre `Producto` automáticamente por recorrer `TENANT_MODELS`.

## Risks / Trade-offs

- [Costo en el producto se solapa con el historial por proveedor de HU-02] → Se define ya el criterio: `costo_reposicion` es un caché del "último costo vigente" y HU-02 es la fuente de verdad cuando existe; queda anotado en el schema.
- [Stock inicial sin movimiento hasta HU-10] → El histórico de un producto creado en esta change empieza en su stock inicial; HU-10 registrará el alta como INGRESO inicial y migrará los existentes con un movimiento retroactivo.
- [`pg_trgm` en Neon] → Verificado disponible en Neon (extensión estándar); si fallara la migración, el índice se omite y la búsqueda sigue funcionando con `ILIKE` sin índice.
- [Límite de 50 con altas concurrentes] → Bloqueo de la fila de `comercio` en la transacción de alta.

## Migration Plan

1. Migración `20260911_product_catalog`: `CREATE EXTENSION IF NOT EXISTS pg_trgm`, tabla, índices, RLS (bloque del runbook). Aditiva; sin datos previos.
2. `prisma migrate deploy` corre en Render al desplegar; antes se aplica en `dev` y corren los e2e.
3. Rollback: `DROP TABLE producto` si hiciera falta (sin dependencias todavía).

## Open Questions

- Nombre de la columna/etiqueta "Categoría" en la interfaz (texto libre en HU-01). No cambia specs ni tareas.
