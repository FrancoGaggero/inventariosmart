## Context

Ver proposal.md – Why. Lo que ya existe y esta change reutiliza: `ProfitabilityService.resumen(mes)` y `topDelMes(mes, n)` (agregan ventas VENTA no anuladas por rango de fechas del mes con `inicioMesBuenosAires`), `ExpensesService.resumen(mes)` (gasto por unidad del mes con motivo `SIN_GASTOS` / `SIN_VENTAS`), `AlertsService` (alertas persistidas con severidad), `Mailer` con `ResendMailer` / `LogMailer` y `responderA`, `AlertsCron` (patrón de job por comercio con `comoSistema` + `TenantContext.correr`), `PlanGuard`, cursor opaco, RLS estándar y runbook. El documento de arquitectura ya preveía el módulo `reports` (`GET /reports/weekly`, `PATCH /reports/settings`) y la entidad `ReporteSemanal`.

Restricciones: Render Free duerme (el cron no corre dormido); Resend sin dominio verificado sólo entrega a la casilla del dueño de la cuenta; los e2e no dependen de servicios externos; `@nestjs/schedule` 6.x.

## Goals / Non-Goals

**Goals:**
- Un reporte por semana y comercio, reproducible y guardado como se envió.
- Cero intervención manual: cron + generación bajo demanda cubren Render dormido.
- Oportunidades de ahorro explicables por reglas simples con monto estimado.
- Todo verificable con `LogMailer` y funciones puras.

**Non-Goals:**
- IA, PDF, WhatsApp, elección de día/hora, umbral configurable, comparador con puntuación (HU-12), reportes en mobile.

## Decisions

### D1 · Contrato en `packages/shared/src/reportes.ts`
`SemanaSchema` (`AAAA-Www`, semana 01 a 53) con `semanaDe(fecha)` (ISO, lunes como primer día, en Buenos Aires con desfase fijo −03:00), `rangoSemana(semana) → { desde, hasta }` (instantes UTC del lunes 00:00 y del lunes siguiente 00:00 en Buenos Aires), `semanaAnterior(semana)`, `ultimaSemanaCerrada(ahora)`. `UMBRAL_MARGEN_BAJO_PCT = 15`, `MAX_ESTRELLAS = 5`, `MAX_OPORTUNIDADES = 5`, `MAX_DESTINATARIOS_EXTRA = 5`. Funciones puras con tests: `oportunidadesCompra(filas)`, `capitalInmovilizado(filas)`, `margenBajo(filas)` (cada una filtra, calcula el monto, ordena desc y corta a 5, devolviendo `{ items, total }`). Esquemas: `ContenidoReporteSchema` (semana, desde, hasta, `resumen` con los campos de `ResumenRentabilidad` sin `periodo`, `semanaAnterior { semana, ventasNetas, variacionVentasPct }`, `estrellas[]` (producto, unidades, margenBrutoPct, margenBrutoSemana), `oportunidades { comprarMasBarato, capitalInmovilizado, margenBajo }`, `alertasCriticas[]` (producto, diasCobertura, cantidadSugerida), `generadoEn`), `ReporteSemanalSchema` (id, semana, desde, hasta, contenido, destinatarios, enviadoEn, motivoNoEnvio, generadoEn), `ReporteResumenSchema` (listado), `ListaReportesSchema`, `ReportesQuerySchema` (cursor, limit 12), `GenerarReporteSchema` (`semana?` default semana en curso, `enviar?` default false), `AjustesReportesSchema` y `AjustesReportesPatchSchema` (`activo?`, `destinatariosExtra?` hasta 5 emails únicos). `MOTIVOS_NO_ENVIO_REPORTE = ['SIN_PROVEEDOR','ENVIO_FALLIDO','SIN_DESTINATARIOS']`.

### D2 · Modelo de datos
Tabla `reporte_semanal`: `id`, `comercio_id`, `semana VARCHAR(8)`, `desde TIMESTAMPTZ`, `hasta TIMESTAMPTZ`, `contenido JSONB`, `destinatarios TEXT[] NOT NULL DEFAULT '{}'`, `enviado_en TIMESTAMPTZ NULL`, `motivo_no_envio` (enum `motivo_no_envio_reporte` NULL), `generado_en TIMESTAMPTZ`, `actualizado_en`. Único `(comercio_id, semana)`; índice `(comercio_id, semana DESC)`. RLS `reporte_semanal_tenant` / `_sistema`; `app_api` con SELECT, INSERT, UPDATE y sin DELETE (el historial no se borra). `comercio.reportes_activos BOOLEAN NOT NULL DEFAULT true` y `comercio.reportes_destinatarios TEXT[] NOT NULL DEFAULT '{}'`. `TENANT_MODELS` suma `ReporteSemanal`. El contenido va como JSON validado con `ContenidoReporteSchema` al leer: es un snapshot (los costos y gastos cambian después) y no se consulta por campo. Queda en **ADR 0013**. Alternativa descartada: recalcular al leer; el reporte enviado por correo dejaría de coincidir con el de la web.

