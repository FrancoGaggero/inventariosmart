# ADR 0015 · Órdenes por WhatsApp con enlace "clic para chatear" y envío a cargo del dueño

**Estado:** aceptada · 28/09/2026

## Contexto

HU-07 envía la orden de compra por correo (ADR 0011). En la práctica, el comercio chico le pide a su proveedor por WhatsApp: la primera orden real en producción quedó `CONFIRMADA` sin enviarse porque el proveedor no tenía un correo válido, y la única salida era copiar el texto y pegarlo a mano. HU-16 (RF-17) pide enviar por correo o por WhatsApp según corresponda a cada proveedor, sin romper RN-06: nada sale sin confirmación explícita del dueño.

## Decisión

1. **Enlace `https://wa.me/<número>?text=<mensaje>`**: abre WhatsApp (la app o WhatsApp Web) con el chat del proveedor y el mensaje ya escrito; el dueño toca enviar. No hay credenciales, costos ni servicio nuevo, y el mensaje sale del número del dueño, que es el que el proveedor ya conoce.
2. **El enlace sólo existe después de confirmar**: la API devuelve `whatsappUrl` únicamente para órdenes `CONFIRMADA` con `canal: WHATSAPP`. Un borrador nunca lo expone (RN-06).
3. **El sistema no afirma lo que no sabe**: como no puede enterarse de si el mensaje salió, la orden queda `CONFIRMADA` hasta que el dueño la marca como enviada (`POST /purchase-orders/:id/mark-sent`). El mismo paso sirve para las órdenes que envió por otro medio (`canal: OTRO`).
4. **Canal por proveedor, con elección en la confirmación**: `proveedor.canal_preferido` es opcional. Sin preferencia, corresponde el correo si lo tiene y, si no, WhatsApp. El dueño puede elegir otro canal al confirmar; pedir un canal para el que faltan datos se rechaza sin confirmar.
5. **Teléfonos "como vienen"**: `normalizarWhatsApp` (en `packages/shared`, con tests) lleva los números argentinos a `549` + código de área + número, quitando el `0`, el `15` y los separadores. Un teléfono sin código de área no sirve y se avisa en el formulario mientras se escribe. El teléfono se guarda tal como se cargó; el número normalizado y el enlace se calculan al responder.
6. **Mensajes acotados**: asunto en la primera línea y texto debajo; si supera los 3.000 caracteres se recorta en un salto de línea y termina con una nota. El texto completo sigue disponible para copiar.
7. **En la web, "Abrir WhatsApp" es un enlace real** (`<a target="_blank" rel="noopener noreferrer">`) y no un `window.open` posterior a la confirmación, que los navegadores bloquean como ventana emergente.

## Alternativas consideradas

- **WhatsApp Business Platform (API oficial)**: permitiría enviar sin intervención y conocer la entrega, pero exige una cuenta de empresa verificada por Meta, plantillas aprobadas para iniciar conversaciones, un número dedicado que el proveedor no conoce y tiene costo por conversación. No corresponde a un comercio chico ni al alcance del trabajo.
- **Librerías no oficiales que automatizan WhatsApp Web**: violan los términos de uso y exponen el número del dueño a un bloqueo.
- **Marcar `ENVIADA` al abrir el enlace**: abrir el chat no es enviar; el estado mentiría.
- **Guardar el número normalizado**: habría que recalcularlo cada vez que cambia la regla o el teléfono; calcularlo al responder es barato y siempre está al día.
- **Exigir el teléfono en formato internacional**: traslada al usuario un problema que el sistema puede resolver.

## Consecuencias

- `ENVIADA` por WhatsApp significa "el dueño dijo que la envió"; la orden muestra el canal y el destinatario para distinguirlo de un correo aceptado por el proveedor de correo.
- La regla del `15` y del código de área es una heurística: cubre Buenos Aires (11) y los códigos de 3 y 4 dígitos, y el formulario muestra el número resultante antes de guardar.
- No se distingue un fijo de un celular: WhatsApp avisa al abrir el enlace si el número no tiene cuenta.
- El flujo por correo no cambia: mismos estados y mismos casos CP-07.4 a CP-07.4d.
- Alertas y reportes siguen saliendo sólo por correo.
