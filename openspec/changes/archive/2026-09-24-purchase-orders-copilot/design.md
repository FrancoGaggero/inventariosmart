## Context

Ver proposal.md – Why. Lo que ya existe y esta change reutiliza: alertas persistidas con `cantidadSugerida`, `leadTimeDias` y severidad (`AlertsService`, HU-06), estado `ATENDIDA` que frena alertas nuevas hasta el próximo ingreso; historial de costos `precio_proveedor` de sólo inserción y la consulta "último costo por producto y proveedor" (`PricesService`, HU-02, RN-08); `Proveedor` con `email`, `contacto`, `leadTimeDias` y `confiabilidad`; `Mailer` intercambiable (`ResendMailer` / `LogMailer`, design D5 de HU-06); `PlanGuard` con `@RequierePlan('PRO')`; `PrismaService.transaccionTenant`; cursor opaco de `common/cursor.ts`; RLS estándar y el runbook `docs/runbooks/rls.md`. El documento de arquitectura ya preveía el módulo `purchase-orders` (`GET/POST /purchase-orders`, `PATCH /:id`, `POST /:id/confirm`, "Dueño (confirmar)") y las entidades `OrdenCompra + Item`.

Restricciones: Resend sin dominio verificado sólo entrega a la casilla del dueño de la cuenta, así que en producción el correo al proveedor puede fallar; los e2e no dependen de servicios externos; el comercio no tiene email ni teléfono propios (la firma usa el nombre del comercio y el usuario que confirma).

## Goals / Non-Goals

**Goals:**
- Sugerencia determinista y explicable (cada ítem dice por qué se eligió el proveedor).
- Cero envíos sin confirmación (RN-06) verificable en e2e con `LogMailer`.
- Borrador editable con texto regenerable sin pisar lo que el dueño escribió.
- Cierre del ciclo con HU-06: confirmar atiende las alertas y deja la traza.

**Non-Goals:**
- Puntuación ponderada de proveedores (HU-12), redacción con IA (HU-08), recepción vinculada a la orden, PDF, WhatsApp, órdenes en mobile, gestión de planes (HU-14).

## Decisions

### D1 · Contrato en `packages/shared/src/ordenes.ts`
Constantes `ESTADOS_ORDEN = ['BORRADOR','CONFIRMADA','ENVIADA','CANCELADA']`, `MOTIVOS_NO_ENVIO = ['SIN_EMAIL','ENVIO_FALLIDO']`, `MOTIVOS_ELECCION = ['MENOR_COSTO','MENOR_LEAD_TIME','MAYOR_CONFIABILIDAD','PROVEEDOR_PRINCIPAL']`, etiquetas en español, `formatearNumeroOrden(n) → "OC-0001"`. Funciones puras con tests: `elegirProveedor(candidatos, proveedorPrincipalId)` (ordena por costo asc, lead time asc, confiabilidad desc y devuelve `{ proveedorId, costo, motivo }` o el principal o null), `totalOrden(items)` (suma de `cantidad × costo` ignorando costos nulos, decimal como string con 2 decimales). Esquemas zod: `SugerenciaOrdenesSchema` (`grupos[]` con proveedor, `motivoEleccion` por ítem, `items[]`, `totalNeto`, `leadTimeDias`; `sinProveedor[]`; `severidad` consultada; `calculadasEn`), `SugerenciaQuerySchema` (`severidad: 'CRITICA' | 'TODAS'`, default `CRITICA`), `OrdenCompraSchema`, `OrdenResumenSchema` (listado), `ListaOrdenesSchema`, `OrdenesQuerySchema` (`estado` | `TODAS`, cursor, limit 25), `OrdenCreateSchema` (`proveedorId`, `items[{ productoId, cantidad ≥ 1, alertaId? }]` mínimo 1, `notas?`), `OrdenPatchSchema` (`proveedorId?`, `items?` reemplaza la lista completa, `notas?`, `texto?`, `asunto?`, `regenerarTexto?`; al menos un campo). Alternativa descartada: ítems con PATCH individual (`/items/:id`), más rutas para un borrador que se edita entero en una pantalla.

