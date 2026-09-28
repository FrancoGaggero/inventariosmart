## Why

HU-07 envía la orden de compra por correo, pero en la práctica el comercio chico le pide a su proveedor por WhatsApp: en producción, la primera orden real quedó `CONFIRMADA` sin enviarse porque el proveedor no tenía un correo válido. Hoy la salida en ese caso es "Copiar texto" y pegarlo a mano. Franco pidió que el sistema envíe por correo o por WhatsApp según corresponda a cada proveedor, como parte del diferencial del producto para el contexto argentino (RNF-08).

Cubre una historia nueva, **HU-16 "Enviar la orden por WhatsApp"** (RF-17 nuevo; RN-06), en la **Fase 2**, plan **PRO**, sobre las capacidades `purchase-orders` y `suppliers-price-lists` ya construidas.

## What Changes

- **Canal por proveedor**: cada proveedor tiene un canal preferido opcional (correo o WhatsApp). Sin preferencia, el sistema usa el correo si lo tiene y, si no, WhatsApp si el teléfono sirve. La API informa el número de WhatsApp normalizado y el canal que corresponde.
- **Normalización de teléfonos argentinos**: el teléfono cargado con cualquier formato ("011 15-2345-6789", "+54 9 351 234-5678") se lleva al formato que necesita WhatsApp (`5491123456789`). Un teléfono sin código de área no sirve para WhatsApp y se avisa.
- **Confirmar por WhatsApp**: al confirmar una orden cuyo canal es WhatsApp, la orden queda `CONFIRMADA` con `canal: "WHATSAPP"` y la respuesta trae un enlace `wa.me` con el mensaje ya redactado. El dueño lo abre, WhatsApp muestra el mensaje listo y él lo envía desde su propio teléfono o WhatsApp Web. El dueño puede elegir el canal al confirmar.
- **Marcar como enviada**: como el sistema no puede saber si el mensaje salió, el dueño marca la orden como enviada (`POST /purchase-orders/:id/mark-sent`) y pasa a `ENVIADA` con el canal y el destinatario. También sirve para las órdenes que envió por otro medio.
- **RN-06 se mantiene**: nada sale sin confirmación explícita; el enlace de WhatsApp sólo existe después de confirmar y el envío lo hace el dueño.
- **Web**: canal preferido y vista del número normalizado en el formulario del proveedor; en la orden, el botón de confirmar dice por dónde sale, y tras confirmar aparecen "Abrir WhatsApp" y "Ya la envié".
- **Contrato**: shared, OpenAPI y cliente regenerados; migración `20260930_purchase_orders_whatsapp`.

Supuestos registrados:
- **Enlace "clic para chatear" y no la API de WhatsApp Business**: la API oficial exige una cuenta de empresa verificada por Meta, plantillas aprobadas y tiene costo por conversación; el enlace es gratuito, no necesita credenciales y el mensaje sale del número del dueño, que es el que el proveedor ya conoce.
- **El sistema no confirma la entrega**: `ENVIADA` por WhatsApp significa que el dueño dijo haberla enviado.
- **Números argentinos de celular**: los números con código de otro país se aceptan tal como están, con `+`.
- **El correo sigue igual**: mismo flujo, mismos estados y mismos casos CP-07.4 a CP-07.4d.
- **Backlog**: HU-16 y RF-17 son altas nuevas que Franco debe sumar al backlog y a la Propuesta.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `purchase-orders`: la confirmación elige el canal (correo o WhatsApp), devuelve el enlace de WhatsApp con el mensaje redactado, y se agrega marcar la orden como enviada.
- `suppliers-price-lists`: el proveedor suma canal preferido, número de WhatsApp normalizado y canal que corresponde.

## Impact

- **Código:** `packages/shared` `whatsapp.ts` (normalización, enlace, canal efectivo) y cambios en `ordenes.ts` y `proveedores.ts`; `apps/api` `suppliers` (campo y validación), `purchase-orders` (confirmar con canal, `mark-sent`, DTOs); `packages/api-client` regenerado; `apps/web` `ProveedorFormPage`, `ProveedorDetallePage`, `OrdenPage`, `lib/ordenes.ts`.
- **Base de datos:** migración con el enum `canal_envio` (`EMAIL`, `WHATSAPP`, `OTRO`), `proveedor.canal_preferido` y `orden_compra.canal`; sin tablas nuevas ni cambios de RLS.
- **Servicios externos:** ninguno nuevo; el enlace `https://wa.me/` lo abre el navegador del dueño.
- **Documentación:** ADR 0015 (WhatsApp por enlace y envío a cargo del dueño), README, `docs/arquitectura.html` (módulos `purchase-orders` y `suppliers`, RN-06), `openspec/config.yaml` (HU-16, RF-17), `openspec/CAPACIDADES.md`.
- **Trazabilidad:** CU-16, casos CP-16.1 a CP-16.5; los casos CP-07.4 a CP-07.4d siguen vigentes.
- **Fuera de alcance:** API de WhatsApp Business, envío automático sin intervención del dueño, confirmación de lectura, alertas y reportes por WhatsApp, adjuntar PDF, app Android.
