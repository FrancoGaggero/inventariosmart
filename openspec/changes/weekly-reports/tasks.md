## 1. Contrato compartido

- [x] 1.1 `packages/shared/src/reportes.ts` (D1): semana ISO (`semanaDe`, `rangoSemana`, `semanaAnterior`, `ultimaSemanaCerrada`), constantes, funciones puras de oportunidades y esquemas de contenido, reporte, listado, query, generación y ajustes; exportado en `index.ts` y `dist` reconstruido. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con semanas en límite de año (2025-12-29 → `2026-W01`) y de mes, rango en Buenos Aires, los números de CP-09.2 y CP-09.2b, tope de 5 por lista y ajustes inválidos (6 correos, repetido, mal formado)

## 2. API · base de datos y módulo reports

- [x] 2.1 Migración `20260927_weekly_reports` (D2): enum, `reporte_semanal` único por comercio y semana, columnas `comercio.reportes_activos` y `reportes_destinatarios`, RLS y privilegios (sin DELETE); `schema.prisma`, `TENANT_MODELS` y `test/helpers.ts` (limpieza). Listo cuando: `prisma migrate deploy` corre en Neon dev y `rls.e2e-spec.ts` cubre `reporte_semanal`
- [x] 2.2 `ProfitabilityService.resumenEntre` y `topEntre` por rango de fechas, con `resumen` y `topDelMes` delegando (D3). Listo cuando: `profitability.e2e-spec.ts` y `dashboard.e2e-spec.ts` siguen en verde
- [x] 2.3 `ReportsService.generar` (D3): números de la semana, semana anterior, estrellas, oportunidades, alertas críticas, `upsert` conservando `enviadoEn`, advisory lock. Listo cuando: CP-09.1, CP-09.1b, CP-09.1c, CP-09.2, CP-09.2b y CP-09.2c pasan
- [x] 2.4 Envío (D4, D5): `plantillas/semanal.ts` con test unitario, `Mailer.configurado`, `enviar` tras el commit con destinatarios y motivos; `ReportsCron` de los lunes con test unitario; generación bajo demanda al listar. Listo cuando: CP-09.3, CP-09.3b, CP-09.3c, CP-09.3d y CP-09.3e pasan con `LogMailer` y `reports.cron.spec.ts` verifica PRO/PREMIUM activos
- [x] 2.5 `ReportsController` y DTOs Swagger (D6): listado por cursor, detalle, generar, ajustes; `@RequierePlan('PRO')`, roles, rutas fijas antes de `:id`; módulo registrado en `AppModule`. Listo cuando: CP-09.4, CP-09.5, CP-09.6, CP-09.6b y CP-09.6c pasan
- [x] 2.6 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene las rutas `/reports*` y CI no reporta contrato desactualizado

## 3. Web · reportes

- [ ] 3.1 `lib/reportes.ts` con hooks, invalidaciones y `formatearSemana` (D7). Listo cuando: generar desde la web actualiza el listado sin recargar
- [ ] 3.2 `ReportesPage` en `/reportes`: frase de cabecera, "Generar el de esta semana", tarjetas por semana con anillo de margen y estado de envío, estado vacío, aviso de plan en FREE. Listo cuando: CP-09.4 se ve en la web
- [ ] 3.3 `ReportePage` en `/reportes/:id`: Números, Semana anterior, Estrellas, Oportunidades, Alertas críticas, pie de envío y "Reenviar" (DUENIO). Listo cuando: CP-09.1, CP-09.2 y CP-09.3c se ven en la web
- [ ] 3.4 Enlace "Reportes" en `AppShell` (PRO) y bloque "Reporte semanal" en `ComercioPage` con `activo` y destinatarios extra. Listo cuando: CP-09.5 se ve en la web y el enlace no aparece en FREE

- [ ] 3.5 `ui/Confirmar` (diálogo accesible) y confirmación al cerrar sesión desde la barra y el menú lateral (pedido de Franco durante la implementación). Listo cuando: tocar "Cerrar sesión" abre el diálogo, Escape o "Seguir acá" lo cancelan sin cerrar la sesión, y "Cerrar sesión" la cierra

## 4. Documentación y cierre

- [x] 4.1 ADR 0013 (reporte como snapshot semanal, cron + bajo demanda, oportunidades por reglas), README (rutas de HU-09), `docs/arquitectura.html` (§6 `reports`), `docs/runbooks/rls.md`, `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D9
- [ ] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 4.3 Producción: migración aplicada por Render; Franco genera el reporte de la semana desde `/reportes`, recibe el correo en su casilla, revisa el detalle y prueba los ajustes. Listo cuando: CP-09.3, CP-09.4 y CP-09.5 se cumplen en `https://inventariosmart0.vercel.app/reportes`
- [ ] 4.4 (manual, Franco) Mover HU-09 a Hecho en Trello, `Backlog_InventarioSmart_v2.xlsx` y Gantt. Listo cuando: Trello, backlog y Gantt coinciden
