## Context

Tras `product-catalog`: `Producto` guarda `stock_actual` y `stock_seguridad`, `PATCH /products` rechaza `stockActual`, el listado filtra por `estadoStock` derivado (`calcularEstadoStock` en `shared`) y `ProductsService.crear()` fija el stock inicial dentro de `transaccionTenant`, bloqueando la fila de `comercio` con `FOR UPDATE`. `TenantContext` expone `comercioId`, `usuarioId`, `rol` y `plan`. `TENANT_MODELS` contiene `Usuario` y `Producto`; el runbook `docs/runbooks/rls.md` fija el checklist de toda tabla nueva. La convención de listado es cursor opaco base64url y `{ items, siguienteCursor }`. `bootstrap.ts` ya admite la cabecera `Idempotency-Key` en CORS. El interceptor de campos sensibles oculta claves `costo*`/`margen*` al EMPLEADO. La web tiene `AppShell` con navegación por rol, `useProductos` con `useInfiniteQuery`, `Campo` y `Aviso`. Comportamiento en `specs/stock-movements`; motivación en proposal.md.

## Goals / Non-Goals

**Goals:**
- Un único camino para cambiar el stock: `MovementsService.registrar()`; ni el catálogo ni futuras historias (HU-05, HU-07) tocan `stock_actual` por otra vía.
- Corrección de stock atómica y serializada por producto; sin negativos aunque dos cajas vendan lo mismo a la vez.
- Historial consultable por período y producto con el mismo esquema de paginación del catálogo, para que HU-03, HU-04 y HU-06 lo consuman sin cambios de contrato.

**Non-Goals:**
- Valorización del stock, costo por movimiento, velocidad de venta, punto de reposición, alertas por correo, ventas multi-producto, comprobantes fiscales, importación masiva de movimientos.

## Decisions

**D1 · Modelo `Movimiento` (tabla `movimiento`).**

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | |
| `comercio_id` | uuid | RLS; índices `(comercio_id, fecha desc, id desc)` y `(comercio_id, producto_id, fecha desc, id desc)` |
| `producto_id` | uuid | FK a `producto` (RESTRICT) |
| `usuario_id` | uuid | FK a `usuario` (RESTRICT); quién lo registró (auditoría mínima, arquitectura §4) |
| `tipo` | enum `tipo_movimiento` (`VENTA`, `INGRESO`, `AJUSTE`) | |
| `cantidad` | integer | como lo escribió el usuario: > 0 en VENTA e INGRESO; ≠ 0 y con signo en AJUSTE |
| `efecto_stock` | integer | delta aplicado: `-cantidad` en VENTA, `+cantidad` en INGRESO, `cantidad` en AJUSTE |
| `stock_resultante` | integer ≥ 0 | stock del producto después de aplicar el movimiento |
| `precio_unitario` | decimal(14,2) nullable | sólo VENTA: `producto.precio_venta` vigente (con IVA) |
| `motivo` | enum `motivo_movimiento` nullable | `STOCK_INICIAL`, `COMPRA`, `DEVOLUCION`, `INVENTARIO`, `ROTURA`, `VENCIMIENTO`, `ROBO`, `USO_INTERNO`, `ANULACION`, `OTRO`; obligatorio en AJUSTE, opcional en INGRESO, nulo en VENTA |
| `observacion` | varchar(200) nullable | texto libre |
| `fecha` | timestamptz | fecha del hecho; ≤ ahora; default `now()` |
| `corrige_a_id` | uuid nullable | FK a `movimiento`; sólo en AJUSTE de anulación |
| `anulado_por_id` | uuid nullable | FK a `movimiento`, único; se completa en el original al anularlo (única escritura sobre una fila existente, hecha por la transacción de anulación) |
| `clave_idempotencia` | varchar(64) nullable | índice único parcial `(comercio_id, clave_idempotencia) WHERE clave_idempotencia IS NOT NULL` |
| `creado_en` | timestamptz | momento del registro (distinto de `fecha` si se cargó retroactivo) |

