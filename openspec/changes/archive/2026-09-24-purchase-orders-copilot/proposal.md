## Why

Las alertas de HU-06 dicen *qué* reponer y *cuánto*, pero el dueño todavía tiene que armar el pedido a mano: elegir a quién comprarle, calcular cantidades y redactar el correo. La Propuesta compromete el **modo copiloto** (HU-07, RF-07, RN-06): el sistema sugiere la orden con los productos críticos y el proveedor más conveniente, redacta el texto, y nada sale sin que el dueño lo confirme con un clic. Es la continuación natural de HU-06, reutiliza las cifras que ya calcula (cantidad sugerida, lead time) y las listas de precios de HU-02, y cierra el ciclo alerta → pedido en la demo.

Cubre **HU-07** (RF-07, RN-06) en la **Fase 2 – Alertas**; plan mínimo **PRO** (misma regla que las alertas). Es la duodécima capacidad de `openspec/CAPACIDADES.md`.

## What Changes

- **Sugerencia de orden** (HU-07 criterio 1): a partir de las alertas abiertas `ACTIVA` (por defecto sólo `CRITICA`; opcionalmente también `PROXIMA`), el sistema agrupa los productos por **proveedor más conveniente**: el de menor costo vigente entre los proveedores con precio cargado para ese producto; a igual costo, menor lead time y luego mayor confiabilidad; sin precios, el proveedor principal; sin ninguno, el producto queda listado como "sin proveedor" y no entra en ninguna orden. Cada grupo trae ítems con la cantidad sugerida de la alerta (mínimo 1), el costo neto vigente de ese proveedor (o el costo de reposición del producto, o "a confirmar") y el total estimado.
- **Órdenes de compra persistidas**: tablas `orden_compra` y `orden_compra_item`, numeradas por comercio (`OC-0001`), con estados `BORRADOR` → `CONFIRMADA` → `ENVIADA`, o `CANCELADA`. Cada ítem guarda cantidad y costo unitario neto al momento (snapshot) y la alerta de origen si la hubo.
- **Redacción automática** (criterio 2): plantilla determinista, sin IA, que arma asunto y cuerpo del correo al proveedor (saludo, lista de productos con código, cantidad y costo, total neto estimado, plazo esperado según lead time, firma del comercio con sus datos de contacto). Se regenera al editar ítems o proveedor salvo que el dueño haya editado el texto a mano.
- **Edición antes de confirmar** (criterio 4): el DUENIO cambia proveedor, agrega o quita ítems, ajusta cantidades, notas y texto mientras la orden está en `BORRADOR`.
- **Confirmación con un clic** (criterio 3, RN-06): `POST /purchase-orders/:id/confirm` pasa la orden a `CONFIRMADA`, marca `ATENDIDA` las alertas abiertas de sus productos y, si el proveedor tiene email, envía el correo con `Mailer` (Resend) y la deja `ENVIADA`; sin email o con envío rechazado, queda `CONFIRMADA` con el motivo y el texto listo para copiar y mandar por WhatsApp u otro medio. Nunca se envía nada desde la sugerencia ni desde el borrador.
- **Endpoints** `GET /purchase-orders/suggest`, `GET /purchase-orders`, `GET /purchase-orders/:id`, `POST /purchase-orders`, `PATCH /purchase-orders/:id`, `POST /purchase-orders/:id/confirm`, `POST /purchase-orders/:id/cancel`; plan PRO; DUENIO opera, CONTADOR consulta, EMPLEADO 403.
- **Web**: página `/ordenes` (listado por estado), `/ordenes/nueva` (sugerencia agrupada por proveedor con "Crear borrador" por grupo), `/ordenes/:id` (edición, vista previa del texto, botón "Confirmar y enviar", "Copiar texto", "Cancelar"); botón "Generar orden" en la página Alertas y enlace "Órdenes" en la navegación. Sin cambios en el panel.
- **Alertas**: una alerta atendida por una orden referencia la orden (`ordenCompraId`) y la página Alertas lo muestra.
- **Contrato**: shared, OpenAPI y cliente regenerados; migración `20260926_purchase_orders` con RLS y privilegios (sin DELETE: las órdenes se cancelan).

