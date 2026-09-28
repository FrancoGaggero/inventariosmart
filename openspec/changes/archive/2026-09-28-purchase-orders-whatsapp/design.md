## Context

Ver proposal.md – Why. Lo que existe y esta change modifica:

- `PurchaseOrdersService.confirmar(id)` ([purchase-orders.service.ts](../../../apps/api/src/purchase-orders/purchase-orders.service.ts)): en una transacción pasa la orden a `CONFIRMADA` con `updateMany` condicionado al estado, atiende las alertas, y después del commit envía el correo y escribe `ENVIADA` o `motivoNoEnvio`. Hoy no recibe cuerpo.
- `OrdenCompraSchema` y `MOTIVOS_NO_ENVIO` (`SIN_EMAIL`, `ENVIO_FALLIDO`) en `packages/shared/src/ordenes.ts`; `ProveedorOrdenSchema` expone `email` pero no `telefono`.
- `proveedor.telefono VARCHAR(40)` libre, validado sólo por largo (`textoOpcional(40)`), visible en el formulario, el detalle y el listado.
- `OrdenPage` tiene "Confirmar y enviar", "Copiar texto" y el aviso por `motivoNoEnvio`.
- En producción, `OC-0001` quedó `CONFIRMADA` con `ENVIO_FALLIDO`: el proveedor no tenía un correo real.

Restricciones: RN-06 (nada sale sin confirmación explícita); sin credenciales ni costos nuevos; los e2e no dependen de la red; `orden_compra` no se borra y `app_api` conserva `SELECT, INSERT, UPDATE`.

## Goals / Non-Goals

**Goals:**
- Que una orden a un proveedor sin correo salga en dos toques, con el mensaje ya redactado.
- Que el teléfono cargado "como viene" sirva, y que se avise cuando no sirve.
- No cambiar nada del flujo por correo.

**Non-Goals:**
- API de WhatsApp Business, envío sin intervención del dueño, confirmación de entrega o lectura, alertas y reportes por WhatsApp, PDF adjunto, mobile.

## Decisions

### D1 · WhatsApp por enlace "clic para chatear"
`https://wa.me/<número>?text=<mensaje codificado>`: abre WhatsApp (app o Web) con el chat del proveedor y el mensaje escrito; el dueño toca enviar. Gratis, sin credenciales, y el mensaje sale del número del dueño. Alternativa descartada: WhatsApp Business Platform (cuenta verificada por Meta, plantillas aprobadas para iniciar conversaciones, costo por conversación y un número dedicado que el proveedor no conoce). Queda en **ADR 0015**.

### D2 · Reglas en `packages/shared/src/whatsapp.ts`
Funciones puras con tests:
- `normalizarWhatsApp(telefono: string | null): string | null`. Deja dígitos y un `+` inicial. Con `+` o `00`: si el código es `54`, asegura el `9` de celular después del `54` y exige 13 dígitos; otro país, se acepta entre 8 y 15 dígitos. Sin código de país: quita el `0` inicial; si quedan 12 dígitos, quita el `15` que sigue al código de área (área `11` de 2 dígitos; si no, de 3 o de 4, en ese orden); con 10 dígitos antepone `549`; cualquier otro largo devuelve `null`.
- `canalDeProveedor({ email, telefono, canalPreferido }): CanalProveedor | null` (CP-16.1b).
- `mensajeWhatsApp(asunto, texto)`: asunto, línea en blanco y texto; recorte a `MENSAJE_WHATSAPP_MAX = 3000` en el último salto de línea que entre, más la nota "(…) Te paso el detalle completo aparte." (CP-16.4b).
- `enlaceWhatsApp(numero, mensaje)`: `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`.
- `CANALES_PROVEEDOR = ['EMAIL', 'WHATSAPP']`, `CANALES_ENVIO = ['EMAIL', 'WHATSAPP', 'OTRO']` con sus esquemas y etiquetas.