### D2 · Modelo de datos
Tabla `orden_compra`: `id`, `comercio_id`, `numero INT` (único por `(comercio_id, numero)`), `proveedor_id` (FK, `ON DELETE RESTRICT`), `estado` (`EstadoOrdenCompra`), `asunto VARCHAR(200)`, `texto TEXT`, `texto_editado BOOLEAN DEFAULT false`, `notas VARCHAR(500) NULL`, `total_neto DECIMAL(14,2)`, `motivo_no_envio` (`MotivoNoEnvio` NULL), `creada_por` (FK usuario), `confirmada_por` NULL, `confirmada_en`, `enviada_en`, `enviada_a VARCHAR(254)`, `cancelada_en`, `creado_en`, `actualizado_en`. Tabla `orden_compra_item`: `id`, `comercio_id`, `orden_id` (FK `ON DELETE CASCADE`), `producto_id`, `alerta_id NULL`, `cantidad INT CHECK > 0`, `costo_unitario_neto DECIMAL(14,2) NULL`; único `(orden_id, producto_id)`. `alerta.orden_compra_id UUID NULL` (FK). Índices `(comercio_id, creado_en DESC, id DESC)` y `(comercio_id, estado)`. RLS `orden_compra_tenant`/`_sistema` y `orden_compra_item_tenant`/`_sistema` como el resto; `app_api` con SELECT, INSERT, UPDATE y sin DELETE en `orden_compra` (se cancela, no se borra); en `orden_compra_item` sí DELETE (reemplazar ítems de un borrador). `TENANT_MODELS` suma `OrdenCompra` y `OrdenCompraItem`. El número se asigna dentro de la transacción con `pg_advisory_xact_lock(hashtext('oc:' || comercio_id))` y `max(numero) + 1`. Queda en **ADR 0011**. Alternativa descartada: guardar la orden como JSON en la alerta; no permite varias alertas por orden ni historial.

### D3 · Sugerencia en `PurchaseOrdersService.sugerir()`
Dentro de `transaccionTenant`: (1) recálculo bajo demanda de alertas si está vencido (reutiliza `AlertsService.recalcular({ soloSiVencido: true })`, misma regla que el panel); (2) una consulta que trae las alertas `ACTIVA` con la severidad pedida, su producto (código, nombre, stock, costo de reposición, proveedor principal) y, por `LEFT JOIN LATERAL`, el último costo vigente de cada proveedor activo para ese producto (`DISTINCT ON (proveedor_id) ... ORDER BY vigente_desde DESC, creado_en DESC`) con lead time y confiabilidad; (3) `elegirProveedor` por fila en memoria; (4) agrupación por proveedor, orden de grupos por total desc, ítems por días de cobertura asc; `cantidad = max(1, cantidadSugerida)`. Sin escritura. Alternativa descartada: guardar la sugerencia como borradores automáticos; generaría órdenes que nadie pidió y confundiría el listado.

