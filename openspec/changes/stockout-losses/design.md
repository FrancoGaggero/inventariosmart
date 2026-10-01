## Context

Todo cambio de stock pasa por `movimiento`: el alta manual y la importación registran el stock inicial como `INGRESO STOCK_INICIAL`, y cada venta, ingreso, ajuste o anulación guarda `stock_resultante`. Cada movimiento se registra con un bloqueo `FOR UPDATE` sobre el producto, así que el orden de `creado_en` es el orden real en que cambió el stock. `fecha`, en cambio, es la fecha del hecho y puede ser anterior (ventas cargadas tarde). `movimiento` tiene índices por `(comercio_id, fecha)` y `(comercio_id, producto_id, fecha)`, pero ninguno por `creado_en`. Motivación: ver proposal.md.

## Goals / Non-Goals

**Goals:**
- Reconstruir los quiebres de los últimos 90 días sin recorrer el historial completo de movimientos.
- Que RN-14 sea un conjunto de funciones puras, probadas con unitarios, y que la API, el panel y una futura consulta del asistente usen el mismo servicio.

**Non-Goals:**
- Guardar los quiebres en una tabla. Se calculan en cada consulta, como la rentabilidad (D1).
- Avisar por correo cuando empieza un quiebre: para eso están las alertas de reposición.

## Decisions

### D1. Calcular al consultar, sin tabla de quiebres

Los quiebres se reconstruyen desde `movimiento` en cada consulta. Una tabla de quiebres mantenida en cada movimiento tendría que corregirse con cada anulación y cada movimiento cargado con fecha vieja. Además duplicaría un dato que `stock_resultante` ya tiene. La ventana es acotada (90 días) y la prueba de carga de CP-18.5 fija el límite.

- *Alternativa:* una vista materializada que se refresque cada día. Se descarta porque los quiebres en curso tienen que contarse hasta el momento de la consulta, y porque el refresco agrega un job más en el plan Free de Render.

### D2. Reconstrucción en tres consultas de una tabla, con el cruce en memoria

Con `inicio = ahora − 90 días`, el servicio hace tres consultas dentro de `transaccionTenant`. Siguen la convención del proyecto: consultas de una sola tabla y cruce en memoria, para no depender de las estadísticas del planificador.

1. Productos activos: `id`, `codigo`, `nombre`, `stock_actual`, precio, alícuota y costo.
2. Movimientos con `creado_en >= inicio`, ordenados por `creado_en, id`: `producto_id`, `tipo`, `cantidad`, `efecto_stock`, `stock_resultante`, `anulado_por_id` y `creado_en`. Para esto, la migración `20261004_stockout_losses` crea el índice `movimiento (comercio_id, creado_en, id)`. No hay cambios de tablas ni de RLS.
3. Los productos activos con stock 0 al inicio de la ventana y ningún movimiento dentro de ella, que tienen al menos un movimiento anterior. Se resuelve con `EXISTS` sobre el índice por producto. Distingue "estuvo sin stock los 90 días" de "nunca tuvo stock".

El stock al inicio de la ventana es `stock_actual − Σ efecto_stock` de los movimientos de la ventana, así que no hace falta buscar el último movimiento anterior a ella.

- *Alternativa:* `DISTINCT ON (producto_id)` del último movimiento antes del inicio. Se descarta porque recorre el historial completo, que es lo que el RNF-04 pide evitar.
- *Alternativa:* ordenar por `fecha`. Se descarta porque con una venta cargada tarde el orden por fecha no coincide con el de `stock_resultante` y la reconstrucción daría stocks imposibles.

### D3. RN-14 como funciones puras en `packages/shared/src/quiebres.ts`

- `tramosSinStock(stockInicial, eventos, desde, hasta)`: recibe los eventos `{ instante, stockResultante }` en orden y devuelve los intervalos con stock 0 recortados a `[desde, hasta]`, cada uno marcado si sigue en curso.
- `diasConStock(stockInicial, eventos, desde, hasta)`: el complemento dentro de la ventana de 90 días.
- `estimarPerdida({ diasSinStock, diasConStock, unidadesVendidas, precioVenta, alicuotaIva, costo })`: demanda diaria con un decimal, unidades perdidas con un decimal, venta y ganancia perdidas con dos decimales, o `motivo: 'SIN_HISTORIAL'` si hubo menos de 7 días con stock o ninguna venta. Las cifras se redondean al final para no acumular error.
- Los esquemas `StockoutsQuerySchema` (`dias` en 30, 60 o 90, `cursor`, `limit`), `ProductoConQuiebresSchema`, `TotalesQuiebresSchema` y `ListaQuiebresSchema`.

La demanda cuenta las ventas de la ventana de 90 días con `anulado_por_id IS NULL`. Una venta sólo es posible con stock mayor a cero, así que todas caen en días con stock. Los días son fracciones (milisegundos / 86.400.000), se suman sin redondear y se informan con un decimal.

### D4. Período y ventana