`CHECK (efecto_stock <> 0)`, `CHECK (stock_resultante >= 0)`, y en `producto` `CHECK (stock_actual >= 0)`. Sin `actualizado_en`: la fila no se edita. Alternativa descartada: guardar sólo `cantidad` con signo y derivar el efecto; se guardan ambos para que el historial muestre "Venta 2" y el motor de HU-03 sume `efecto_stock` sin mirar el tipo.

**D2 · Inmutabilidad también en la base.**
La migración otorga a `app_api` sólo `SELECT, INSERT` sobre `movimiento` más `UPDATE (anulado_por_id)` a nivel de columna (`GRANT UPDATE (anulado_por_id) ON movimiento TO app_api`). Como los privilegios por defecto del runbook dan `SELECT, INSERT, UPDATE, DELETE` a toda tabla nueva, la migración los revoca explícitamente para esta tabla (`REVOKE UPDATE, DELETE ON movimiento FROM app_api` y luego el grant de columna). En CI el rol existe antes de migrar, así que el mismo SQL aplica. La política RLS es la del runbook (`movimiento_tenant`, `movimiento_sistema`) con `FORCE`. Alternativa descartada: trigger `BEFORE UPDATE/DELETE` que lance excepción; los privilegios son más simples de auditar y ya son la práctica del proyecto.

**D3 · Transacción de registro (`MovementsService.registrar()`).**
Dentro de `transaccionTenant`: (1) `SELECT … FROM producto WHERE id = $1 AND comercio_id = $2 FOR UPDATE` (404 si no existe en el comercio; 409 si `activo = false`); (2) calcular `efectoStock` y `stockResultante`; si `stockResultante < 0`, 409 `CONFLICTO` con `details { stockActual, cantidad }`; (3) `INSERT movimiento` con `stock_resultante` y, en VENTA, `precio_unitario = producto.precio_venta`; (4) `UPDATE producto SET stock_actual = $resultante`; (5) devolver el movimiento mapeado con `estadoStock = calcularEstadoStock(stockResultante, stockSeguridad)`. El bloqueo de fila serializa los movimientos del mismo producto (CP-10.2b) y evita el negativo antes de que el `CHECK` lo haga; el `CHECK` queda como red de seguridad. Alternativa descartada: `UPDATE producto SET stock_actual = stock_actual + delta WHERE stock_actual + delta >= 0` sin bloqueo; no permite devolver `stockResultante` consistente ni el mensaje con el stock actual.

**D4 · Anulación.**
`POST /movements/:id/anular` (DUENIO) en una transacción de tenant: bloquear el original (404 si es de otro comercio), 409 si ya tiene `anulado_por_id` o si es un AJUSTE con `corrige_a_id` (una anulación no se anula), luego `registrar()` con `tipo: AJUSTE`, `cantidad: -efecto_stock del original`, `motivo: ANULACION`, `corrige_a_id: original`, y `UPDATE movimiento SET anulado_por_id = nuevo WHERE id = original`. Si el ajuste inverso dejaría stock negativo (anular un INGRESO ya vendido) se rechaza con el 409 de D3. Alternativa descartada: `PATCH /movements/:id` con `anulado: true`; oculta que la corrección es un movimiento nuevo (RN-07).

**D5 · Idempotencia.**
`Idempotency-Key` (1–64 caracteres) se guarda en `clave_idempotencia`. Antes de bloquear el producto, `SELECT` por `(comercio_id, clave)`; si existe, responder 200 con ese movimiento (`@HttpCode` dinámico: el controlador devuelve 201 sólo cuando el servicio indica `creado: true`). Si dos requests con la misma clave llegan en paralelo, el índice único falla en la segunda con P2002 y se reintenta la lectura una vez. No se compara el cuerpo: la clave la genera el cliente por intento (uuid v4 en la web al abrir el formulario, renovada tras cada éxito). Alternativa descartada: tabla aparte de claves con TTL; innecesaria para el volumen previsto y el historial es permanente igual.

