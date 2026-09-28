## 1. Contrato compartido

- [x] 1.1 `packages/shared/src/whatsapp.ts` (D2): `normalizarWhatsApp`, `canalDeProveedor`, `mensajeWhatsApp`, `enlaceWhatsApp`, canales con esquemas y etiquetas; campos nuevos en `proveedores.ts` y `ordenes.ts` y `ConfirmarOrdenSchema`; exportado en `index.ts` y `dist` reconstruido. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con los cinco teléfonos de CP-16.1, números con `00` y de otro país, el canal de CP-16.1b, el mensaje editado de CP-16.4 y el recorte de CP-16.4b en 3.000 caracteres sin cortar líneas

## 2. API

- [x] 2.1 Migración `20260930_purchase_orders_whatsapp` (D3): enum `canal_envio`, `proveedor.canal_preferido` con su `CHECK`, `orden_compra.canal` y relleno de las enviadas; `schema.prisma`. Listo cuando: `prisma migrate deploy` corre en Neon dev y las órdenes `ENVIADA` existentes quedan con `canal = 'EMAIL'`
- [x] 2.2 Proveedores (D6): `canalPreferido` en alta y edición con validación contra los datos resultantes; `whatsapp` y `canal` en las respuestas; DTOs Swagger. Listo cuando: CP-16.1, CP-16.1b y CP-16.1c pasan y `suppliers.e2e-spec.ts` sigue en verde
- [x] 2.3 Confirmación con canal (D4): cuerpo opcional `{ canal }`, resolución del canal, estados de la tabla de D4 y `whatsappUrl` sólo en `CONFIRMADA` por WhatsApp. Listo cuando: CP-16.2, CP-16.2b, CP-16.2c, CP-16.4 y CP-16.4b pasan, y CP-07.4 a CP-07.4d siguen pasando con `canal` en la respuesta
- [x] 2.4 `POST /purchase-orders/:id/mark-sent` (D5) con roles, plan y DTOs. Listo cuando: CP-16.3, CP-16.3b, CP-16.3c y CP-16.3d pasan
- [x] 2.5 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene `/purchase-orders/{id}/mark-sent` y los campos nuevos, y CI no reporta contrato desactualizado

## 3. Web

- [x] 3.1 Proveedores (D8): canal preferido y vista del número de WhatsApp en `ProveedorFormPage`; chip del canal en el detalle y el listado. Listo cuando: CP-16.5b se ve en la web y el formulario no desborda a 360 px
- [x] 3.2 `lib/ordenes.ts` y `OrdenPage` (D8): botón de confirmar según el canal, elección de canal, "Abrir WhatsApp" como enlace, "Ya la envié", "Copiar texto"; icono del canal en `OrdenesPage`. Listo cuando: CP-16.5 se ve en la web a 360 y 1280 px en los dos temas, y antes de confirmar no existe ningún enlace a `wa.me` en la página

## 4. Documentación y cierre

- [x] 4.1 ADR 0015, README, `docs/arquitectura.html`, `openspec/config.yaml` (HU-16, RF-17) y `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D10
- [ ] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 4.3 Producción: migración aplicada por Render; Franco carga el teléfono de un proveedor, confirma una orden por WhatsApp, la envía y la marca como enviada. Listo cuando: CP-16.2, CP-16.3 y CP-16.5 se cumplen en `https://inventariosmart0.vercel.app/ordenes`
- [ ] 4.4 (manual, Franco) Sumar HU-16 y RF-17 al backlog, a la Propuesta y al Gantt, y mover la tarjeta en Trello. Listo cuando: Trello, backlog y Gantt coinciden
