# ADR 0021 · Stock parado calculado al consultar, por fecha de venta

**Estado:** aceptada · 01/10/2026

## Contexto

"Falta de stock" (HU-18, ADR 0020) muestra la plata que se pierde por no tener mercadería. HU-19 (RF-20), del plan PRO, pide lo contrario: cuánta plata está inmovilizada en productos que no se venden. `producto` guarda el stock, el costo vigente (RN-08) y la fecha de alta. Las ventas están en `movimiento`, que tiene índices por `(comercio_id, fecha)` y por `(comercio_id, producto_id, fecha)`.

## Decisión

1. **RN-15**: un producto activo con stock mayor a 0 está parado si no tuvo ventas no anuladas en los últimos N días (30, 60, 90 o 180). Los dados de alta dentro del período no cuentan. El capital parado es stock × costo vigente. Los días sin vender se cuentan desde la última venta o, si nunca se vendió, desde el alta.
2. **La fecha de la venta, no la de registro**: el período y la última venta usan `movimiento.fecha`, así que una venta cargada tarde cuenta el día en que ocurrió. En los quiebres se usa `creado_en` porque ahí importa el orden en que cambió el stock; acá importa cuándo se vendió.
3. **Nada se guarda y no hay índices nuevos**: se hacen tres consultas de una tabla y el cruce en memoria. La primera trae los productos activos. La segunda, los productos con ventas en el período, sobre el índice por fecha. La tercera, la última venta de los candidatos, con una sola agregación agrupada por producto. Una subconsulta por candidato tardó 6,5 s en CI con la tabla recién cargada, porque el planificador recorría todos los movimientos en cada una.
4. **RN-15 vive en `packages/shared`** (`stock-parado.ts`) como funciones puras. El porcentaje del stock se calcula sobre el mismo stock valorizado que muestra el panel.
5. **El reloj inyectable pasa a `common/reloj.ts`** (`RELOJ`) y lo usan los quiebres y el stock parado.
6. **Panel**: el bloque `stockParado` usa siempre 90 días y vale `null` debajo de PRO. Su tarjeta va junto a la de falta de stock.

## Alternativas consideradas

- **Guardar `ultima_venta` en `producto`**: lectura más barata, pero hay que mantenerla en cada venta y anulación, y rellenarla en una migración.
- **`LEFT JOIN LATERAL` en una sola consulta**: deja el plan en manos de las estadísticas, lo que hizo lentos al panel y a la inflación con tablas recién cargadas.
- **Incluir rotación lenta** (productos con cobertura de muchos meses): necesita otra definición y otra columna en la tabla. Queda para una change posterior.

## Consecuencias

- Un producto de temporada figura como parado fuera de su temporada. Es información útil igual, y el selector de 180 días da perspectiva.
- El panel de los comercios PRO suma una consulta más. La prueba de carga de 5.000 productos y 50.000 movimientos cubre el endpoint.
