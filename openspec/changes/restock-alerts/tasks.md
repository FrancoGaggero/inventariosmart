## 1. Contrato compartido

- [x] 1.1 `packages/shared/src/alertas.ts` (D1): constantes, `velocidadDiaria`, `puntoReposicion`, `umbralAlerta`, `diasCobertura`, `cantidadSugerida`, `evaluarReposicion`, esquemas `AlertaSchema`, `AlertasQuerySchema`, `AlertaAccionSchema`, `ResumenAlertasSchema`, `ResultadoRecalculoSchema`; `ProductoSchema`/`Create`/`Patch` con `diasAnticipacionAlerta` (0 a 90, default 3); exportado en `index.ts`. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con los números de CP-06.1 (velocidad 2, punto 14, umbral 20, cobertura 9, sugerido 56), velocidad 0 sin alerta y anticipación 0

## 2. API · base de datos y módulo alerts

- [x] 2.1 Migración `20260925_restock_alerts` (D2): enums `EstadoAlerta` y `SeveridadAlerta`, tabla `alerta` con `comercio_id`, índice único parcial por producto abierto, RLS `alerta_tenant`/`alerta_sistema`, privilegios de `app_api` (sin DELETE), `producto.dias_anticipacion_alerta` con CHECK, `comercio.alertas_calculadas_en`; `schema.prisma` y `TENANT_MODELS` actualizados. Listo cuando: `prisma migrate deploy` corre en Neon dev y `rls.e2e-spec.ts` cubre `alerta` (aislamiento y DELETE rechazado)
- [x] 2.2 `products`: `diasAnticipacionAlerta` en DTOs, `aProducto`, alta (default 3) y edición con validación. Listo cuando: CP-01.4e pasa en `products.e2e-spec.ts`
- [x] 2.3 `AlertsService.recalcular()` (D3): consulta única de ventas de 30 días, evaluación con shared, escrituras por lote (crear, actualizar, resolver, reactivar pospuestas vencidas, respetar ATENDIDA hasta el siguiente ingreso), `alertas_calculadas_en` y advisory lock. Listo cuando: CP-06.1, CP-06.1b, CP-06.1c, CP-06.1d, CP-06.2, CP-06.2b, CP-06.2c, CP-06.2d, CP-06.4, CP-06.5c pasan
- [x] 2.4 `AlertsService.listar/resumen/accionar` y `AlertsController` (D6): `GET /alerts` con cursor y filtro, `GET /alerts/summary`, `POST /alerts/recalculate`, `PATCH /alerts/:id`, recálculo bajo demanda cuando el último tiene más de una hora, `@RequierePlan('PRO')`, roles, DTOs Swagger. Listo cuando: CP-06.2e, CP-06.3, CP-06.5, CP-06.5b, CP-06.5d, CP-06.6, CP-06.6b, CP-06.6c pasan
- [x] 2.5 `Mailer` con `ResendMailer` y `LogMailer`, plantilla del resumen y notificación única por alerta (D5); `RESEND_API_KEY` y `MAIL_FROM` en `env.ts` y `.env.example`. Listo cuando: CP-06.3b y CP-06.3c pasan con `LogMailer` y un test unitario cubre la plantilla (producto, stock, cobertura, sugerido, enlace)
- [x] 2.6 Cron diario 07:00 Buenos Aires con `@nestjs/schedule` (D4) sobre comercios PRO/PREMIUM como sistema, desactivado en tests; `ScheduleModule` y `AlertsModule` registrados en `AppModule`. Listo cuando: un test unitario verifica que recorre sólo comercios PRO/PREMIUM y ejecuta el recálculo con el contexto de cada uno
- [x] 2.7 `DashboardService`: `alertas.reposicion` (total y 5 items, o `null` en FREE) y recálculo si está vencido. Listo cuando: CP-04.1e pasa en `dashboard.e2e-spec.ts`
- [ ] 2.8 Rendimiento: carga sintética de 5.000 productos y 50.000 movimientos y medición del recálculo. Listo cuando: CP-06.7 pasa (< 3 s) junto con las suites existentes
- [x] 2.9 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene las rutas `/alerts*`, el campo nuevo del producto y `alertas.reposicion`, y CI no reporta contrato desactualizado

## 3. Web · alertas

- [x] 3.1 `lib/alertas.ts` (`useAlertas`, `useResumenAlertas`, `useRecalcular`, `useAccionAlerta`) con invalidaciones desde movimientos y dashboard. Listo cuando: registrar un ingreso desde Movimientos actualiza el contador de Alertas sin recargar
- [x] 3.2 `AlertasPage` en `/alertas` (D7): frase de cabecera, filtros, tabla con cifras y severidad, acciones Atendida / Posponer / Registrar ingreso, "Recalcular ahora", `calculadasEn`, aviso de plan PRO en FREE; `RequireRole(['DUENIO','CONTADOR'])` y acciones sólo para DUENIO. Listo cuando: CP-06.3, CP-06.5, CP-06.5b y CP-06.6 se ven en la web
- [x] 3.3 `AppShell` con enlace "Alertas" y contador; `Dashboard` con bloque "Reposición" (o línea de plan PRO); `ProductoFormPage` con "Días de anticipación de la alerta"; `MovimientoFormPage` acepta `?tipo=`. Listo cuando: el panel muestra el bloque, el formulario guarda el campo (CP-01.4e desde la web) y "Registrar ingreso" abre el formulario con tipo Ingreso y el producto elegido

## 4. Documentación y cierre

- [x] 4.1 ADR 0010 (alertas persistidas, recálculo diario y bajo demanda, correo intercambiable), README (rutas de HU-06, variables de correo, cambio de plan), `docs/arquitectura.html` (§6 `alerts`, RN-04 construida), `docs/runbooks/deploy.md` (Resend) y `rls.md` (tabla `alerta`), `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D9
- [ ] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 4.3 Producción: migración aplicada por Render, comercio de Franco en plan PRO (SQL del runbook, con la propietaria); si Franco creó la cuenta de Resend, `RESEND_API_KEY` y `MAIL_FROM` cargadas en Render. Listo cuando: `GET /api/v1/alerts/summary` responde 200 con token de Franco
- [ ] 4.4 Verificar en producción: con las ventas reales del mes, la página Alertas muestra los productos próximos al quiebre con sus cifras, "Atendida" y "Posponer" funcionan, el panel muestra el bloque Reposición y, si hay correo configurado, llega el resumen. Listo cuando: CP-06.3 y CP-06.5 se cumplen en `https://inventariosmart0.vercel.app/alertas`
- [ ] 4.5 (manual, Franco) Crear la cuenta de Resend y la API key, y mover HU-06 a Hecho en Trello, `Backlog_InventarioSmart_v2.xlsx` y Gantt. Listo cuando: la key está en Render y Trello, backlog y Gantt coinciden