**D6 · Stock inicial y backfill.**
`ProductsService.crear()` pasa a llamar `MovementsService.registrarEnTransaccion(tx, …)` con `tipo: INGRESO`, `cantidad: stockInicial`, `motivo: STOCK_INICIAL` cuando `stockInicial > 0`, dentro de la misma transacción del alta (la fila de `producto` recién creada no necesita `FOR UPDATE`). `MovementsModule` exporta el servicio y `ProductsModule` lo importa (sin dependencia circular: `movements` no importa `products`). La migración inserta un `INGRESO STOCK_INICIAL` por cada producto existente con `stock_actual > 0`, con `fecha = creado_en`, `usuario_id` = el DUENIO activo más antiguo del comercio y `stock_resultante = stock_actual`; corre como propietaria, así que RLS no interfiere. En producción hoy hay 0 productos; el backfill importa para dev y para cualquier comercio creado antes del deploy.

**D7 · Listado.**
Orden `fecha DESC, id DESC`; cursor base64url de `[fecha ISO, id]`; condición `(fecha, id) < (cursor.fecha, cursor.id)`. Filtros: `productoId`, `tipo`, `desde`/`hasta` (ISO 8601; `hasta` inclusivo hasta el fin del instante indicado; 400 si `hasta < desde`), `limit` 1–100 default 25. SQL crudo con `JOIN producto` y `JOIN usuario` para devolver `producto { id, codigo, nombre }` y `usuario { id, nombre }` sin N+1, mismo patrón que `ProductsService.listar()`. Sin búsqueda por texto: se llega por producto desde Inventario.

**D8 · Endpoints (bajo `/api/v1`, Bearer).**

| Método y ruta | Roles | Plan | Notas |
| --- | --- | --- | --- |
| `GET /movements` | DUENIO, EMPLEADO, CONTADOR | FREE | `productoId`, `tipo`, `desde`, `hasta`, `cursor`, `limit` |
| `GET /movements/:id` | DUENIO, EMPLEADO, CONTADOR | FREE | 404 si es de otro comercio |
| `POST /movements` | DUENIO, EMPLEADO | FREE | 201 (200 si repite `Idempotency-Key`); 400/404/409 |
| `POST /movements/:id/anular` | DUENIO | FREE | 201 con el AJUSTE inverso; 409 si ya anulado o es anulación |

No hay `PATCH` ni `DELETE`. `precioUnitario` no es sensible (el EMPLEADO ve precios de venta); el interceptor sigue ocultando `costo*` si algún día se agrega. Módulos NestJS afectados: nuevo `movements`; `products` (alta con ingreso inicial); `prisma` (`TENANT_MODELS`). Se toca `packages/shared` y el contrato OpenAPI.

**D9 · Esquemas compartidos.**
`TIPOS_MOVIMIENTO`, `MOTIVOS_MOVIMIENTO`, `MovimientoSchema` (respuesta con `producto`, `usuario`, `estadoStock`, `corrigeAId`, `anuladoPorId`), `MovimientoCreateSchema` (discriminado por `tipo`: VENTA e INGRESO exigen `cantidad` entero > 0, AJUSTE exige entero ≠ 0 y `motivo`; `fecha` ISO opcional ≤ ahora con tolerancia de 5 minutos por desfase de reloj; `observacion` ≤ 200), `AnulacionSchema` (`observacion` opcional), `MovimientosQuerySchema`, `ListaMovimientosSchema`. Etiquetas en español de tipos y motivos (`ETIQUETA_TIPO`, `ETIQUETA_MOTIVO`) en `shared` para que web y mobile muestren lo mismo.