### D4 · Borrador, edición y texto en `PurchaseOrdersService`
`crear(dto)` y `editar(id, dto)` corren en `transaccionTenant`: validan proveedor activo del comercio (404 si ajeno, 400 si inactivo) y productos activos (404 ajeno, 400 inactivo), consultan el costo vigente del proveedor por producto (misma subconsulta de D3) con fallback a `costo_reposicion`, reemplazan los ítems (`deleteMany` + `createMany`), recalculan `total_neto` y, si `texto_editado = false` o `regenerarTexto`, regeneran asunto y texto con `plantillas/orden.ts` (`armarOrden({ numero, comercio, proveedor, items, totalNeto, leadTimeDias, duenio })`, formato de montos `2.000,00`, texto plano con saltos de línea; el HTML del correo se deriva escapando y envolviendo en `<pre>`-like párrafos). `PATCH` con `texto` marca `texto_editado = true`. Estados: sólo `BORRADOR` acepta `PATCH` y `cancel`; el resto 409 `CONFLICTO`. `confirmar(id)`: en la transacción, `BORRADOR` → carga la orden, marca `confirmada_por/en`, `UPDATE alerta SET estado='ATENDIDA', atendida_en=now(), pospuesta_hasta=NULL, orden_compra_id=:id WHERE producto_id IN (...) AND estado IN ('ACTIVA','POSPUESTA')` (no depende de `alerta_id` del ítem, así cubre alertas generadas después del borrador), y decide el envío: sin email → `CONFIRMADA` + `SIN_EMAIL`; con email → commit y luego `Mailer.enviar({ para: [email], responderA: duenio.email, asunto, html, texto })`; `true` → `ENVIADA` + `enviada_en` + `enviada_a`; `false` → `CONFIRMADA` + `ENVIO_FALLIDO`. El envío ocurre después del commit para no dejar una transacción abierta esperando a Resend; el estado final se escribe en un `update` corto. `Correo` suma `responderA?: string` y `ResendMailer` lo mapea a `replyTo`. Alternativa descartada: enviar dentro de la transacción; un timeout del proveedor de correo revertiría la confirmación aunque el correo hubiese salido.

### D5 · Endpoints y permisos
`PurchaseOrdersController` en `purchase-orders` con `@RequierePlan('PRO')` y `@Roles('DUENIO','CONTADOR')` a nivel de clase; escritura `@Roles('DUENIO')`:

| Método y ruta | Roles | Descripción |
| --- | --- | --- |
| `GET /purchase-orders/suggest?severidad=` | DUENIO, CONTADOR | Sugerencia agrupada por proveedor |
| `GET /purchase-orders?estado=&cursor=&limit=` | DUENIO, CONTADOR | Listado por cursor `(creado_en DESC, id DESC)` |
| `GET /purchase-orders/:id` | DUENIO, CONTADOR | Detalle con ítems y texto |
| `POST /purchase-orders` | DUENIO | Crear borrador (201) |
| `PATCH /purchase-orders/:id` | DUENIO | Editar borrador |
| `POST /purchase-orders/:id/confirm` | DUENIO | Confirmar y enviar (200) |
| `POST /purchase-orders/:id/cancel` | DUENIO | Cancelar borrador (200) |

`suggest` declarado antes de `:id` (lección de HU-13). Plan FREE: 402 en todas. EMPLEADO: 403 por `@Roles`. `SensitiveFieldsInterceptor` no aplica porque el EMPLEADO no accede. `PurchaseOrdersModule` importa `PrismaModule` y `AlertsModule` (por `AlertsService` y el `Mailer` exportado; `AlertsModule` pasa a exportar `Mailer`). Contrato OpenAPI y `packages/api-client` regenerados con `pnpm openapi`.

