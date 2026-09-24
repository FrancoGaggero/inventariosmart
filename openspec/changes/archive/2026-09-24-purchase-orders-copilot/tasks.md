## 1. Contrato compartido

- [x] 1.1 `packages/shared/src/ordenes.ts` (D1): estados, motivos, etiquetas, `formatearNumeroOrden`, `elegirProveedor`, `totalOrden`, esquemas de sugerencia, orden, listado, query, create y patch; `AlertaSchema` suma `ordenCompraId` nullable; exportado en `index.ts` y `dist` reconstruido. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con los casos de CP-07.1 (menor costo), CP-07.1b (empate por confiabilidad, principal sin precio), sin candidatos → null, `totalOrden` con costo nulo y `OC-0001`

## 2. API · base de datos y módulo purchase-orders

- [x] 2.1 Migración `20260926_purchase_orders` (D2): enums, `orden_compra`, `orden_compra_item`, `alerta.orden_compra_id`, índices, RLS y privilegios (`orden_compra` sin DELETE); `schema.prisma` y `TENANT_MODELS`; `test/helpers.ts` limpia las tablas nuevas. Listo cuando: `prisma migrate deploy` corre en Neon dev y `rls.e2e-spec.ts` cubre las dos tablas (aislamiento y DELETE rechazado en `orden_compra`)
- [x] 2.2 `plantillas/orden.ts` (`armarOrden`) con test unitario y `Correo.responderA` mapeado a `replyTo` en `ResendMailer`; `AlertsModule` exporta `Mailer`. Listo cuando: `orden.spec.ts` verifica saludo con contacto, código, cantidad, "2.000,00", total, "7 días" y firma con comercio y dueño
- [x] 2.3 `PurchaseOrdersService.sugerir()` (D3) con recálculo bajo demanda y elección de proveedor. Listo cuando: CP-07.1, CP-07.1b y CP-07.1c pasan
- [x] 2.4 `crear`, `editar`, `obtener`, `listar`, `cancelar` (D4) con numeración por comercio, costo vigente por ítem, total y regeneración del texto. Listo cuando: CP-07.2, CP-07.2b, CP-07.2c, CP-07.2d, CP-07.3, CP-07.3b, CP-07.5 y CP-07.5b pasan
- [x] 2.5 `confirmar` (D4): atender alertas por producto con `orden_compra_id`, envío tras el commit, estados `ENVIADA` / `CONFIRMADA` con motivo, 409 en reconfirmación. Listo cuando: CP-07.4, CP-07.4b, CP-07.4c y CP-07.4d pasan con `LogMailer` (incluido un doble que devuelve `false`), y CP-06.5e pasa en `alerts.e2e-spec.ts`
- [x] 2.6 `PurchaseOrdersController` y DTOs Swagger (D5), `@RequierePlan('PRO')`, roles, `suggest` antes de `:id`, módulo registrado en `AppModule`. Listo cuando: CP-07.6, CP-07.6b y CP-07.6c pasan
- [x] 2.7 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene las rutas `/purchase-orders*` y `ordenCompraId` en la alerta, y CI no reporta contrato desactualizado

## 3. Web · órdenes

- [x] 3.1 `lib/ordenes.ts` con hooks e invalidaciones de órdenes y alertas (D6). Listo cuando: confirmar una orden desde la web actualiza el contador de Alertas sin recargar
- [x] 3.2 `SugerenciaPage` en `/ordenes/nueva`: tarjetas por proveedor con motivo, cantidades editables, "Crear borrador", bloque "Sin proveedor", toggle de severidad, aviso sin alertas. Listo cuando: CP-07.1 y CP-07.1c se ven en la web y "Crear borrador" navega al borrador creado
- [x] 3.3 `OrdenPage` en `/ordenes/:id`: edición de proveedor, ítems, notas y texto con "Volver al texto sugerido", "Confirmar y enviar" con leyenda del destino, "Cancelar borrador", vista de sólo lectura con "Copiar texto" y motivo de no envío. Listo cuando: CP-07.2, CP-07.3b, CP-07.4 y CP-07.4b se ven en la web
- [x] 3.4 `OrdenesPage` en `/ordenes` con chips por estado y "Nueva orden"; rutas en `router.tsx`; enlace "Órdenes" en `AppShell` (PRO); botón "Generar orden" y "Atendida · OC-000n" en `AlertasPage`. Listo cuando: CP-07.5 se ve en la web y desde Alertas se llega a la sugerencia en un clic

## 4. Documentación y cierre

- [x] 4.1 ADR 0011 (órdenes en modo copiloto), README (rutas de HU-07, verificación de dominio para enviar a proveedores), `docs/arquitectura.html` (§6 `purchase-orders`, RN-06 construida), `docs/runbooks/rls.md` (tablas nuevas), `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D8
- [x] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [x] 4.3 Producción: migración aplicada por Render; proveedor de prueba con el email de Franco; sugerencia, borrador, edición, confirmación y correo recibido; orden `SIN_EMAIL` con texto copiable; alerta "Atendida · OC-0001". Listo cuando: CP-07.1, CP-07.2, CP-07.3, CP-07.4 y CP-07.4b se cumplen en `https://inventariosmart0.vercel.app/ordenes`
- [x] 4.4 (manual, Franco) Mover HU-07 a Hecho en Trello, `Backlog_InventarioSmart_v2.xlsx` y Gantt. Listo cuando: Trello, backlog y Gantt coinciden
