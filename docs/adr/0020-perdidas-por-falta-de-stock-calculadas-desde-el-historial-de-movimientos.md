# ADR 0020 · Pérdidas por falta de stock calculadas desde el historial de movimientos

**Estado:** aceptada · 01/10/2026

## Contexto

Las alertas de reposición (HU-06) avisan antes de que un producto se agote, pero el sistema no decía cuánto le costó al comercio quedarse sin stock. HU-18 (RF-19), del plan PRO, pide estimarlo en pesos. Todo cambio de stock ya pasa por `movimiento`, y cada fila guarda `stock_resultante`, el stock que quedó después de la operación. Cada movimiento se registra con un bloqueo sobre el producto, así que el orden de `creado_en` es el orden real en que cambió el stock. `fecha`, en cambio, puede ser anterior, porque una venta se puede cargar tarde.

## Decisión

1. **RN-14**:
   - Un quiebre es el tiempo en que un producto activo estuvo con stock 0, desde el movimiento que lo dejó en cero hasta el siguiente que lo repuso, o hasta la consulta si sigue en cero.
   - La demanda diaria es lo vendido sin anular en los días con stock de los últimos 90, dividido por esos días.
   - Las unidades perdidas son los días sin stock por la demanda. La venta perdida son esas unidades por el precio neto vigente (RN-03), y la ganancia perdida, esas unidades por el margen bruto vigente (RN-01).
   - Con menos de 7 días con stock, o sin ventas, la pérdida es no calculable (`SIN_HISTORIAL`).
2. **Nada se guarda**: los quiebres se reconstruyen en cada consulta. Una tabla de quiebres tendría que corregirse con cada anulación y cada movimiento cargado tarde, y duplicaría un dato que `stock_resultante` ya tiene.
3. **La ventana es de 90 días y se lee en el orden en que cambió el stock**. Una migración agrega el índice `movimiento (comercio_id, creado_en, id)`. El stock al inicio de la ventana se obtiene como el stock actual menos lo que movieron los movimientos de la ventana, así que no hace falta recorrer el historial anterior. Un producto que arranca la ventana en cero cuenta como quiebre sólo si tuvo algún movimiento antes; si no, nunca tuvo stock.
4. **Viaja poco desde la base**: una sola consulta con funciones de ventana suma por producto lo que se movió y lo que se vendió, y devuelve sólo los movimientos que pasan el stock de cero a positivo o al revés, además del primero de cada producto. Los demás no cortan ningún tramo. Con 50.000 movimientos, eso reduce las filas que viajan a unas pocas miles.
5. **RN-14 vive en `packages/shared`** (`quiebres.ts`) como funciones puras (`tramosSinStock`, `diasConStock`, `estimarPerdida`, `ordenarQuiebres`, `totalizarQuiebres`), probadas con unitarios. La API las aplica y la web usa los mismos esquemas.
6. **Orden por ganancia perdida y cursor de posición**, igual que el comparador (ADR 0017). Los totales se suman antes de paginar.
7. **Reloj inyectable** (`RELOJ_QUIEBRES`): un quiebre en curso cambia de cifra con cada segundo, así que el e2e fija la hora para comprobar los centavos exactos.
8. **El panel reutiliza el mismo servicio** con los últimos 30 días, sin importar el mes elegido, y devuelve `null` debajo del plan PRO.

## Alternativas consideradas

- **Tabla de quiebres mantenida en cada movimiento**: lectura barata, pero con anulaciones y movimientos cargados con fecha vieja hay que reescribir tramos ya cerrados.
- **Vista materializada diaria**: los quiebres en curso tienen que contarse hasta el momento de la consulta, y el refresco suma un job en el plan Free de Render.
- **Ordenar por `fecha`**: con una venta cargada tarde, el orden no coincide con el de `stock_resultante` y la reconstrucción daría stocks imposibles.
- **Demanda como en RN-04** (ventas de 30 días ÷ 30): incluye los días sin stock y subestima justo a los productos que más se agotan.
- **Excluir los productos sin historial**: ocultaría que estuvieron sin stock. Se muestran con sus días y sin cifra.

## Consecuencias

- Es una estimación con promedio simple: no tiene en cuenta la estacionalidad ni las promociones. La pantalla lo dice con la palabra "estimamos".
- Un producto discontinuado que sigue activo suma pérdida mientras está en cero. Para eso está la baja, y la pantalla lo explica.
- El panel de los comercios PRO hace una consulta más. La prueba de carga de 5.000 productos y 50.000 movimientos cubre la consulta y el panel.