Supuestos registrados:
- **"Estado crítico"** = alertas `ACTIVA` con severidad `CRITICA`; las `PROXIMA` se pueden incluir con un filtro. Las `POSPUESTA` y `ATENDIDA` no se sugieren.
- **"Proveedor más conveniente"** se decide sólo por costo vigente, lead time y confiabilidad, en ese orden; la puntuación ponderada es HU-12 (comparador) y no se adelanta.
- **"El asistente redacta"** es una plantilla determinista en español; la redacción con IA es HU-08 (Premium, Fase 3) y podrá reemplazar la plantilla sin cambiar el contrato.
- **Envío**: correo al proveedor con Resend, con el email del dueño como responder-a. Con el remitente `onboarding@resend.dev` sin dominio verificado Resend sólo entrega a la casilla del dueño de la cuenta, así que en producción el envío a proveedores reales fallará hasta verificar dominio: la orden queda `CONFIRMADA` con motivo `ENVIO_FALLIDO` y el texto copiable; la funcionalidad se demuestra igual y los e2e usan `LogMailer`.
- **Recepción de mercadería** no forma parte de la orden: el ingreso se registra como movimiento INGRESO (HU-10) igual que hoy; vincular ingresos con órdenes es evolución.
- **Mobile** no cambia.

## Capabilities

### New Capabilities

- `purchase-orders`: sugerencia de órdenes por proveedor más conveniente a partir de las alertas, borradores editables, redacción automática del texto, confirmación explícita del DUENIO con envío por correo o texto copiable, listado e historial, plan PRO y permisos.

### Modified Capabilities

- `restock-alerts`: la gestión de alertas suma "atendida por orden de compra": al confirmar una orden, las alertas abiertas de sus productos pasan a `ATENDIDA` con referencia a la orden, y la alerta expone `ordenCompraId`.

## Impact

- **Código:** `apps/api` módulo nuevo `purchase-orders` (service, sugerencia, plantilla, controller, DTOs) que consume `AlertsService` (alertas abiertas, atender por orden), `PricesService`/consulta de costos vigentes y `Mailer` (con campo nuevo responder-a); `packages/shared` `ordenes.ts` (esquemas, estados, etiquetas, función pura de elección de proveedor y de totales); `packages/api-client` regenerado; `apps/web` páginas de órdenes, hooks `lib/ordenes.ts`, botón en Alertas y enlace en `AppShell`.
- **Base de datos:** migración con `orden_compra` (comercio_id, proveedor_id, numero único por comercio, estado, asunto, texto, texto_editado, notas, total_neto, motivo_no_envio, creada_por, confirmada_por, fechas), `orden_compra_item` (comercio_id, orden_id, producto_id, alerta_id null, cantidad, costo_unitario_neto null), enum `EstadoOrdenCompra`, columna `alerta.orden_compra_id`, RLS en ambas tablas y `app_api` sin DELETE; `TENANT_MODELS` suma los dos modelos.
- **Documentación:** ADR 0011 (órdenes en modo copiloto: elección determinista de proveedor, plantilla sin IA, confirmación explícita y envío tolerante a fallos), README, `docs/arquitectura.html` (§6 `purchase-orders`, RN-06 construida), `docs/runbooks/rls.md` (tablas nuevas), `openspec/CAPACIDADES.md`.
- **Trazabilidad:** CU-07, casos CP-07.1 a CP-07.6 más CP-06.5e (alerta atendida por orden).
- **Fuera de alcance:** puntuación de proveedores y comparador (HU-12), redacción con IA (HU-08), recepción de mercadería vinculada a la orden, adjuntos PDF, WhatsApp, verificación de dominio de correo, órdenes en la app Android.
