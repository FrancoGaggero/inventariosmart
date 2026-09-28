## Context

Ver proposal.md – Why. Lo que existe y esta change reutiliza:

- `InsightsService.inflacion(q)` ([insights.service.ts](../../../apps/api/src/insights/insights.service.ts)) ya devuelve por producto activo el precio inicial y final, los costos, el estado (`ATRASADO`, `ALINEADO`, `ADELANTADO`) y los dos precios sugeridos (`precioSugeridoInflacion`, `precioSugeridoMargen`), para un período que recorta al último IPC publicado.
- `registrarPreciosVenta(tx, filas)` ([price-history.ts](../../../apps/api/src/products/price-history.ts)) inserta en lote el historial de precios; el origen es el enum `origen_precio_venta` (`ALTA`, `EDICION`, `IMPORT`, `INICIAL`).
- `ImportService.confirmar` actualiza hasta 5.000 productos con una sola sentencia `UPDATE … FROM unnest(…)`: el mismo patrón sirve acá.
- `precioNeto`, `margenBruto`, `porcentaje` y `redondear2` en `packages/shared/src/rentabilidad.ts` (RN-01, RN-03).
- `ui/Confirmar` (diálogo accesible), `InflacionPage` con su filtro por estado y selector de período, y la barra de navegación que muestra etiquetas sólo si entran.
- `producto.precio_venta` es el precio con IVA; el precio de una venta se copia al movimiento al venderla, así que remarcar no altera ventas pasadas.

Restricciones: toda tabla de negocio lleva `comercio_id` y RLS; el historial de precios es de sólo inserción; montos `DECIMAL(14,2)` como string; los e2e corren contra tablas recién cargadas, así que las consultas no pueden depender de las estadísticas del planificador (lección de `inflation-insights`).

## Goals / Non-Goals

**Goals:**
- Que remarcar 200 productos sea una decisión y no 200 ediciones.
- Que el dueño vea exactamente lo que se va a aplicar, con el margen antes y después.
- Que una remarcación equivocada se pueda deshacer sin perder rastro.

**Non-Goals:**
- Remarcación programada o automática, reglas por categoría o proveedor, cambio de costos, impresión de etiquetas, mobile.

## Decisions

### D1 · Reglas en `packages/shared/src/remarcacion.ts`
Funciones puras con tests:
- `CRITERIOS_REMARCACION = ['INFLACION','MARGEN','PORCENTAJE','MARGEN_OBJETIVO']`, `REDONDEOS = ['NINGUNO','PESO','DECENA','CENTENA']`, `RESULTADOS = ['SUBE','BAJA','SIN_CAMBIO','SIN_DATOS']`, `MAX_PRODUCTOS_LOTE = 5000`, `PORCENTAJE_MAX = 500`, `MARGEN_OBJETIVO_MAX = 95`.
- `redondearPrecio(precio, redondeo)`: primero lleva el valor a centavos (evita que 2989,9999… suba a 3000) y después redondea hacia arriba al múltiplo (CP-17.2b).
- `precioPorPorcentaje(precio, pct)`, `precioPorMargenObjetivo(costo, margenPct, alicuotaIva)` (devuelve null con costo no positivo).
- `calcularItem({ precioActual, costo, alicuotaIva, precioCalculado, redondeo, permitirBajas })` → `{ precioNuevo, variacion, margenBrutoPctActual, margenBrutoPctNuevo, resultado }`; aplica RN-12 (un precio menor o igual al actual es `SIN_CAMBIO` salvo `permitirBajas`). Sin costo cargado el margen es `null`: daría 100 % y no es un dato.
- `CuitSchema` pasa de `index.ts` a `cuit.ts`: `proveedores.ts` importaba el índice y ese ciclo dejaba sin inicializar los esquemas que `remarcacion.ts` toma de otros módulos.
- `resumirRemarcacion(items)`.
- Esquemas zod: `RemarcacionPreviewSchema` (unión discriminada por `criterio`: `INFLACION` y `MARGEN` con `desde` / `hasta` opcionales como HU-15; `PORCENTAJE` con `porcentaje` > 0 y ≤ 500; `MARGEN_OBJETIVO` con `margen` > 0 y ≤ 95; comunes: `productoIds` opcional hasta 5.000, `estado` opcional, `redondeo` default `NINGUNO`, `permitirBajas` default false), `RemarcacionApplySchema` (`criterio`, `parametros`, `items[]` de `{ productoId, precioActual, precioNuevo }` sin repetidos, 1 a 5.000), `ItemRemarcacionSchema`, `LoteRemarcacionSchema`, `ListaLotesSchema`, `ResultadoReversionSchema`.

