# ADR 0011 · Órdenes de compra en modo copiloto: elección determinista, plantilla sin IA y confirmación explícita

**Estado:** aceptada · 26/09/2026

## Contexto

HU-07 (RF-07) pide que el sistema prepare las órdenes de compra a partir de las alertas de reposición de HU-06: sugerir qué pedir y a quién, redactar el texto, permitir editarlo y no enviar nada sin la confirmación del dueño (RN-06). Ya existen las alertas persistidas con cantidad sugerida y lead time (ADR 0010), el historial de costos por proveedor (ADR 0007) y un `Mailer` intercambiable con Resend. El asistente con IA (HU-08) es de Fase 3 y sólo Premium; el comparador con puntuación de proveedores (HU-12) es otra historia.

## Decisión

1. **Proveedor más conveniente por reglas explícitas**: `elegirProveedor` en `packages/shared/src/ordenes.ts` ordena los proveedores activos con precio vigente para el producto por costo ascendente, lead time ascendente y confiabilidad descendente; sin precios usa el proveedor principal; sin ninguno, el producto queda "sin proveedor". Cada ítem sugerido dice el motivo (`MENOR_COSTO`, `MENOR_LEAD_TIME`, `MAYOR_CONFIABILIDAD`, `PROVEEDOR_PRINCIPAL`). La sugerencia (`GET /purchase-orders/suggest`) es de sólo lectura: no crea borradores ni envía nada.
2. **Órdenes persistidas con ítems snapshot**: tablas `orden_compra` (número correlativo por comercio `OC-0001`, estado `BORRADOR` → `CONFIRMADA` → `ENVIADA` o `CANCELADA`, asunto, texto, `texto_editado`, total neto, motivo de no envío, quién creó y confirmó) y `orden_compra_item` (cantidad y costo unitario neto al momento, alerta de origen). `app_api` no borra órdenes (se cancelan); sí reemplaza ítems de un borrador. `alerta.orden_compra_id` deja la traza de qué orden atendió cada alerta. RLS como el resto.
3. **Redacción determinista**: `armarOrden` en `alerts/plantillas/orden.ts` genera asunto y cuerpo en español (saludo con contacto, ítems con código, cantidad y costo, total neto, plazo según lead time, firma del comercio y del dueño). Se regenera al cambiar ítems o proveedor salvo que el dueño haya editado el texto (`texto_editado`), y `regenerarTexto` vuelve al generado. HU-08 podrá reemplazar la plantilla por un modelo sin tocar el contrato.
4. **Confirmación explícita y envío después del commit**: `POST /purchase-orders/:id/confirm` pasa el borrador a `CONFIRMADA` con `updateMany … WHERE estado = 'BORRADOR'` (dos confirmaciones simultáneas no pasan las dos), atiende las alertas abiertas **por producto** (no por `alerta_id` del ítem, para cubrir alertas generadas después del borrador) y, ya confirmada la transacción, envía el correo al proveedor con el email del dueño como `replyTo`. Con envío aceptado queda `ENVIADA`; sin email o con rechazo, `CONFIRMADA` con `SIN_EMAIL` / `ENVIO_FALLIDO` y el texto copiable. Enviar dentro de la transacción haría que un timeout del proveedor de correo revirtiera una confirmación cuyo correo tal vez salió.
5. **Plan PRO y roles**: mismas reglas que las alertas; el DUENIO opera, el CONTADOR consulta, el EMPLEADO no accede.

## Alternativas consideradas

- **Borradores automáticos** creados por el recálculo: llenan el listado de órdenes que nadie pidió y confunden el "nada sin confirmar".
- **Puntuación ponderada de proveedores** (precio, plazo, confiabilidad con pesos): es HU-12 y requiere calibrar pesos con el usuario; el orden lexicográfico es explicable en una línea.
- **Redacción con IA desde ahora**: costo por llamada, dependencia externa en e2e y plan Premium; la plantilla cumple el criterio y deja el contrato listo.
- **Ítems con PATCH individual**: más rutas para una pantalla que se edita entera; el reemplazo completo de la lista es más simple y atómico.
- **Guardar la orden como JSON en la alerta**: no permite varias alertas por orden ni historial consultable.

## Consecuencias

- Con `onboarding@resend.dev` sin dominio verificado Resend sólo entrega a la casilla del dueño de la cuenta: en producción las órdenes a proveedores reales quedan `CONFIRMADA` con `ENVIO_FALLIDO` hasta verificar dominio; la demo usa un proveedor con el email de Franco.
- El costo del ítem es una estimación al momento de armar la orden; si el proveedor informa otro precio, la lista de precios de HU-02 lo actualiza y la próxima orden lo toma.
- La recepción de la mercadería sigue siendo un INGRESO de HU-10; vincular ingresos con órdenes queda como evolución.