### D3 · Generación en `ReportsService.generar(semana, opts)`
Dentro de `transaccionTenant`: (1) `rangoSemana`; (2) `ProfitabilityService` gana dos métodos por rango, `resumenEntre(desde, hasta, mesGastos)` y `topEntre(desde, hasta, n)`, extraídos de los actuales por mes (que pasan a delegar en ellos) para no duplicar el SQL; el mes de gastos es el del último día de la semana; (3) semana anterior con `resumenEntre` para la variación; (4) una consulta para las oportunidades: por producto activo, costo vigente, proveedor principal, stock, unidades vendidas en 30 días, unidades y ventas netas y costo de la semana, y por `LEFT JOIN LATERAL` el menor costo vigente entre otros proveedores activos (`DISTINCT ON (proveedor_id)` como en HU-07) con su nombre; las tres funciones puras de D1 arman las listas; (5) alertas críticas `ACTIVA` con `AlertsService` (consulta directa por severidad); (6) `upsert` por `(comercio_id, semana)` con `contenido`, `generado_en = now()`, conservando `enviado_en` si existía. Devuelve el reporte y si es nuevo. Presupuesto: mismas consultas que el panel más una; sin prueba de carga propia (RNF-04 ya cubierto por HU-04 y HU-06 con los mismos agregados).

### D4 · Envío y disparadores
`enviar(reporte)` después del commit: destinatarios = emails de DUENIO activos ∪ `reportes_destinatarios`; sin destinatarios → `SIN_DESTINATARIOS`; `Mailer.enviar({ para, asunto: "Tu semana en {comercio} · {semana}", html, texto })`; `true` → `enviado_en`, `destinatarios`; `false` → `ENVIO_FALLIDO`; `LogMailer` sin key en producción → `SIN_PROVEEDOR` (el `Mailer` expone `configurado: boolean`). Disparadores: (a) **cron** `ReportsCron` los lunes `0 8 * * 1` Buenos Aires: recorre `comoSistema` los comercios PRO/PREMIUM con `reportes_activos` y para cada uno `generarSiFalta(ultimaSemanaCerrada)` con envío; desactivado en tests; (b) **bajo demanda** en `GET /reports/weekly`: si el comercio tiene reportes activos y falta la última semana cerrada, la genera y envía antes de responder, con `pg_advisory_xact_lock(hashtext('rep:' || comercio_id))` para no duplicar; (c) **a pedido** `POST /reports/weekly/generate { semana?, enviar? }` (DUENIO): regenera y sólo envía si `enviar: true` o si nunca se envió y los reportes están activos. Alternativa descartada: enviar en la misma transacción (un timeout del proveedor revertiría el reporte).

### D5 · Plantilla `reports/plantillas/semanal.ts`
`armarSemanal(comercio, contenido, urlWeb)`: asunto "Tu semana en {comercio} · {desde} al {hasta}", HTML con tabla de números (ventas, unidades, margen bruto y % y neto o "no calculable"), variación con flecha, lista de estrellas, tres bloques de oportunidades con totales (o "Sin oportunidades esta semana: comprás bien, rota y el margen acompaña"), alertas críticas con enlace a `/alertas`, botón "Ver el reporte" a `/reportes/{id}`; texto plano equivalente. Test unitario con montos `es-AR`.

### D6 · Endpoints y permisos
`ReportsController` (`reports`) con `@RequierePlan('PRO')` y `@Roles('DUENIO','CONTADOR')`:

| Método y ruta | Roles | Descripción |
| --- | --- | --- |
| `GET /reports/weekly?cursor&limit` | DUENIO, CONTADOR | Listado (semana DESC); genera la última cerrada si falta |
| `GET /reports/weekly/:id` | DUENIO, CONTADOR | Detalle con contenido |
| `POST /reports/weekly/generate` | DUENIO | Regenerar semana en curso o dada; `enviar` opcional |
| `GET /reports/settings` | DUENIO, CONTADOR | Ajustes |
| `PATCH /reports/settings` | DUENIO | `activo`, `destinatariosExtra` |