### D2 · Modelo de datos
Migración `20261001_bulk_repricing`:
- `ALTER TYPE "origen_precio_venta" ADD VALUE 'REMARCACION'`. La migración sólo agrega el valor y no lo usa: PostgreSQL no permite usar un valor nuevo de un enum en la misma transacción que lo crea.
- `remarcacion`: `id`, `comercio_id`, `usuario_id`, `criterio` (enum `criterio_remarcacion`), `parametros JSONB`, `cantidad INT`, `creado_en`, `revertido_en NULL`, `revertido_por_id NULL`, `revertidos INT NULL`, `omitidos INT NULL`; índice `(comercio_id, creado_en DESC, id DESC)`.
- `remarcacion_item`: `id`, `comercio_id`, `remarcacion_id`, `producto_id`, `precio_anterior DECIMAL(14,2)`, `precio_nuevo DECIMAL(14,2)`, `revertido BOOLEAN DEFAULT false`; único `(remarcacion_id, producto_id)`; índice `(comercio_id, producto_id)`.
- RLS de tenant y de sistema en las dos; `app_api` con `SELECT, INSERT, UPDATE` y sin `DELETE` (como `alerta`): el lote se actualiza al deshacer y no se borra. Las dos entran en `TENANT_MODELS`.
Queda en **ADR 0016**.

### D3 · Vista previa (`RepricingService.vistaPrevia`)
Sólo lectura. Para `INFLACION` y `MARGEN` llama a `InsightsService.inflacion({ desde, hasta })` y toma de cada producto `precioFinal` como referencia de costo y los sugeridos; el precio actual sale siempre de `producto.precio_venta` (el de hoy, no el del cierre del período). Para `PORCENTAJE` y `MARGEN_OBJETIVO` alcanza con una consulta a `producto` (precio, costo de reposición, alícuota). El filtro por `productoIds` o `estado` se aplica sobre esa lista; `estado` usa el estado de HU-15 y por eso también llama a `InsightsService`. Cada producto pasa por `calcularItem`. Si el IPC no está disponible (`motivo: SIN_IPC`), el criterio `INFLACION` devuelve todos los productos como `SIN_DATOS`.

### D4 · Aplicación (`RepricingService.aplicar`)
Una transacción de tenant:
1. `SELECT id, precio_venta, alicuota_iva, activo FROM producto WHERE comercio_id = … AND id = ANY(…) FOR UPDATE`, en una sola consulta.
2. Verificaciones en memoria: todos existen (si no, 404), todos activos y precio nuevo distinto del actual (si no, 400 con `details.items`), y precio actual igual al enviado (si no, 409 `CONFLICTO` con `details.productos: [{ productoId, codigo, precioActual }]`). Cualquier falla aborta sin escribir.
3. `UPDATE producto … FROM unnest(ids, precios)` en una sentencia.
4. `registrarPreciosVenta` con origen `REMARCACION`, que pasa a insertar con `INSERT … SELECT FROM unnest(…)` (también para la importación).
5. `remarcacion` y sus ítems, también por arreglos: con 5.000 filas viaja una fracción de lo que mandaba `createMany`.

El cuerpo de 5.000 productos pesa unos 500 kB y el límite por defecto de la API era 100 kB: `configurarApp` lo sube a 2 MB (`LIMITE_JSON`), lo que también destraba una importación de ese tamaño.
Responde 201 con el lote. El bloqueo `FOR UPDATE` serializa dos remarcaciones simultáneas sobre los mismos productos.

### D5 · Deshacer (`RepricingService.deshacer`)
Transacción: toma el lote con `updateMany({ where: { id, comercioId, revertidoEn: null }, … })` para que dos pedidos simultáneos no pasen los dos (`count === 0` → 409). Bloquea los productos del lote, separa los que siguen con `precio_venta = precio_nuevo` (se revierten) de los que cambiaron o están dados de baja (se omiten), actualiza los primeros con `unnest`, registra su historial con origen `REMARCACION` y marca `remarcacion_item.revertido`. Responde `{ lote, revertidos, omitidos: [{ productoId, codigo, nombre, precioActual }] }`.

