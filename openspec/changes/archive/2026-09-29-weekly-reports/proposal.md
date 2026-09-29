## Why

El panel (HU-04) y la rentabilidad (HU-03) responden cuando el dueño entra a mirar; nadie le cuenta cómo le fue si no entra. La Propuesta compromete un **reporte semanal de rentabilidad** enviado automáticamente (HU-09, RF-09) con los productos estrella y las oportunidades de ahorro, y que quede consultable después. Con alertas (HU-06) y órdenes (HU-07) cerradas, ya existen el correo intercambiable, el cron diario y los cálculos de RN-01/RN-02/RN-08 que el reporte necesita: es la historia más barata de la Fase 2 y cierra el ciclo "el sistema te avisa" de la demo.

Cubre **HU-09** (RF-09; RN-01, RN-02, RN-08) en la **Fase 2 – Alertas**; plan mínimo **PRO** (RF-15: el plan FREE no tiene reportes). Es la decimotercera capacidad de `openspec/CAPACIDADES.md`.

## What Changes

- **Reporte semanal persistido**: una fila por comercio y semana ISO (lunes a domingo, zona Buenos Aires) en la tabla nueva `reporte_semanal`, con el contenido como snapshot JSON: ventas netas, unidades, costo vendido, margen bruto y neto de la semana (RN-01, RN-02 con el gasto por unidad del mes en que termina la semana), variación contra la semana anterior, hasta 5 **productos estrella** (mayor margen bruto generado en la semana), **oportunidades de ahorro** de tres tipos con un monto estimado cada una, y las alertas de reposición críticas abiertas al cierre. Guarda además destinatarios, fecha de envío y motivo de no envío.
- **Oportunidades de ahorro** (HU-09 criterio 2), calculadas al generar: (a) *comprar más barato*: productos cuyo costo vigente del proveedor principal supera el menor costo cargado por otro proveedor activo (ahorro = diferencia × unidades vendidas en los últimos 30 días, RN-08); (b) *capital inmovilizado*: productos activos con stock y sin ventas en 30 días (monto = stock × costo); (c) *margen bajo*: productos vendidos en la semana con margen bruto menor al 15 % del precio neto (monto = ventas netas de esos productos). Cada tipo lista hasta 5 productos.
- **Generación automática** (criterios 1 y 3): job los lunes a las 08:00 de Buenos Aires para los comercios con plan PRO o superior y reportes activos, que genera la semana recién cerrada y envía el correo a los dueños activos más los destinatarios extra. Como Render Free duerme la instancia, al consultar los reportes el sistema genera (y envía) el de la última semana cerrada si falta. El DUENIO puede además pedir `POST /reports/weekly/generate` para regenerar la semana en curso o una semana dada (sin reenvío si ya se envió, salvo que se pida).
- **Consulta** (criterio 4): `GET /reports/weekly` (cursor, de la más reciente a la más antigua), `GET /reports/weekly/:id` con el contenido completo.
- **Ajustes**: `GET/PATCH /reports/settings` con `activo` (default true) y `destinatariosExtra` (hasta 5 emails), guardados en el comercio.
- **Correo**: plantilla HTML simple con los números de la semana, estrellas, oportunidades y enlace al reporte en la web; se envía una sola vez por reporte; sin proveedor configurado queda en el log.
- **Web**: página `/reportes` con listado y detalle (mismas piezas visuales del panel: KPI, anillos, barras), enlace "Reportes" en la navegación (PRO), bloque de ajustes en la página Comercio.
- **Contrato**: shared, OpenAPI y cliente regenerados; migración `20260927_weekly_reports` con RLS y privilegios.

Supuestos registrados:
- **Semana** = lunes 00:00 a domingo 23:59:59 en Buenos Aires (ISO 8601), identificada como `AAAA-Www`.
- **Margen neto semanal** usa el gasto operativo por unidad del mes en que termina la semana (HU-13 ya lo calcula); si ese mes no tiene gastos o ventas, el neto es "no calculable" con el mismo motivo que HU-03.
- **Umbral de margen bajo** fijo en 15 % en esta change; hacerlo configurable es evolución.
- **Correo**: Resend sin dominio verificado sólo entrega a la casilla del dueño de la cuenta; los e2e usan `LogMailer`. Los destinatarios extra sirven igual para la demo con la casilla de Franco.
- **Mobile** no cambia.

## Capabilities

### New Capabilities

- `weekly-reports`: generación semanal automática y bajo demanda del reporte de rentabilidad (números de la semana, productos estrella, oportunidades de ahorro, alertas críticas), envío por correo una sola vez, consulta del historial, ajustes por comercio, plan PRO y permisos.

### Modified Capabilities

Ninguna: HU-03, HU-04, HU-06 y HU-13 se consumen, no cambian.

## Impact

- **Código:** `apps/api` módulo nuevo `reports` (service, generador de contenido, cron, plantilla, controller, DTOs, módulo) que reutiliza `ProfitabilityService` (nuevas variantes por rango de fechas), `ExpensesService.resumen`, `AlertsService` (críticas abiertas), `Mailer`; `packages/shared` `reportes.ts` (esquemas, semana ISO, umbral, funciones puras de oportunidades); `packages/api-client` regenerado; `apps/web` `lib/reportes.ts`, `features/reportes/{ReportesPage,ReportePage}.tsx`, enlace en `AppShell`, ajustes en `ComercioPage`.
- **Base de datos:** migración con tabla `reporte_semanal` (comercio_id, semana, desde, hasta, contenido JSONB, destinatarios, enviado_en, motivo_no_envio, generado_en; único por comercio y semana), columnas `comercio.reportes_activos` (default true) y `comercio.reportes_destinatarios` (text[]), RLS y `app_api` sin DELETE; `TENANT_MODELS` suma `ReporteSemanal`.
- **Documentación:** ADR 0013 (reporte como snapshot semanal, generación automática y bajo demanda, oportunidades de ahorro por reglas), README, `docs/arquitectura.html` (§6 `reports`), `docs/runbooks/rls.md`, `openspec/CAPACIDADES.md`.
- **Trazabilidad:** CU-09, casos CP-09.1 a CP-09.6.
- **Fuera de alcance:** IA (HU-08), comparador con puntuación (HU-12), PDF adjunto, WhatsApp, elección de día y hora del envío, reportes en la app Android, umbral de margen configurable.