`settings` y `weekly/generate` declarados antes de `weekly/:id`. FREE → 402; EMPLEADO → 403. `ReportsModule` importa `PrismaModule`, `ProfitabilityModule`, `AlertsModule` (por `Mailer` y `AlertsService`). OpenAPI y cliente regenerados con `pnpm openapi`.

### D7 · Web
- `lib/reportes.ts`: `useReportes()` (infinite), `useReporte(id)`, `useGenerarReporte()`, `useAjustesReportes()`, `useActualizarAjustesReportes()`, `formatearSemana("2026-W38") → "14 al 20 de sep. de 2026"`.
- `features/reportes/ReportesPage.tsx` (`/reportes`, `RequireRole(['DUENIO','CONTADOR'])`): cabecera con frase ("Tu última semana: vendiste X con un margen de Y %"), botón "Generar el de esta semana" (DUENIO), tarjetas por semana (rango, ventas netas, margen bruto con anillo, oportunidades, estado de envío) con `Entrada`, `EstadoVacio` "Todavía no hay reportes"; en FREE, `Aviso` de plan.
- `features/reportes/ReportePage.tsx` (`/reportes/:id`): secciones Números (KPI como el panel, `MontoAnimado`, `Anillo`), Semana anterior, Estrellas (tabla con `Barra`), Oportunidades (tres tarjetas con listas y totales; enlaces a producto y proveedor), Alertas críticas (enlace a Alertas), pie con "Enviado a … el …" o motivo de no envío y botón "Reenviar" (DUENIO).
- `AppShell`: enlace "Reportes" (`FileBarChart`) para DUENIO y CONTADOR con plan PRO. `ComercioPage`: bloque "Reporte semanal" con interruptor `activo` y lista editable de destinatarios extra (DUENIO).

### D8 · Tests
Shared: `reportes.test.ts` (semana ISO en límites de año y de mes, rango en Buenos Aires, oportunidades con los números de CP-09.2 y CP-09.2b, límites de 5, ajustes inválidos). API unit: `semanal.spec.ts` (plantilla), `reports.cron.spec.ts` (recorre PRO/PREMIUM activos, omite FREE e inactivos). e2e `reports.e2e-spec.ts`: CP-09.1 a CP-09.6c con ventas fechadas dentro y fuera de la semana, `LogMailer` (destinatarios, asunto, cuerpo, conteo), doble que rechaza, ajustes, plan FREE (comercio creado FREE), roles, aislamiento; `rls.e2e-spec.ts` cubre `reporte_semanal`; `profitability.e2e-spec.ts` sigue en verde tras extraer los métodos por rango.

### D9 · Documentación y operación
ADR 0013; README (rutas HU-09, cron de los lunes, bajo demanda); `docs/arquitectura.html` (§6 `reports` construida); `docs/runbooks/rls.md` (tabla nueva); `openspec/CAPACIDADES.md`. Sin variables nuevas. En producción, Franco agrega su casilla como destinatario extra (o ya es dueño) y pide "Generar el de esta semana" para recibir el correo.

## Risks / Trade-offs

- [Cron no corre con Render dormido] → generación bajo demanda al consultar la lista; el correo puede llegar cuando alguien abre la app y no el lunes a las 08:00; se documenta.
- [Semana con pocos datos en comercios nuevos] → el reporte igual se genera con ceros y lenguaje claro; no se inventan comparaciones sin semana anterior.
- [Oportunidad "comprar más barato" con precios viejos] → se muestra la fecha de vigencia de cada costo en el detalle; HU-12 refinará con puntuación.
- [Doble generación simultánea] → advisory lock por comercio y `upsert` único por semana.
- [Correos a casillas no verificadas en Resend] → `ENVIO_FALLIDO` visible en la web con el reporte igual disponible.

## Migration Plan

1. Migración `20260927_weekly_reports` (enum, tabla, columnas del comercio, RLS, privilegios) con `prisma migrate deploy` en Neon dev y en producción por Render. 2. Deploy de API y web (aditivo). 3. Franco genera el reporte de la semana desde la web y verifica el correo. Rollback: revertir el commit; la migración es aditiva y puede quedar.
