# ADR 0006 · Movimientos inmutables y stock actualizado en la misma transacción

**Estado:** aceptada · 22/09/2026

## Contexto

HU-10 (RF-13) introduce los movimientos de stock: ventas, ingresos y ajustes. Son la fuente de la velocidad de venta (RN-04), de los indicadores del dashboard (HU-04) y de las unidades vendidas del margen neto (RN-02). RN-07 exige que no se eliminen ni modifiquen: una corrección es un AJUSTE que referencia al original. HU-10 pide además que el stock nunca quede negativo y que el dashboard responda en menos de 3 s (RNF-04).

## Decisión

1. **Stock almacenado, no calculado.** `producto.stock_actual` se actualiza en la misma transacción que inserta el movimiento. La transacción bloquea la fila del producto (`SELECT … FOR UPDATE`), calcula el stock resultante y lo rechaza con 409 si quedaría negativo; el movimiento guarda `efecto_stock` y `stock_resultante`, así el historial se puede auditar fila por fila. Dos `CHECK` (`stock_actual >= 0`, `stock_resultante >= 0`) quedan como red de seguridad en la base.
2. **Inmutabilidad garantizada por PostgreSQL.** El rol de la API (`app_api`) tiene sobre `movimiento` sólo `SELECT`, `INSERT` y `UPDATE` de la columna `anulado_por_id`. Ningún error de programación puede borrar ni reescribir el historial.
3. **Anulación como ajuste inverso.** `POST /movements/:id/anular` registra un `AJUSTE` con motivo `ANULACION`, cantidad opuesta al efecto del original y `corrige_a_id` apuntando al original, que a su vez recibe `anulado_por_id`. Un movimiento se anula a lo sumo una vez (índice único) y una anulación no se anula.
4. **Un solo camino para cambiar el stock.** `MovementsService.registrarEnTransaccion()` es la única función que escribe `stock_actual`; el alta de producto la usa para registrar el stock inicial como `INGRESO` (`STOCK_INICIAL`), y las historias futuras (importación, órdenes de compra) también deberán usarla.
5. **Idempotencia por clave del cliente.** `POST /movements` acepta `Idempotency-Key`; la clave se guarda con el movimiento y un reintento devuelve 200 con el original. Evita duplicar una venta cuando la red falla desde el celular.

## Alternativas consideradas

- **Stock calculado como suma del histórico:** siempre consistente, pero cada listado y el dashboard tendrían que agregar toda la tabla; incumple RNF-04 a medida que crece el historial.
- **Edición y borrado con tabla de auditoría:** más flexible para corregir errores, pero contradice RN-07 y complica la trazabilidad ante la cátedra.
- **`UPDATE producto SET stock_actual = stock_actual + delta WHERE stock_actual + delta >= 0` sin bloqueo:** evita el `FOR UPDATE`, pero no permite devolver el stock resultante consistente ni el mensaje con el stock actual, y el `stock_resultante` de cada fila dejaría de ser confiable.
- **Trigger que rechace `UPDATE`/`DELETE`:** equivalente a los privilegios, pero más difícil de auditar; el proyecto ya administra permisos por rol de base (ADR 0002).

## Consecuencias

- Las migraciones (que corren como propietaria) siguen pudiendo corregir datos; la API no.
- El costo no viaja en el movimiento: el margen se calcula con el costo vigente del producto (RN-08). La `VENTA` sí congela el precio unitario, que HU-04 necesita y no se puede reconstruir.
- La transacción de tenant admite hasta 20 s de espera por el bloqueo del producto; en la práctica dura tres consultas.
- Runbook `docs/runbooks/rls.md`: las tablas de sólo inserción recortan los privilegios por defecto en su migración.
