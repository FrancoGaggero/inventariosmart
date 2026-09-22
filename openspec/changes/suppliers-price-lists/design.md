## Context

Tras `stock-movements`: `Producto.costoReposicion` es un valor vigente editable a mano desde `PATCH /products/:id`; la extensión de tenant, RLS forzada, `ZodValidationPipe`, `SensitiveFieldsInterceptor` (oculta `costo*` al EMPLEADO), paginación por cursor `{ items, siguienteCursor }`, tablas de sólo inserción (`movimiento`, con privilegios recortados en la migración) y `comoPropietaria` en los tests ya existen. `@nestjs/platform-express` trae `multer` para multipart; la API no tiene lector de planillas. La web tiene `AppShell`, `Campo`, `Aviso`, `useProductos`, `ProductoFormPage`. El DER del documento de arquitectura ya prevé `Proveedor` y `PrecioProveedor` con `origen (MANUAL|IMPORT)` y `producto.proveedor_principal_id`. Comportamiento en `specs/suppliers-price-lists` y el delta de `product-catalog`; motivación en proposal.md.

## Goals / Non-Goals

**Goals:**
- Un único lugar que escriba `costoReposicion` a partir de ahora: `PricesService.registrar()` (manual, importación y edición desde el producto pasan por ahí), con la regla RN-08 en un solo método.
- Importación en dos pasos sin persistir el archivo, con el mismo patrón `preview → commit` que reutilizará HU-05.
- Historial de costos consultable por producto para que HU-03 pueda elegir el costo vigente a una fecha sin cambiar el modelo.

**Non-Goals:**
- Márgenes, punto de reposición, alertas, comparador, órdenes de compra, alta de productos desde planilla, precios por cantidad, moneda extranjera, mobile.

## Decisions

**D1 · Modelo `Proveedor` (tabla `proveedor`).**

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id`, `comercio_id` | uuid | RLS; índice `(comercio_id, activo, nombre)` |
| `nombre` / `nombre_normalizado` | varchar(120) | único `(comercio_id, nombre_normalizado)` con `upper(trim())`, como el código de producto |
| `contacto` | varchar(120) nullable | persona de contacto |
| `email` | varchar(254) nullable | |
| `telefono` | varchar(40) nullable | |
| `cuit` | varchar(13) nullable | mismo formato que `comercio.cuit` |
| `lead_time_dias` | integer ≥ 0, default 7 | alimenta RN-04 (HU-06) |
| `confiabilidad` | smallint 1–5, default 3 | `CHECK`; lo consume HU-12 |
| `notas` | varchar(500) nullable | |
| `activo` | boolean | baja lógica |
| `creado_en`, `actualizado_en` | timestamptz | |

**D2 · Modelo `PrecioProveedor` (tabla `precio_proveedor`), sólo inserción.**

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id`, `comercio_id` | uuid | RLS |
| `producto_id`, `proveedor_id` | uuid | FK RESTRICT; índice `(comercio_id, proveedor_id, producto_id, vigente_desde desc)` y `(comercio_id, producto_id, vigente_desde desc)` |
| `costo_neto` | decimal(14,2) ≥ 0 | sin IVA |
| `vigente_desde` | timestamptz | default `now()`; la carga manual puede indicar una fecha no futura |
| `origen` | enum `origen_precio` (`MANUAL`, `IMPORT`) | |
| `lote_id` | uuid nullable | agrupa las filas de una misma importación |
| `usuario_id` | uuid | quién lo registró |
| `creado_en` | timestamptz | |

Privilegios de `app_api`: `SELECT, INSERT` (mismo bloque de la migración de `movimiento`, sin la columna de anulación). "Lista vigente del proveedor" = última fila por producto (`DISTINCT ON (producto_id) … ORDER BY producto_id, vigente_desde DESC, creado_en DESC`). Alternativa descartada: guardar sólo el costo vigente por (producto, proveedor) con `UPDATE`; RN-08 pide historial y HU-03 lo necesita.

**D3 · `producto.proveedor_principal_id`** (uuid nullable, FK a `proveedor` con `ON DELETE SET NULL`, índice). `ProductoSchema` gana `proveedorPrincipal: { id, nombre } | null`; `ProductoPatchSchema` gana `proveedorPrincipalId: uuid | null`. Para devolverlo sin N+1, `ProductsService.listar()` hace `LEFT JOIN proveedor`. Al dar de baja un proveedor no se toca el principal de los productos (sigue siendo la fuente del costo vigente hasta que el dueño lo cambie); la web lo muestra atenuado.