Cambios de contrato: `ProveedorSchema` y `ProveedorOrdenSchema` suman `telefono` (en el de orden), `whatsapp`, `canalPreferido` y `canal`; `ProveedorCreateSchema` / `PatchSchema` suman `canalPreferido` opcional y nulo; `OrdenCompraSchema` y `OrdenResumenSchema` suman `canal`; `OrdenCompraSchema` suma `whatsappUrl`; `ConfirmarOrdenSchema = { canal?: 'EMAIL' | 'WHATSAPP' }`. Todos los campos nuevos son aditivos.

### D3 · Modelo de datos
Migración `20260930_purchase_orders_whatsapp`: enum `canal_envio` (`EMAIL`, `WHATSAPP`, `OTRO`); `proveedor.canal_preferido canal_envio NULL` con `CHECK (canal_preferido <> 'OTRO')`; `orden_compra.canal canal_envio NULL`. Relleno: `UPDATE orden_compra SET canal = 'EMAIL' WHERE estado = 'ENVIADA'`. `orden_compra.enviada_a` (`VARCHAR(254)`) guarda el correo o el teléfono tal como está cargado. El número normalizado y el enlace no se guardan: se calculan al responder, así un teléfono corregido después sirve sin tocar la orden. Sin cambios de RLS ni de privilegios.

### D4 · Confirmación con canal
`confirmar(id, { canal? })`. Dentro de la transacción, antes del `updateMany`: canal = el pedido o `canalDeProveedor(proveedor)`; si se pidió uno y faltan datos (`EMAIL` sin email, `WHATSAPP` sin número normalizable), `validacion(..., { canal })` y la transacción no escribe nada (CP-16.2c). Después:

| Canal | Estado tras confirmar | `canal` | `motivoNoEnvio` | Correo |
| --- | --- | --- | --- | --- |
| `EMAIL` | `ENVIADA`, o `CONFIRMADA` si el envío falla | `EMAIL` | `null` o `ENVIO_FALLIDO` | sí, después del commit |
| `WHATSAPP` | `CONFIRMADA` | `WHATSAPP` | `null` | no |
| ninguno | `CONFIRMADA` | `null` | `SIN_EMAIL` | no |

`whatsappUrl` lo arma `aOrden()` sólo cuando `estado === 'CONFIRMADA' && canal === 'WHATSAPP'` y el teléfono actual del proveedor se puede normalizar; en cualquier otro estado es `null` (RN-06: un borrador nunca lo expone).

### D5 · Marcar como enviada
`POST /purchase-orders/:id/mark-sent` (DUENIO, PRO, 200): `updateMany` con `where: { id, comercioId, estado: 'CONFIRMADA' }` y `data: { estado: 'ENVIADA', enviadaEn, motivoNoEnvio: null, canal: orden.canal === 'WHATSAPP' ? 'WHATSAPP' : 'OTRO', enviadaA: canal WhatsApp ? proveedor.telefono : null }`; `count === 0` → 409 `CONFLICTO`. Una orden `CONFIRMADA` con `ENVIO_FALLIDO` que el dueño termina enviando por otro medio queda `OTRO`.

### D6 · Proveedores
`SuppliersService.crear/actualizar` validan el canal preferido contra los datos resultantes (email y teléfono después de aplicar el cambio) y devuelven 400 con `details.canalPreferido` (CP-16.1c). Si un cambio posterior deja sin datos al canal preferido (se borra el teléfono), también se rechaza con el mismo error, pidiendo cambiar el canal. `aProveedor()` calcula `whatsapp` y `canal`. El EMPLEADO y el CONTADOR siguen sin acceso a proveedores (CP-02.7).

### D7 · Endpoints

| Método y ruta | Cambio | Roles |
| --- | --- | --- |
| `POST /purchase-orders/:id/confirm` | acepta cuerpo opcional `{ canal }`; responde con `canal` y `whatsappUrl` | DUENIO |
| `POST /purchase-orders/:id/mark-sent` | nuevo | DUENIO |
| `GET /purchase-orders`, `GET /purchase-orders/:id` | suman `canal`; el detalle suma `whatsappUrl` y los campos nuevos del proveedor | DUENIO, CONTADOR |
| `GET/POST/PATCH /suppliers…` | suman `canalPreferido`, `whatsapp`, `canal` | DUENIO |

