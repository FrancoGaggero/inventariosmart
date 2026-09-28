# ADR 0016 · Remarcación con vista previa, aplicación atómica y deshacer

**Estado:** aceptada · 28/09/2026

## Contexto

HU-15 (ADR 0014) le muestra al dueño qué productos quedaron atrasados frente a la inflación y cuánto deberían costar, pero corregirlos exigía editar cada producto. Actualizar precios a mano fue el cuello de botella que señaló el comerciante entrevistado. HU-17 (RF-18) pide pasar del diagnóstico a la acción en lote, sin perder control: cambiar cientos de precios de una vez es la operación con más consecuencias del sistema, porque el precio vigente se copia a cada venta.

## Decisión

1. **Vista previa separada de la aplicación**: `POST /repricing/preview` calcula y no escribe; `POST /repricing/apply` recibe los precios que el dueño vio, que pudo ajustar uno por uno. Lo que se aplica es exactamente lo que se revisó, no un recálculo.
2. **Cuatro criterios con reglas en `packages/shared`**: alcanzar la inflación y sostener el margen (reutilizan los precios sugeridos de `InsightsService`), porcentaje fijo y margen bruto objetivo (precio neto = costo ÷ (1 − margen), llevado a precio con IVA; RN-01 y RN-03). El redondeo es siempre hacia arriba y se hace sobre centavos, para que un 2989,9999… no suba a 3000.
3. **RN-12**: una remarcación no baja precios salvo pedido explícito, se aplica completa o no se aplica y puede deshacerse mientras los precios remarcados no hayan vuelto a cambiar.
4. **Control de cambios por precio esperado**: al aplicar, el precio actual enviado tiene que coincidir con el de la base. Si alguno cambió desde la vista previa, responde 409 con los productos afectados y no escribe nada. Los productos se bloquean con `FOR UPDATE` en una sola consulta, así dos remarcaciones simultáneas no se pisan.
5. **Lote persistido**: `remarcacion` y `remarcacion_item` guardan el criterio, sus parámetros, quién la hizo y el precio anterior y nuevo de cada producto. No se borran (`app_api` sin `DELETE`). Cada cambio deja además su fila en el historial de precios con el origen nuevo `REMARCACION`.
6. **Deshacer una vez y sin pisar correcciones**: vuelven al precio anterior sólo los productos que siguen con el precio remarcado; los que el dueño cambió después, o que están dados de baja, se informan como omitidos.
7. **Escrituras por arreglos**: los precios se actualizan con un `UPDATE … FROM unnest(…)` y el historial y los ítems se insertan con `INSERT … SELECT FROM unnest(…)`. Con 5.000 productos viaja una fracción de lo que viajaría fila por fila, y el límite del cuerpo JSON de la API sube a 2 MB.
8. **Confirmación en la web**: aplicar y deshacer piden confirmación con la cantidad de productos. Es distinto de las órdenes de compra (HU-07), que se confirman con un clic: allí el botón es la confirmación de una sola orden; acá un clic equivocado cambia cientos de precios.

## Alternativas consideradas

- **Aplicar recalculando en el servidor**: más simple, pero el dueño podría aplicar precios distintos de los que vio si cambió un costo o se publicó un IPC nuevo, y no podría ajustar precios a mano.
- **Remarcación automática o programada**: el precio es una decisión comercial; el sistema propone y el dueño decide, igual que en las órdenes (RN-06).
- **Deshacer restaurando todo el lote**: pisaría correcciones hechas después de la remarcación.
- **Bloqueo optimista por versión del producto**: exige una columna de versión en `producto`; comparar el precio esperado alcanza para lo único que importa acá.
- **Aplicación parcial** (remarcar lo que se pueda): deja el catálogo en un estado que nadie revisó.

## Consecuencias

- Remarcar no toca costos ni ventas pasadas: el precio de cada venta quedó copiado en su movimiento.
- El historial de precios distingue una remarcación de una edición; la comparación de HU-15 la toma como cualquier otro cambio de precio.
- `REMARCACION` es un valor nuevo de un enum de PostgreSQL: no se puede quitar, sólo dejar de usar.
- Los casos e2e que dependen del IPC viven en la suite de inflación: las tablas de indicadores son globales y otra suite en paralelo las pisaría.
- `proveedores` dejó de importar el índice de `packages/shared` (`CuitSchema` pasó a `cuit.ts`): el ciclo de imports hacía fallar a cualquier módulo nuevo que usara esquemas de otros al cargarse.