**D4 · Regla RN-08 en un solo lugar: `PricesService.registrar(tx, { proveedorId, items, origen, loteId, vigenteDesde? })`.**
Dentro de una transacción de tenant: (1) verificar proveedor activo del comercio (404 si no existe, 409 si está dado de baja); (2) bloquear los productos afectados (`SELECT … FOR UPDATE` por ids, 404 si alguno falta); (3) `INSERT` de las filas; (4) para cada producto: si no tiene proveedor principal → setearlo a este proveedor y `costo_reposicion = costo`; si el principal es este proveedor y la fila es la más reciente (`vigente_desde` ≥ la máxima existente) → `costo_reposicion = costo`; si no, nada. `PATCH /products/:id` con `costoReposicion` llama a este mismo método con `origen: MANUAL` cuando el producto tiene principal (CP-02.5e), y con `proveedorPrincipalId` distinto busca el último costo de ese proveedor y lo copia (CP-02.5c). Alternativa descartada: trigger en PostgreSQL; la regla en el servicio es testeable y visible, y el `FOR UPDATE` evita carreras entre una importación y una edición manual.

**D5 · Importación.**
`POST /suppliers/:id/price-list/preview` recibe `multipart/form-data` (`FileInterceptor('archivo')`, `limits.fileSize` 2 MB, memoria). `PriceListParser` detecta el tipo por extensión y firma (`PK` para xlsx): `.xlsx` con **`exceljs`** (`workbook.xlsx.load(buffer)`, primera hoja), `.csv` con un parser propio (`;` o `,` como separador, comillas simples, BOM tolerado; dos columnas alcanzan). Encabezados: se busca en la primera fila una columna cuyo texto normalizado esté en `codigo|código|sku|cod` y otra en `costo|costo_neto|costo neto|precio|precio_neto`; si no, columnas 1 y 2 y la primera fila se trata como dato salvo que no parezca numérica. Costo con coma decimal y separador de miles (`2.340,50` → `2340.50`). Tope 5.000 filas de datos (400 `VALIDACION` si se supera). Cada fila devuelve `{ fila, codigo, costoNeto, estado, productoId?, nombre?, costoAnterior?, error? }` con `estado` en `NUEVO | CAMBIA | IGUAL | SIN_PRODUCTO | INVALIDA` (`NUEVO` = el proveedor nunca informó ese producto; `IGUAL` = mismo costo que la última fila de ese proveedor; `CAMBIA` = distinto, con `costoAnterior`). Códigos repetidos en la planilla: la última fila gana y las anteriores quedan `INVALIDA` ("código repetido en la fila N"). `POST /suppliers/:id/price-list` recibe `{ items: [{ productoId, costoNeto }] }` (las filas `NUEVO` y `CAMBIA` que la web reenvía), genera `loteId`, descarta las que ya son iguales al vigente de ese proveedor y llama a D4 con `origen: IMPORT`. Alternativa descartada: SheetJS (`xlsx` de npm está en 0.18.5 con avisos de seguridad; las versiones nuevas no se publican en npm); procesar en el navegador (no sirve para mobile ni para HU-05).

**D6 · Endpoints (bajo `/api/v1`, Bearer, todos `@Roles('DUENIO')`, plan FREE).**

| Método y ruta | Notas |
| --- | --- |
| `GET /suppliers` | `q` (nombre, prefijo o contiene), `activo` (default true), cursor `(nombre, id)`, `limit` |
| `POST /suppliers` | 201; 409 nombre repetido |
| `GET /suppliers/:id` | 404 si es de otro comercio |
| `PATCH /suppliers/:id` | datos, lead time, confiabilidad, `activo: true` reactiva |
| `DELETE /suppliers/:id` | baja lógica, 200 con `activo: false` |
| `GET /suppliers/:id/prices` | lista vigente: último costo por producto, con `producto { id, codigo, nombre }`, cursor `(nombre, id)` |
| `POST /suppliers/:id/prices` | `{ items: [{ productoId, costoNeto }], vigenteDesde? }` → 201 con las filas creadas |
| `POST /suppliers/:id/price-list/preview` | multipart `archivo` → 200 `{ filas, resumen: { total, nuevos, cambios, iguales, sinProducto, invalidas } }` |
| `POST /suppliers/:id/price-list` | `{ items }` → 201 `{ loteId, insertados, productosActualizados }` |
| `GET /products/:id/prices` | historial del producto: filas con `proveedor { id, nombre }`, cursor `(vigenteDesde, id)` desc |

Módulos NestJS: nuevo `suppliers` (`SuppliersController`, `SuppliersService`, `PricesService`, `PriceListParser`, `PriceListController` o rutas dentro del mismo controlador); `products` (proveedor principal, `GET /products/:id/prices`, `PATCH` que delega en `PricesService`); `prisma` (`TENANT_MODELS` suma `Proveedor` y `PrecioProveedor`). `ProductsModule` importa `SuppliersModule`; `suppliers` no importa `products` (lee `producto` por Prisma directamente). Se toca `packages/shared` y el contrato OpenAPI (Swagger: `@ApiConsumes('multipart/form-data')` y `@ApiBody` con `type: 'string', format: 'binary'`). Dependencias nuevas: `exceljs` (runtime) y `@types/multer` (dev).