Las rutas de órdenes siguen bajo `@RequierePlan('PRO')`; las de proveedores no cambian de plan ni de roles. `pnpm openapi` regenera contrato y cliente.

### D8 · Web
- `ProveedorFormPage`: selector "Canal preferido" (Automático, Correo, WhatsApp) y, bajo el teléfono, "WhatsApp: +54 9 11 2345-6789" o "Para WhatsApp falta el código de área" usando `normalizarWhatsApp` de shared mientras se escribe. `ProveedorDetallePage` y `ProveedoresPage`: chip del canal.
- `OrdenPage` en `BORRADOR`: botón "Confirmar y enviar por correo" o "Confirmar y enviar por WhatsApp" según el canal; si el proveedor tiene los dos, dos chips para elegir; sin canal, "Confirmar" con el aviso de que habrá que enviarla a mano. El botón es la confirmación explícita de RN-06, sin diálogo intermedio: HU-07 pide confirmar con un clic.
- `OrdenPage` en `CONFIRMADA`: con WhatsApp, "Abrir WhatsApp" es un enlace real (`<a href target="_blank" rel="noopener noreferrer">`) y no un `window.open` tras una llamada asíncrona, que los navegadores bloquean como ventana emergente; "Ya la envié" llama a `mark-sent`. Sin canal o con envío fallido: "Copiar texto" y "Ya la envié".
- `OrdenesPage`: icono del canal en las enviadas. `lib/ordenes.ts`: `useConfirmarOrden` acepta `canal`, `useMarcarEnviada`.

### D9 · Tests
Shared `whatsapp.test.ts`: los cinco teléfonos de CP-16.1, números con `00`, de otro país, con letras, vacíos; canal efectivo; mensaje corto, editado y largo (límite exacto, sin cortar líneas); enlace codificado con acentos y saltos de línea. e2e en `purchase-orders.e2e-spec.ts` (CP-16.2 a CP-16.4b, y CP-07.4 a CP-07.4d siguen pasando con `canal`) y `suppliers.e2e-spec.ts` (CP-16.1 a CP-16.1c). `LogMailer.enviados` verifica que por WhatsApp no sale ningún correo.

### D10 · Documentación
ADR 0015; README (rutas y campos nuevos); `docs/arquitectura.html` (módulos `purchase-orders` y `suppliers`, fila de RN-06, tabla de funcionalidades); `openspec/config.yaml` (HU-16, RF-17); `openspec/CAPACIDADES.md`.

## Risks / Trade-offs

- [El dueño marca "Ya la envié" sin haber enviado] → el sistema no puede verificarlo; la orden muestra "marcada como enviada por" con nombre y fecha, no "entregada".
- [Heurística del `15` y del código de área] → cubre CABA y los códigos de 3 y 4 dígitos; el formulario muestra el número resultante antes de guardar, así el dueño ve si quedó mal.
- [Teléfono fijo cargado como WhatsApp] → no se puede distinguir un fijo de un celular por el número; WhatsApp avisa al abrir el enlace que el número no tiene cuenta.
- [Mensajes largos] → recorte a 3.000 caracteres con nota; el texto completo sigue disponible con "Copiar texto".
- [Cambio en la respuesta de `confirm`] → sólo suma campos; el correo se comporta igual y sus casos siguen en la suite.

## Migration Plan

1. Migración aditiva con `prisma migrate deploy` en Neon dev y en producción por Render. 2. Deploy de API y web. 3. En producción, cargar el teléfono del proveedor de la demo y confirmar una orden por WhatsApp. Rollback: revertir el commit; las columnas nuevas pueden quedar.

## Open Questions

Ninguna que bloquee.