**D10 · Web.**
Rutas `/movimientos` (historial global: filtros tipo, desde/hasta, producto; tabla fecha, tipo, producto, cantidad con signo, stock resultante, usuario, motivo; botón "Anular" sólo DUENIO en filas no anuladas y no anulaciones, con confirmación) y `/movimientos/nuevo?productoId=` (formulario: tipo como segmentos Venta/Ingreso/Ajuste, producto con buscador que reutiliza `useProductos({ q })`, cantidad, fecha y hora default ahora, motivo según tipo, observación; al confirmar muestra `Aviso` con el stock resultante y, si `estadoStock` no es `OK`, tono de advertencia; "Registrar otro" mantiene el tipo y limpia el resto). En `/productos`: acciones "Vender/Ingresar" (abre el formulario con el producto) y "Historial" (`/movimientos?productoId=`) para DUENIO y EMPLEADO. Inicio: tarjeta "Movimientos" con acceso directo y un resumen "N productos con stock bajo · M sin stock" calculado con dos consultas al listado existente (`estado=BAJO` y `estado=SIN_STOCK`, `limit=100`), mostrando "más de 100" si viene cursor; `GET /products` no cambia. Enlace "Movimientos" en `AppShell` para los tres roles (CONTADOR sólo lectura, sin botón de registro).

**D11 · Tests.**
e2e `movements.e2e-spec.ts` con dos comercios y los tres roles: CP-10.1 a CP-10.10 incluida la concurrencia (10 `POST` en paralelo con `Promise.all`) y la idempotencia; `rls.e2e-spec.ts` cubre `Movimiento` al recorrer `TENANT_MODELS` y suma CP-10.7c (privilegios de `app_api` sobre `movimiento`, consultando `information_schema.role_table_grants`). `helpers.ts` limpia `movimiento` antes que `producto`. Unit tests de `MovimientoCreateSchema` (discriminación por tipo, fecha futura) y del cursor.

**D12 · ADR.**
`docs/adr/0006-movimientos-inmutables-stock-transaccional.md`: stock almacenado en `producto` y actualizado en la misma transacción que el movimiento con bloqueo de fila; inmutabilidad garantizada por privilegios de base; anulación como ajuste inverso. Alternativas: stock calculado como suma del histórico (lento para el dashboard, RNF-04) y edición/borrado con auditoría (contradice RN-07).

## Risks / Trade-offs

- [El bloqueo `FOR UPDATE` por producto serializa las ventas de un mismo artículo] → Es el comportamiento buscado; las transacciones son cortas (un `SELECT`, un `INSERT`, un `UPDATE`). Con el pooler de Neon en modo transacción no hay problema porque todo ocurre dentro de una transacción.
- [Precio unitario congelado en la venta pero costo vigente en el producto] → Coherente con RN-08 (el margen se recalcula con el costo vigente). Cuando HU-02 traiga historial de costos, HU-03 puede elegir el costo vigente a la fecha de la venta sin cambiar esta tabla.
- [Fecha retroactiva permite "reescribir" el período de un reporte] → Aceptado para el MVP (cargar ventas del fin de semana el lunes es un caso real). `creado_en` queda como evidencia; HU-09 puede marcar reportes ya emitidos.
- [`REVOKE UPDATE` sobre `movimiento` rompe si alguna migración futura necesita corregir datos] → Las migraciones corren como propietaria, no como `app_api`.
- [Backfill con `usuario_id` del dueño más antiguo puede no ser quien cargó el producto] → Es una aproximación explícita para productos anteriores a HU-10; el motivo `STOCK_INICIAL` lo deja claro.
- [Dos consultas para el resumen de stock bajo en el inicio] → Suficiente para el MVP; HU-04 traerá `GET /dashboard` con ese conteo.

## Migration Plan

1. Migración `20260922_stock_movements`: enums, tabla, índices, `CHECK`s, RLS (bloque del runbook), privilegios de D2, backfill de D6. Aditiva salvo el `CHECK` en `producto`, que hoy se cumple (no hay stock negativo posible por el catálogo).
2. Aplicar en Neon `dev`, correr e2e; `prisma migrate deploy` corre en Render al desplegar `main`.
3. Rollback: `DROP TABLE movimiento`, `DROP TYPE tipo_movimiento, motivo_movimiento`, `ALTER TABLE producto DROP CONSTRAINT producto_stock_actual_check`. Los productos conservan su `stock_actual`.

## Open Questions

- Etiqueta exacta de los motivos en la interfaz (por ejemplo "Rotura" vs. "Producto dañado"). No cambia specs ni tareas.