**D7 · Esquemas compartidos.**
`ProveedorSchema`, `ProveedorCreateSchema` (nombre 2–120, email opcional válido, teléfono ≤ 40, CUIT con el `CuitSchema` existente, `leadTimeDias` entero ≥ 0 default 7, `confiabilidad` entero 1–5 default 3, notas ≤ 500), `ProveedorPatchSchema` (opcionales más `activo`, al menos un campo), `ProveedoresQuerySchema`, `PrecioProveedorSchema`, `PreciosCreateSchema` (`items` 1–500 con `productoId` uuid y `costoNeto` `MontoSchema`, sin `productoId` repetido; `vigenteDesde` ISO no futura opcional), `FilaVistaPreviaSchema` con `ESTADOS_FILA_IMPORTACION`, `VistaPreviaSchema`, `ImportacionConfirmSchema` (`items` 1–5000), `ResultadoImportacionSchema`. `ProductoSchema` y `ProductoPatchSchema` se amplían (D3). Etiquetas en español para orígenes y estados de fila.

**D8 · Web.**
Rutas `/proveedores` (listado con buscador, chips Activos/Dados de baja, columnas nombre, contacto, lead time, confiabilidad como estrellas; "Nuevo proveedor"; baja/reactivar por fila), `/proveedores/nuevo` y `/proveedores/:id/editar` (`ProveedorForm`), `/proveedores/:id` (ficha: datos, lista vigente con producto y costo, botones "Cargar costo" (modal o formulario inline: buscador de producto reutilizando `useProductos({ q })` + costo) e "Importar lista" → `/proveedores/:id/importar`: paso 1 elegir archivo y subir; paso 2 tabla de vista previa con filtros por estado y resumen, botón "Confirmar N costos" que reenvía las filas `NUEVO` y `CAMBIA`; paso 3 resultado con enlace a la ficha). En `ProductoFormPage`: selector de proveedor principal (lista de proveedores activos, con "Sin proveedor") y, al editar, sección "Historial de costos" (últimas filas con proveedor, costo, fecha y origen, "Ver más"). Enlace "Proveedores" en `AppShell` y tarjeta en el inicio, sólo DUENIO; `RequireRole(['DUENIO'])` en las rutas.

**D9 · Tests.**
e2e `suppliers.e2e-spec.ts` con dos comercios y los tres roles: CP-02.1 a CP-02.7 incluyendo la importación con un `.xlsx` generado en el test con `exceljs` y un `.csv` en memoria (Supertest `.attach('archivo', buffer, 'lista.csv')`). Unit tests de `PriceListParser` (encabezados, decimales, separadores, repetidos, tope de filas) y de los esquemas en `shared`. `rls.e2e-spec.ts` cubre las dos tablas por `TENANT_MODELS` y suma la verificación de privilegios de `precio_proveedor`. `products.e2e-spec.ts` agrega CP-01.4d. `helpers.ts` limpia `precio_proveedor` y `proveedor` antes que `producto`.

**D10 · ADR.**
`docs/adr/0007-listas-de-precios-historial-y-costo-vigente.md`: historial de sólo inserción, regla RN-08 en el servicio con bloqueo de producto, importación en dos pasos sin persistir el archivo, `exceljs` en lugar de SheetJS.

## Risks / Trade-offs

- [`exceljs` pesa varios MB y carga workbooks en memoria] → Tope de 2 MB y 5.000 filas; se importa de forma diferida (`import()`) sólo en el parser para no penalizar el arranque en Render Free.
- [Multipart en Render Free detrás de proxy] → Tamaño chico; `FileInterceptor` en memoria, sin disco. Verificado en producción en la tarea de cierre.
- [Un proveedor dado de baja sigue siendo principal de productos] → Decisión explícita (D3): el costo vigente no cambia solo; la web lo señala y ofrece cambiarlo. HU-06 ignorará proveedores inactivos para el lead time.
- [Edición manual del costo genera filas `MANUAL` "a nombre" del proveedor principal] → Es la forma de que el historial sea completo; el origen `MANUAL` y el usuario dejan claro que no vino de una lista.
- [Confirmación duplicada de la misma vista previa] → Idempotente por construcción: se descartan los costos iguales al vigente del proveedor (CP-02.4e).
- [Vista previa y confirmación con la planilla cambiada entre medio] → La confirmación recalcula contra el estado actual, no confía en `costoAnterior`.

## Migration Plan

1. Migración `20260923_suppliers_price_lists`: enum `origen_precio`, tablas `proveedor` y `precio_proveedor`, `producto.proveedor_principal_id`, índices, `CHECK`s, RLS (bloque del runbook), privilegios de sólo inserción para `precio_proveedor`. Aditiva; sin backfill (los productos existentes quedan sin proveedor principal y conservan su costo).
2. Aplicar en Neon dev, correr e2e; `prisma migrate deploy` corre en Render al desplegar `main`.
3. Rollback: `ALTER TABLE producto DROP COLUMN proveedor_principal_id`, `DROP TABLE precio_proveedor, proveedor`, `DROP TYPE origen_precio`.

## Open Questions

- Texto de ayuda del formato de planilla en la interfaz (ejemplo descargable de `.csv`). No cambia specs ni tareas.
