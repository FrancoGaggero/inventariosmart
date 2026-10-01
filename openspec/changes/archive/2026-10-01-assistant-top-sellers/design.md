## Context

El asistente (HU-08, ADR 0018) responde con consultas predefinidas que reutilizan servicios de la API dentro del comercio del request. La consulta `productos_mas_rentables` llama a `ProfitabilityService.topEntre`, que suma las ventas por producto en una sola pasada sobre `movimiento` (`ventasPorProducto`: unidades e importe con IVA, ventas no anuladas, rango `[desde, hasta)`), cruza en memoria con los productos **activos** y ordena por margen bruto generado. El importe de cada venta es `cantidad × precio_unitario`, y `precio_unitario` es el precio de venta **con IVA** vigente al momento de la venta.

No hay ninguna consulta que ordene por unidades o por facturación. Ver proposal.md, Why.

## Goals / Non-Goals

**Goals:**
- Una consulta `productos_mas_vendidos` con criterio `UNIDADES` (por defecto) o `FACTURACION`, con totales y participación calculados sobre **todas** las ventas del período y no sólo sobre los 10 productos que se devuelven.
- Que el modelo elija bien entre vendidos, facturación y rentables, sin depender de la suerte.

**Non-Goals:**
- Endpoint REST nuevo o cambios en OpenAPI. La consulta vive sólo dentro del asistente, como las otras diez.
- Índices nuevos: la suma por producto usa el índice de `movimiento` por comercio y fecha, y es la misma que ya corre el panel cada vez que se abre.

## Decisions

### D1. Reutilizar `ventasPorProducto` desde un método nuevo de `ProfitabilityService`

Se agrega `ventasEntre(desde, hasta)`, que devuelve, por cada producto con ventas en el rango, código, nombre, estado activo, unidades, importe con IVA y alícuota. Corre en una transacción de tenant: primero la suma sobre `movimiento` y después, en una segunda consulta, los productos con esos ids. El cruce se hace en memoria, como en `topEntre`, para no depender del planificador (ver el comentario de `ventasPorProducto`).

- *Alternativa:* un servicio nuevo de "ventas". Se descarta porque duplicaría la consulta y `ProfitabilityService` ya es quien sabe sumar ventas por producto.
- *Alternativa:* ampliar `topEntre` con un parámetro de criterio. Se descarta porque `topEntre` filtra productos activos y devuelve márgenes, y lo usan el panel y el reporte semanal: cambiarlo arriesga esas pantallas.

### D2. El ranking es una función pura en `packages/shared`

`rankingDeVentas(filas, criterio, cantidad)` recibe las filas de D1 y devuelve `{ criterio, totalUnidades, totalFacturacionNeta, productos[] }`. Para cada fila calcula la facturación neta como `importe / (1 + alícuota/100)` redondeada a 2 decimales (RN-03). Ordena por el criterio, desempata por el otro criterio y después por nombre, y calcula dos participaciones con un decimal, `participacionUnidadesPct` y `participacionFacturacionPct`, sea cual sea el criterio. En producción (01/10/2026), con un único `participacionPct` que dependía del criterio, el modelo informó el 50 % de las unidades como "el 50 % de la facturación": con nombres explícitos no hay qué interpretar. Los totales se suman antes de recortar a `cantidad`, con un máximo de 10 (`ASISTENTE_MAX_FILAS`). Los montos viajan como string con dos decimales, igual que en el resto de la API.

Que sea pura permite probar con unitarios los desempates, el redondeo, la participación y la lista vacía, sin base de datos.

### D3. Los productos dados de baja se incluyen y se marcan

A diferencia de `topEntre`, la consulta no filtra por `activo`: si un producto se vendió en el período y después se dio de baja, sus unidades existieron y forman parte del total. Si se lo excluyera, la participación no sumaría 100 %. Cada producto lleva `dadoDeBaja: boolean` para que el asistente lo aclare si lo nombra.

### D4. El IVA se descuenta con la alícuota actual del producto

`movimiento` guarda el precio con IVA, pero no la alícuota vigente en esa venta. Se usa la alícuota actual del producto, el mismo criterio que usa hoy la rentabilidad por producto (HU-03).

### D5. Cómo elige el modelo

La descripción de la consulta nueva dice explícitamente "más vendidos, por unidades o por facturación, no por ganancia". La de `productos_mas_rentables` pasa a decir "ordenados por la ganancia (margen bruto)… no por unidades". Las instrucciones suman un párrafo con las tres preguntas y el criterio por defecto: ante una pregunta ambigua usa unidades y lo dice. El parámetro `criterio` es un enum con `.describe()`, para que el modelo no invente valores.

### Módulos afectados

- `assistant`: `herramientas.ts` (entrada, descripción y caso del `switch`) e `instrucciones.ts`.
- `profitability`: método `ventasEntre`. El módulo ya es importado por `assistant`.
- `packages/shared`: `asistente.ts` (clave y nombre legible en `HERRAMIENTAS_ASISTENTE`) y la función `rankingDeVentas` con su esquema de criterio `CriterioVentasSchema`. Hay que recompilar `dist`.
- Sin tablas nuevas ni modificadas, sin RLS nueva y sin cambios de contrato OpenAPI. `fuentes` ya es una lista de strings libres en el esquema de respuesta.
- No hace falta un ADR nuevo: la decisión de agregar consultas acotadas ya está en ADR 0018.

## Risks / Trade-offs

- [Si la alícuota de un producto cambió dentro del período, la facturación neta de las ventas anteriores queda levemente distinta] → Es el mismo criterio que usa la rentabilidad y es un caso poco frecuente. Se documenta en la descripción de la consulta: "neto de IVA con la alícuota actual".
- [El modelo podría seguir eligiendo la consulta de rentables ante "lo que mejor se vendió"] → D5, más un caso en la suite con el modelo real (CP-08.7) que se corre con aviso a Franco. Si falla, se ajusta la descripción antes de cerrar la change.
- [Una herramienta más agranda cada pedido] → Unos 150 tokens dentro del bloque cacheado. Es despreciable frente a los ~7.800 tokens que lleva hoy una pregunta.

## Migration Plan

Despliegue normal: sin migración. Para volver atrás alcanza con revertir el commit: las conversaciones guardadas con la fuente `productos_mas_vendidos` se siguen mostrando, porque la web toma el nombre legible que guarda la respuesta.
