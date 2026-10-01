## Context

`producto` guarda `stock_actual`, `costo_reposicion` (el costo vigente, RN-08), `activo` y `creado_en`. Las ventas están en `movimiento` con `tipo = 'VENTA'` y `anulado_por_id` cuando se anularon. Hay índices por `(comercio_id, fecha)` y `(comercio_id, producto_id, fecha DESC, id DESC)`. "Falta de stock" (ADR 0020) ya reconstruye quiebres con `creado_en`; acá la pregunta es otra, cuándo se vendió por última vez, y la respuesta es la fecha del hecho. Motivación: ver proposal.md.

## Goals / Non-Goals

**Goals:**
- Listar los productos parados con su capital, sin recorrer el historial completo de movimientos.
- RN-15 en funciones puras de `packages/shared`, probadas con unitarios.

**Non-Goals:**
- Guardar el estado "parado" en una tabla o un job: se calcula al consultar, como el comparador y los quiebres.
- Rotación lenta (ver proposal.md, Fuera de alcance).

## Decisions

### D1. Tres consultas de una tabla y el cruce en memoria

Dentro de `transaccionTenant`, siguiendo la convención del proyecto:

1. Productos activos: `id`, `codigo`, `nombre`, `stock_actual`, `costo_reposicion` y `creado_en`. Se leen todos, porque el porcentaje sobre el stock valorizado necesita el total.
2. Productos con ventas en el período: `SELECT DISTINCT producto_id FROM movimiento WHERE comercio_id = … AND tipo = 'VENTA' AND anulado_por_id IS NULL AND fecha >= desde`, sobre el índice `(comercio_id, fecha)`.
3. La última venta de cada candidato: `unnest` de los ids con una subconsulta `max(fecha)` filtrada por producto, tipo y anulación, que usa el índice por producto y fecha. Candidatos son los activos con stock mayor a 0, dados de alta antes del inicio del período y sin ventas en él.

- *Alternativa:* un `LEFT JOIN LATERAL` en una sola consulta. Se descarta porque mezcla tablas y deja el plan en manos de las estadísticas, que fue lo que hizo lentos al panel y a la inflación con tablas recién cargadas.
- *Alternativa:* guardar `ultima_venta` en `producto`. Se descarta porque obliga a mantenerla en cada venta y anulación, y la migración tendría que rellenarla.

### D2. La fecha de la venta, no la de registro

El período y la última venta usan `movimiento.fecha`, la fecha del hecho. Una venta cargada tarde con su fecha real cuenta en el día en que ocurrió. En "Falta de stock" se usa `creado_en` porque importa el orden en que cambió el stock; acá importa cuándo se vendió.

### D3. RN-15 como funciones puras en `packages/shared/src/stock-parado.ts`

- `diasSinVender(ultimaVenta, alta, ahora)`: días enteros redondeados hacia abajo desde la última venta o, si no hay, desde el alta.
- `capitalParado(stock, costo)`: con dos decimales.
- `ordenarStockParado(items)`: capital descendente, después días sin vender y nombre.
- `totalizarStockParado(items, valorizacionTotal)`: capital, productos, unidades y porcentaje sobre el stock valorizado (`null` si es 0).
- Los esquemas `DeadStockQuerySchema` (`dias` en 30, 60, 90 o 180, `cursor`, `limit`), `ProductoParadoSchema`, `TotalesStockParadoSchema`, `ListaStockParadoSchema` y `StockParadoDashboardSchema`.

El stock valorizado total se calcula igual que `stock.valorizacion` del panel: Σ stock × costo de los activos. Así el porcentaje se puede comparar con lo que el dueño ya ve.

### D4. Orden y cursor de posición

Igual que el comparador y los quiebres: la lista se ordena en memoria, el cursor es la posición y los totales se calculan antes de paginar.

### D5. Endpoint, roles y plan

| Método | Ruta | Roles | Plan mínimo |
|---|---|---|---|
| GET | `/api/v1/dead-stock?dias&cursor&limit` | DUENIO, CONTADOR | PRO |
| GET | `/api/v1/dashboard` (bloque `stockParado`) | DUENIO, CONTADOR | FREE; el bloque es `null` debajo de PRO |

El EMPLEADO recibe 403 porque la respuesta trae costos. Se usa el mismo reloj inyectable que en quiebres (`RELOJ_QUIEBRES`, que se generaliza como `RELOJ` en `common/reloj.ts`), para que el e2e compruebe los días sin vender exactos.

### D6. Panel

`DashboardService` llama a `DeadStockService.totales(90)` en el mismo `Promise.all`, sólo si `planCumple(plan, 'PRO')`.

### D7. Web

- `lib/stock-parado-formato.ts` (puro, probado sin variables de entorno): `IDEAS_STOCK_PARADO`, `fraseTotales`, `ultimaVentaLegible` (fecha corta o "Nunca se vendió"), `diasSinVenderLegible` y `DIAS_STOCK_PARADO`.
- `lib/stock-parado.ts`: `useStockParado(dias)` con `useInfiniteQuery`.
- `features/stock-parado/StockParadoPage.tsx`: misma estructura que `QuiebresPage` (tarjetas, selector con chips, tabla en `card overflow-hidden` con columnas que se ocultan debajo de `lg`, tarjetas en mobile, "Ver más" y aviso de plan).
- Una tarjeta "Plata parada en stock" en el panel, junto a la de falta de stock: las dos en una grilla de dos columnas desde `md`, y cada una aparece sólo si su monto es mayor a cero. Hay enlaces cruzados en las cabeceras de "Falta de stock" y "Stock parado". La ruta `/stock-parado` va en el grupo de DUENIO y CONTADOR.

### Módulos afectados

- Nuevo `DeadStockModule` (`dead-stock.service.ts`, `dead-stock.controller.ts`, `dead-stock.dto.ts`), que exporta el servicio. Lo importan `AppModule` y `DashboardModule`.
- `common/reloj.ts` con el token `RELOJ` y su provider. `StockoutsService` pasa a usarlo, con el mismo comportamiento.
- `packages/shared`: `stock-parado.ts`, la funcionalidad `stockParado` en `planes.ts` (PRO) y el bloque en `DashboardSchema`. Hay que recompilar `dist`.
- Contrato OpenAPI y cliente TS regenerados. El cliente Dart no cambia.
- ADR 0021: "Stock parado calculado al consultar por fecha de venta".

## Risks / Trade-offs

- [Un producto de temporada (por ejemplo, anticongelante en verano) figura como parado] → Es información útil igual: la plata está parada. El selector de 180 días permite mirarlo con más perspectiva.
- [Un producto con ventas sólo anuladas en el período figura como parado] → Es correcto: una venta anulada no ocurrió.
- [La consulta 3 hace una subconsulta por candidato] → Usa el índice por producto y fecha, que corta en la primera venta. La prueba de carga CP-19.4, con 1.000 candidatos, fija el límite.
- [Mover el reloj a `common` toca `StockoutsService`] → El token cambia de nombre pero no de comportamiento. El e2e de quiebres se actualiza y tiene que seguir pasando.

## Migration Plan

Sin migración. El deploy es el normal de la API y la web, y para volver atrás alcanza con revertir el commit.