### D6 · Web
- `lib/ordenes.ts`: `ORDENES_KEY`, `useSugerencia(severidad)`, `useOrdenes(estado)` (infinite), `useOrden(id)`, `useCrearOrden`, `useEditarOrden`, `useConfirmarOrden`, `useCancelarOrden`; las mutaciones invalidan `ORDENES_KEY` y `ALERTAS_KEY` (confirmar atiende alertas); `formatearEstadoOrden`.
- `features/ordenes/OrdenesPage.tsx` (`/ordenes`, `RequireRole(['DUENIO','CONTADOR'])`): chips por estado, tabla (número, proveedor, ítems, total, estado, fecha), botón "Nueva orden" (DUENIO).
- `features/ordenes/SugerenciaPage.tsx` (`/ordenes/nueva`): frase de cabecera ("Con las alertas de hoy conviene pedir a 2 proveedores"), toggle "Incluir próximas al quiebre", una tarjeta por proveedor con motivo de elección, ítems editables (cantidad) y "Crear borrador"; bloque "Sin proveedor" con enlace al producto para asignar uno; sin alertas críticas: `Aviso` con enlace a Alertas. Acepta `?severidad=`.
- `features/ordenes/OrdenPage.tsx` (`/ordenes/:id`): cabecera con número y estado; en `BORRADOR` (DUENIO) selector de proveedor, tabla de ítems editable (agregar producto con buscador, cantidad, quitar), notas, vista previa del texto editable con "Volver al texto sugerido", botones "Guardar", "Confirmar y enviar" (un clic, con leyenda "Se envía a compras@sur.com" o "Este proveedor no tiene email: la orden queda confirmada para que la envíes por otro medio") y "Cancelar borrador"; en el resto de estados, vista de sólo lectura con "Copiar texto" y motivo de no envío si corresponde.
- `AlertasPage`: botón "Generar orden" (DUENIO, con alertas críticas) a `/ordenes/nueva`; columna estado muestra "Atendida · OC-0003" cuando hay `ordenCompraId`. `AppShell`: enlace "Órdenes" (`ShoppingCart`) para DUENIO y CONTADOR con plan PRO. `router.tsx`: las tres rutas bajo `RequireRole(['DUENIO','CONTADOR'])`; crear/editar se protege en la página por rol.

### D7 · Tests
Unitarios en shared (`elegirProveedor` con los casos de CP-07.1 y CP-07.1b, `totalOrden`, `formatearNumeroOrden`) y en la API (`plantillas/orden.spec.ts`: código, cantidad, montos, lead time, firma). e2e `purchase-orders.e2e-spec.ts`: CP-07.1 a CP-07.6c con `LogMailer` (destinatario, `responderA`, asunto, cuenta de correos); `alerts.e2e-spec.ts` suma CP-06.5e; `rls.e2e-spec.ts` cubre `orden_compra` (sin DELETE) y `orden_compra_item`; `test/helpers.ts` limpia las tablas nuevas antes que `alerta`, `precio_proveedor` y `proveedor`.

### D8 · Operación y documentación
Sin variables nuevas. ADR 0011; README (rutas de HU-07); `docs/arquitectura.html` (§6 `purchase-orders` construida, RN-06 en la tabla de reglas); `docs/runbooks/rls.md` (tablas nuevas, variante con DELETE en ítems); `openspec/CAPACIDADES.md` (fecha). Para la demo en producción, el comercio de Franco ya está en PRO; el envío real requiere que el proveedor tenga como email la casilla del dueño de la cuenta Resend hasta verificar dominio.

## Risks / Trade-offs

- [Resend rechaza el correo a proveedores reales sin dominio verificado] → la orden queda `CONFIRMADA` con `ENVIO_FALLIDO` y texto copiable; el README explica la verificación de dominio.
- [Costo vigente desactualizado] → el ítem guarda el costo al momento y la vista lo muestra como "estimado"; HU-02 es la fuente y se actualiza al importar listas.
- [Proveedor principal sin precio ni email] → la sugerencia lo usa igual (criterio explícito) y la confirmación queda `SIN_EMAIL`; la UI invita a cargar el email desde la tarjeta.
- [Dos confirmaciones simultáneas] → `UPDATE ... WHERE estado = 'BORRADOR'` con conteo de filas; la segunda recibe 409.
- [Alertas nuevas entre borrador y confirmación] → atender por producto y no por `alerta_id` del ítem.

## Migration Plan

1. Migración `20260926_purchase_orders` (enums, dos tablas, columna en `alerta`, RLS, privilegios) con `prisma migrate deploy` en Neon dev y en producción por Render. 2. Deploy de API y web (aditivo: `ordenCompraId` nuevo en alertas, rutas nuevas). 3. Verificar en producción con un proveedor cuyo email sea la casilla de Franco. Rollback: revertir el commit; la migración es aditiva y puede quedar.