### D6 · Endpoints y permisos

| Método y ruta | Roles | Descripción |
| --- | --- | --- |
| `POST /repricing/preview` | DUENIO, CONTADOR | Vista previa; no escribe |
| `POST /repricing/apply` | DUENIO | Aplica y crea el lote (201) |
| `GET /repricing/batches?cursor&limit` | DUENIO, CONTADOR | Lotes por cursor |
| `GET /repricing/batches/:id` | DUENIO, CONTADOR | Detalle con ítems |
| `POST /repricing/batches/:id/revert` | DUENIO | Deshace una vez |

Todas con `@RequierePlan('PRO')`. `RepricingModule` importa `InsightsModule`, que pasa a exportar `InsightsService`. `POST /repricing/preview` responde 200 (`@HttpCode(200)`): no crea nada.

### D7 · Web
- `InflacionPage`: botón "Remarcar" (DUENIO y CONTADOR) que navega a `/remarcar?estado=ATRASADO&desde=…`.
- `features/remarcacion/RemarcarPage.tsx` (`/remarcar`): chips de criterio, campo del parámetro (porcentaje o margen), selector de redondeo, casilla "permitir bajas", resumen (suben, sin cambio, sin datos) y tabla con precio actual, precio nuevo editable, variación y margen antes y después; tarjetas por debajo de `md`; casilla por fila para quitar productos. "Aplicar a N productos" abre `ui/Confirmar`. Tras aplicar, aviso con enlace al lote. Un 409 muestra qué productos cambiaron y ofrece recalcular.
- `features/remarcacion/RemarcacionesPage.tsx` (`/remarcaciones`): lotes con criterio en lenguaje claro ("Subió 15 %, redondeado a la decena"), quién, cuándo, cantidad y estado; detalle plegable; "Deshacer" con `ui/Confirmar`.
- `lib/remarcacion.ts` (hooks; invalidan productos, inflación, panel y rentabilidad) y `lib/remarcacion-formato.ts` (textos puros con test, sin importar la sesión).
- `AppShell`: enlace "Remarcaciones" (`Tags`) para DUENIO y CONTADOR con plan PRO.

### D8 · Tests
Shared `remarcacion.test.ts`: los números de CP-17.1 a CP-17.2b (20,80 %, 27,40 %, 9,09 %, 1270, 2990, 1400, 1452 → 1500, 41,92 %, −7,69 %), redondeo de valores con error de coma flotante, costo cero, esquemas inválidos. e2e `repricing.e2e-spec.ts`: los criterios que no usan el IPC, aplicación, lotes, deshacer, permisos, dos aplicaciones simultáneas y un lote de 5.000 productos en menos de 3 s. Los casos que dependen del IPC (CP-17.1, CP-17.1d, CP-17.2 con inflación) van en `inflation.e2e-spec.ts`: las tablas de indicadores son globales y una suite en paralelo las pisaría; `rls.e2e-spec.ts` cubre las dos tablas; CP-15.2e en `inflation.e2e-spec.ts`. Web: test de `remarcacion-formato`.

### D9 · Documentación
ADR 0016; README; `docs/arquitectura.html` (módulo `repricing`, RN-12); `docs/runbooks/rls.md`; `openspec/config.yaml` (HU-17, RF-18, RN-12); `openspec/CAPACIDADES.md`.

## Risks / Trade-offs

- [Remarcar por error cientos de productos] → vista previa obligatoria en la web, confirmación con la cantidad, y deshacer.
- [El precio cambió entre la vista previa y la aplicación] → control por precio esperado; no se aplica nada y se informa qué cambió.
- [Deshacer pisa un precio que el dueño corrigió después] → sólo se revierten los productos que siguen con el precio remarcado.
- [Criterio de inflación sin IPC] → `SIN_DATOS`, sin inventar un valor.
- [Bajar precios sin querer] → RN-12: hay que pedirlo explícitamente.
- [Un valor nuevo en un enum no se puede quitar] → `REMARCACION` es aditivo; un rollback deja el valor sin uso.

## Migration Plan

1. Migración aditiva con `prisma migrate deploy` en Neon dev y en producción por Render. 2. Deploy de API y web. 3. En producción, remarcar un producto de prueba y deshacerlo. Rollback: revertir el commit; las tablas y el valor del enum pueden quedar.

## Open Questions

Ninguna que bloquee.
