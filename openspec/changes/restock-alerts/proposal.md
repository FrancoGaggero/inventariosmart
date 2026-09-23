## Why

El 75 % de los comercios encuestados sufre quiebres de stock todos los meses; hoy InventarioSmart sólo avisa cuando el stock ya está bajo o en cero (alertas del panel de HU-04), es decir, tarde. La Propuesta compromete alertas **predictivas** (HU-06, RF-06, RN-04): calcular cuándo reponer cada producto según su velocidad de venta y el lead time del proveedor, avisar antes de llegar a cero y dejar que el dueño ajuste la anticipación por producto. Con la Fase 1 cerrada y verificada, es la primera historia de la Fase 2 y la que más valor demuestra en la demo.

Cubre **HU-06** (RF-06, RN-04) en la **Fase 2 – Alertas**; plan mínimo **PRO** (RF-15: el plan FREE no tiene alertas). Es la undécima capacidad del mapa de `openspec/CAPACIDADES.md`.

## What Changes

- **Cálculo RN-04** en `packages/shared`: velocidad diaria = unidades VENTA no anuladas de los últimos 30 días ÷ 30; punto de reposición = velocidad × lead time del proveedor principal + stock de seguridad; **umbral de alerta** = velocidad × (lead time + días de anticipación del producto) + stock de seguridad; días de cobertura = stock ÷ velocidad; cantidad sugerida para cubrir un mes de ventas. Sin proveedor principal, lead time por defecto de 7 días.
- **Alertas persistidas** en una tabla nueva `alerta` (una abierta por producto) con estado `ACTIVA`, `POSPUESTA`, `ATENDIDA` o `RESUELTA`, severidad `PROXIMA` (stock por debajo del umbral) o `CRITICA` (por debajo del punto de reposición), y las cifras con las que se calculó. Se generan y actualizan en cada **recálculo**: un job diario a las 07:00 de Buenos Aires, bajo demanda cuando el dueño abre las alertas o el panel y el último cálculo tiene más de una hora, y a pedido con un botón. Se resuelven solas cuando entra mercadería.
- **Umbral por producto** (HU-06 criterio 4): campo `diasAnticipacionAlerta` (0 a 90, default 3) en alta y edición de productos.
- **Notificación** (HU-06 criterio 3): en la app (página Alertas con contador en la navegación y bloque "Reposición" en el panel) y por **correo** con Resend a los dueños del comercio, un resumen por recálculo con las alertas nuevas, cada alerta se notifica una sola vez. Sin proveedor de correo configurado, la API registra el envío en el log y no falla. WhatsApp queda fuera (opcional en la HU).
- **Gestión**: el DUENIO marca una alerta como atendida (ya pidió; no se vuelve a generar hasta que entre un ingreso) o la pospone 7 días; el CONTADOR consulta; el EMPLEADO no accede.
- **Endpoints** `GET /alerts`, `GET /alerts/summary`, `POST /alerts/recalculate`, `PATCH /alerts/:id`; el panel de HU-04 suma `alertas.reposicion` (null en plan FREE).
- **Web**: página `/alertas`, enlace con contador, bloque en el panel, campo en el formulario de producto, aviso "Disponible en el plan PRO" para FREE.
- **Contrato**: shared, OpenAPI y cliente regenerados; migración `20260925_restock_alerts` con RLS y privilegios.

Supuestos registrados:
- **"Se acerca al quiebre"** se mide en días de cobertura contra el lead time más la anticipación configurada; con velocidad cero no hay alerta predictiva (las de sin stock y stock bajo del panel siguen cubriendo ese caso).
- **Correo**: Resend en plan gratuito con remitente `onboarding@resend.dev` hasta verificar dominio; sólo entrega a la casilla del dueño de la cuenta Resend. Crear la cuenta y la API key es tarea manual de Franco; la funcionalidad se prueba con un doble en e2e.
- **Render Free duerme**: el cron en proceso no corre mientras la instancia está dormida; el recálculo bajo demanda garantiza que lo que se ve nunca tenga más de una hora.
- **El comercio de Franco en producción está en plan FREE**: para verificar hay que pasarlo a PRO con SQL (runbook); HU-14 (Fase 3) traerá la gestión de planes.
- **Mobile** no cambia en esta change (el modelo Dart ignora `alertas.reposicion`); mostrar las alertas en la app queda para un change `mobile-alerts` posterior.

## Capabilities

### New Capabilities

- `restock-alerts`: cálculo del punto de reposición y del umbral de alerta por producto (RN-04), generación y ciclo de vida de alertas predictivas, notificación en la app y por correo, gestión por el dueño, plan PRO.

### Modified Capabilities

- `financial-dashboard`: `alertas` suma `reposicion` (total y primeras alertas activas, o `null` en plan FREE) y el panel dispara el recálculo si está vencido.
- `product-catalog`: alta y edición aceptan `diasAnticipacionAlerta` (0 a 90, default 3) y el producto lo expone.

## Impact

- **Código:** `apps/api` módulo nuevo `alerts` (service, cron, mailer, controller, DTOs) y cambios en `products` (campo), `dashboard` (bloque), `config/env.ts` (`RESEND_API_KEY`, `MAIL_FROM`), `app.module.ts` (`ScheduleModule`); dependencias `@nestjs/schedule` y `resend`; `packages/shared` `alertas.ts`; `packages/api-client` regenerado; `apps/web` página Alertas, navegación, panel y formulario de producto.
- **Base de datos:** migración con tabla `alerta` (comercio_id, RLS, índice único parcial por producto abierto, sin DELETE para `app_api`), enums `EstadoAlerta` y `SeveridadAlerta`, `producto.dias_anticipacion_alerta` y `comercio.alertas_calculadas_en`.
- **Documentación:** ADR 0010 (alertas persistidas con recálculo diario y bajo demanda), README, `docs/arquitectura.html` (§6 `alerts`, RN-04), runbooks (`deploy.md` variables de correo; `rls.md` tabla nueva; cambio de plan por SQL), `openspec/CAPACIDADES.md`.
- **Trazabilidad:** CU-06, casos CP-06.1 a CP-06.7 más CP-04.1e y CP-01.4e.
- **Fuera de alcance:** WhatsApp y push, órdenes de compra (HU-07), comparador de proveedores (HU-12), reportes semanales (HU-09), alertas en mobile, gestión de planes (HU-14), verificación de dominio de correo.