El período pedido son los últimos 30, 60 o 90 días hasta el momento de la consulta. La ventana de la demanda es siempre de 90 días, para que la estimación no cambie al mover el selector y tenga más historia. Con `dias=90`, período y ventana coinciden. El momento de la consulta sale de un reloj inyectable (`RELOJ_QUIEBRES`): un quiebre en curso cambia de cifra con cada segundo, así que el e2e fija la hora para comprobar los centavos exactos de CP-18.2.

### D5. Orden y cursor de posición

Se calculan todos los productos con quiebres, se ordenan por ganancia perdida descendente, con los no calculables al final ordenados por días sin stock, y después por nombre e id. Los totales se suman antes de paginar. El cursor es la posición en esa lista ordenada, codificada con `codificarCursor`, igual que en el comparador de proveedores (ADR 0017): la lista es una foto de la consulta, así que un cursor viejo puede saltear o repetir si cambió el stock, y la web vuelve a pedir la primera página al cambiar el período.

### D6. Endpoint, roles y plan

| Método | Ruta | Roles | Plan mínimo |
|---|---|---|---|
| GET | `/api/v1/stockouts?dias&cursor&limit` | DUENIO, CONTADOR | PRO |
| GET | `/api/v1/dashboard` (bloque `quiebres`) | DUENIO, CONTADOR | FREE; el bloque es `null` debajo de PRO |

Se usan `@RequierePlan('PRO')` y `@Roles('DUENIO', 'CONTADOR')`. El EMPLEADO recibe 403 porque la respuesta trae márgenes.

### D7. Panel

`DashboardService` llama a `StockoutsService.totales(30)` en el mismo `Promise.all` que el resto de los bloques, sólo si `planCumple(plan, 'PRO')`. Si no, el bloque es `null`. Se reutiliza el cálculo completo y se descarta la lista: con 5.000 productos el costo está en leer los movimientos, no en ordenar.

### D8. Web

- `lib/quiebres-formato.ts` (puro, probado sin variables de entorno, como en CI): `EXPLICACION_QUIEBRES` ("Estimamos lo que habrías vendido con lo que vendía cada producto en los días en que tuvo stock"), `fraseTotales`, `diasLegibles` ("5,0 días"), `etiquetaEstado` y `DIAS_QUIEBRES`.
- `lib/quiebres.ts`: `useQuiebres(dias)` con `useInfiniteQuery`.
- `features/quiebres/QuiebresPage.tsx`: tarjetas KPI, selector de 30/60/90 con chips, tabla dentro de `card overflow-hidden` con un `div overflow-x-auto` (sin las barras de desplazamiento fantasma), "Ver más" para la página siguiente y el aviso de plan con `Aviso` tono `plan`.
- La tarjeta en `HomePage` aparece sólo si `quiebres` no es `null` y la ganancia perdida es mayor a cero. Hay un enlace "Ver cuánto perdiste por falta de stock" en la cabecera de `AlertasPage`, y la ruta `/quiebres` va en el grupo de rutas de DUENIO y CONTADOR.

### Módulos afectados

- Nuevo `StockoutsModule` (`stockouts.service.ts`, `stockouts.controller.ts`, `stockouts.dto.ts`), que exporta el servicio. Lo importan `AppModule` y `DashboardModule`.
- `packages/shared`: `quiebres.ts`, la funcionalidad `quiebres` en `planes.ts` (PRO) y el bloque `quiebres` en `DashboardSchema`. Hay que recompilar `dist`.
- Contrato OpenAPI y cliente TS regenerados con `pnpm openapi`. La app móvil no consume este endpoint, así que el cliente Dart no cambia.
- ADR 0020: "Pérdidas por falta de stock calculadas desde el historial de movimientos".

## Risks / Trade-offs

- [La demanda de un producto estacional o en promoción no representa la del quiebre] → El promedio simple se explica en pantalla con la palabra "estimamos". La estacionalidad queda fuera de alcance.
- [Un producto que quedó en 0 a propósito, porque se discontinuó pero sigue activo, suma pérdida] → Para eso existe la baja del producto: los dados de baja no cuentan. La pantalla lo dice en la explicación.
- [La prueba de carga del panel ahora incluye la reconstrucción] → El índice por `creado_en` y las tres consultas sin uniones. CP-04.3 y CP-18.5 se corren en CI con Postgres local, que es el árbitro; en local las pruebas de carga fallan por la latencia a Neon.
- [Los movimientos importados en lote comparten `creado_en`] → Son de productos distintos y no se cruzan. Dentro de un mismo producto se desempata por `id`, y un `INGRESO STOCK_INICIAL` es siempre el primero.

## Migration Plan

1. La migración `20261004_stockout_losses` crea el índice `movimiento_comercio_id_creado_en_id_idx` sobre `(comercio_id, creado_en, id)`. En Neon, con el volumen actual, tarda menos de un segundo. No hace falta `CONCURRENTLY` porque Prisma migra dentro de una transacción.
2. Deploy normal de la API (Render corre `prisma migrate deploy`) y de la web.
3. Para volver atrás alcanza con revertir el commit. El índice se puede dejar: no afecta a nadie.
