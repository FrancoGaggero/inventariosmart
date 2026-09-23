## Context

Ver proposal.md – Why. Lo que ya existe y esta change reutiliza: `Proveedor.leadTimeDias` (default 7, HU-02), `Producto.stockSeguridad` y `proveedorPrincipalId` (HU-01), movimientos inmutables con `anulado_por_id` para excluir ventas anuladas (HU-10, misma condición que usa `profitability`), `PlanGuard` con `@RequierePlan` (402 `PLAN_REQUERIDO`), el bloque `alertas` del panel (`DashboardService.alertas()`), `PrismaService.tenant` / `transaccionTenant` / `comoSistema`, la política RLS estándar por tabla y el runbook `docs/runbooks/rls.md`. El documento de arquitectura ya preveía el módulo `alerts` (`GET /alerts`, `PATCH /alerts/:id` atendida | pospuesta), la tabla `Alerta (producto, estado)`, Resend para correo y "RN-04 calculada en un job diario y bajo demanda en el dashboard".

Restricciones: Render Free duerme la instancia sin tráfico (un cron en proceso no corre dormido); el correo transaccional sin dominio verificado sólo llega a la casilla del dueño de la cuenta Resend; los e2e corren contra Postgres real y no pueden depender de un servicio externo.

## Goals / Non-Goals

**Goals:**
- Alertas correctas según RN-04, con ciclo de vida (activa, pospuesta, atendida, resuelta) y notificación única por alerta.
- Frescura garantizada aunque el cron no corra: nunca más de una hora de atraso cuando alguien mira.
- Todo verificable sin servicios externos (mailer doble en tests; RN-04 con tests unitarios puros).

**Non-Goals:**
- Sugerir órdenes de compra o elegir proveedor (HU-07), comparar precios (HU-12), WhatsApp o push, alertas en la app Android, verificación de dominio de correo, colas o workers externos.

## Decisions

### D1 · RN-04 como funciones puras en `packages/shared/src/alertas.ts`
`velocidadDiaria(unidades30d)` (3 decimales), `puntoReposicion(velocidad, leadTimeDias, stockSeguridad)` = ⌈velocidad × leadTime⌉ + seguridad, `umbralAlerta(velocidad, leadTimeDias, diasAnticipacion, stockSeguridad)` = ⌈velocidad × (leadTime + anticipación)⌉ + seguridad, `diasCobertura(stock, velocidad)` = ⌊stock ÷ velocidad⌋ (null con velocidad 0), `cantidadSugerida(velocidad, leadTimeDias, stock, stockSeguridad)` = max(0, ⌈velocidad × (leadTime + 30)⌉ + seguridad − stock) y `evaluarReposicion(entrada)` que devuelve `{ enAlerta, severidad, ...cifras }`. Constantes `LEAD_TIME_DEFAULT = 7`, `DIAS_ANTICIPACION_DEFAULT = 3`, `DIAS_POSPOSICION = 7`, `VENTANA_VELOCIDAD_DIAS = 30`, `MAX_EDAD_CALCULO_MS = 1 h`. Esquemas zod `AlertaSchema`, `AlertasQuerySchema`, `AlertaAccionSchema` (`ATENDER` | `POSPONER`), `ResumenAlertasSchema`, `ResultadoRecalculoSchema`. Alternativa descartada: calcular en SQL sin funciones compartidas, que dejaría RN-04 sin tests unitarios (RNF-07 pide RN-01 a RN-04 al 100 %).

### D2 · Alertas persistidas, no derivadas
A diferencia de rentabilidad (ADR 0008), la alerta tiene estado propio (atendida, pospuesta) y una notificación que debe ocurrir una sola vez, así que se persiste. Tabla `alerta`: `id`, `comercio_id`, `producto_id`, `estado` (`EstadoAlerta`: ACTIVA | POSPUESTA | ATENDIDA | RESUELTA), `severidad` (`SeveridadAlerta`: PROXIMA | CRITICA), `stock`, `velocidad_diaria` decimal(10,3), `dias_cobertura` int null, `punto_reposicion` int, `umbral` int, `lead_time_dias` int, `dias_anticipacion` int, `cantidad_sugerida` int, `generada_en`, `actualizada_en`, `pospuesta_hasta` null, `atendida_en` null, `resuelta_en` null, `notificada_en` null. Índice único parcial `(producto_id) WHERE estado IN ('ACTIVA','POSPUESTA')`; índice `(comercio_id, estado, dias_cobertura)`. RLS `alerta_tenant` / `alerta_sistema` como el resto; `app_api` con SELECT, INSERT, UPDATE y sin DELETE (el historial de alertas es evidencia, se cierra con `RESUELTA`). `producto.dias_anticipacion_alerta SMALLINT NOT NULL DEFAULT 3 CHECK (0..90)`; `comercio.alertas_calculadas_en TIMESTAMPTZ NULL`. `TENANT_MODELS` suma `Alerta`. Queda en **ADR 0010**.

### D3 · Recálculo en una pasada SQL por comercio
`AlertsService.recalcular()` corre dentro de `transaccionTenant`: (1) una consulta que, por producto activo, trae stock, seguridad, anticipación, lead time del proveedor principal (`COALESCE(pr.lead_time_dias, 7)`), unidades VENTA no anuladas de los últimos 30 días (`LEFT JOIN LATERAL` con `fecha >= now() - interval '30 days'`), la alerta abierta si existe, la última ATENDIDA y la fecha del último INGRESO; (2) `evaluarReposicion` en memoria por fila; (3) escrituras agrupadas: `createMany` de alertas nuevas (sin abierta, sin ATENDIDA posterior al último ingreso), `UPDATE ... FROM unnest(...)` para cifras y severidad de las abiertas, `RESUELTA` para las abiertas cuyo producto salió de alerta o quedó inactivo, `POSPUESTA` vencida vuelve a `ACTIVA`; (4) `comercio.alertas_calculadas_en = now()`; (5) devuelve `{ creadas, actualizadas, resueltas }` y las alertas nuevas para notificar. Mismo patrón de lote que `import` (HU-05); presupuesto RNF-04 (< 3 s con 5.000 productos y 50.000 movimientos) verificado en e2e como en HU-04.

### D4 · Tres disparadores
(a) **Cron diario** con `@nestjs/schedule` a las 07:00 America/Argentina/Buenos_Aires (`ScheduleModule.forRoot()`; `@Cron` con `timeZone`), que recorre `comoSistema` los comercios con plan PRO o PREMIUM y ejecuta el recálculo de cada uno con su contexto de tenant; se desactiva en tests (`NODE_ENV=test`). (b) **Bajo demanda** en `GET /alerts`, `GET /alerts/summary` y `GET /dashboard`: si `alertas_calculadas_en` es null o tiene más de `MAX_EDAD_CALCULO_MS`, recalcula antes de responder (con un `pg_try_advisory_xact_lock(hashtext(comercio_id))` para que dos pedidos simultáneos no calculen dos veces). (c) **A pedido**: `POST /alerts/recalculate` (DUENIO) siempre recalcula. Alternativa descartada: un servicio externo de cron que pegue a la API; suma configuración y el bajo demanda ya cubre la frescura.

### D5 · Notificación por correo con `MailerService` intercambiable
Interfaz `Mailer { enviar(correo): Promise<void> }`. Implementación `ResendMailer` (`resend` SDK, `RESEND_API_KEY`, `MAIL_FROM` default `InventarioSmart <onboarding@resend.dev>`) y `LogMailer` (sin API key y en tests: registra en el log y en memoria). Tras cada recálculo con alertas nuevas y sin `notificada_en`, se arma un resumen HTML simple (plantilla en `alerts/plantillas/resumen.ts`: nombre del comercio, lista producto · stock · días de cobertura · sugerido, enlace a `/alertas`) y se envía a los emails de los DUENIO activos; luego se marca `notificada_en`. Los fallos del proveedor se registran y no interrumpen el recálculo. El e2e usa `LogMailer` y verifica destinatarios y contenido (CP-06.3b).

### D6 · Endpoints y permisos
`AlertsController` con `@RequierePlan('PRO')` a nivel de clase; `GET /alerts` (`estado` ACTIVA por defecto | POSPUESTA | ATENDIDA | RESUELTA | TODAS, cursor por `(dias_cobertura NULLS LAST, id)`, `limit` 25), `GET /alerts/summary`, `POST /alerts/recalculate`, `PATCH /alerts/:id { accion: 'ATENDER' | 'POSPONER' }`; lectura para DUENIO y CONTADOR, escritura DUENIO; EMPLEADO 403. `summary` antes de `:id` (misma lección que HU-13). `DashboardService` consulta `alertas.reposicion` sólo si `planCumple(plan, 'PRO')`; si no, `null`. `products`: `diasAnticipacionAlerta` en `ProductoSchema`, `ProductoCreateSchema` (default 3) y `ProductoPatchSchema`; el `SensitiveFieldsInterceptor` no lo oculta (no es costo ni margen).

### D7 · Web
- `lib/alertas.ts`: `useAlertas(estado)`, `useResumenAlertas()` (refetch 60 s), `useRecalcular()`, `useAccionAlerta()`; invalidaciones desde movimientos (una venta o ingreso puede cambiar alertas) y desde el dashboard.
- `features/alertas/AlertasPage.tsx` en `/alertas` (`RequireRole(['DUENIO','CONTADOR'])`): frase de cabecera ("3 productos van a quedarse sin stock antes de que llegue la reposición"), filtros por estado, tabla con producto (enlace), stock, velocidad/día, días de cobertura con color por severidad, punto y umbral, proveedor y lead time, cantidad sugerida, `calculadasEn` y botón "Recalcular ahora"; por fila: "Atendida", "Posponer 7 días" (DUENIO) y "Registrar ingreso" (a `/movimientos/nuevo?productoId&tipo=INGRESO`). En plan FREE, `Aviso` "Disponible en el plan PRO" sin tabla.
- `AppShell`: enlace "Alertas" con contador de activas (DUENIO y CONTADOR, sólo PRO). `Dashboard`: bloque "Reposición" con total, hasta 5 productos y enlace a `/alertas`; en FREE, una línea "Alertas predictivas: plan PRO". `ProductoFormPage`: campo "Días de anticipación de la alerta" con ayuda en lenguaje claro. `MovimientoFormPage` acepta `?tipo=` para precargar el tipo.

### D8 · Tests
Unitarios en shared (RN-04 con los números de CP-06.1, redondeos, velocidad 0, anticipación 0). e2e `alerts.e2e-spec.ts`: CP-06.1 a CP-06.7 con ventas fechadas dentro y fuera de la ventana de 30 días, anulaciones, ingreso, plan FREE (comercio creado FREE) vs PRO (`UPDATE comercio SET plan` con la propietaria en el helper), roles, aislamiento, `LogMailer`, carga sintética < 3 s; `dashboard.e2e-spec.ts` suma CP-04.1e; `products.e2e-spec.ts` suma CP-01.4e; `rls.e2e-spec.ts` cubre `alerta` (sin DELETE, aislamiento). El cron se prueba unitariamente (recorre comercios PRO y llama al servicio) sin esperar la hora.

### D9 · Operación
Variables nuevas opcionales `RESEND_API_KEY` y `MAIL_FROM` en `env.ts`, `.env.example`, README y `docs/runbooks/deploy.md`. Para verificar en producción el comercio de Franco pasa a PRO con SQL desde el runbook (`UPDATE comercio SET plan = 'PRO' WHERE id = ...` con `neondb_owner`); HU-14 lo reemplazará por gestión de planes. Franco crea la cuenta de Resend y carga la API key en Render (tarea manual); hasta entonces producción usa `LogMailer` y las alertas se ven en la app.

## Risks / Trade-offs

- [Cron no corre con Render dormido] → recálculo bajo demanda en cada lectura vencida y botón manual; el correo diario puede llegar cuando alguien abre la app y no a las 07:00; se documenta.
- [Recálculos concurrentes] → advisory lock transaccional por comercio; el segundo pedido no recalcula.
- [Velocidad con pocos datos] → comercios nuevos (menos de 30 días de ventas) obtienen velocidades bajas y pocas alertas; se muestra `calculadasEn` y la velocidad para que el dueño entienda el número; refinar con estacionalidad es evolución.
- [Correo a casillas ajenas sin dominio verificado] → Resend rechaza; el envío se registra como fallido sin cortar el recálculo; README explica cómo verificar dominio.
- [Cambio de plan por SQL] → sólo en el runbook, con la propietaria; el `PlanGuard` toma el plan en cada request, sin reinicio.

## Migration Plan

1. `pnpm add @nestjs/schedule resend` en `apps/api`; migración `20260925_restock_alerts` (tabla, enums, columnas, RLS, privilegios) aplicada con `prisma migrate deploy` en Neon dev y en producción por Render. 2. Deploy de la API y la web (compatibles: el bloque `reposicion` es nuevo y el campo del producto tiene default). 3. `UPDATE comercio SET plan = 'PRO'` para el comercio de Franco. 4. Cargar `RESEND_API_KEY` y `MAIL_FROM` en Render cuando exista la cuenta. Rollback: revertir el commit; la migración es aditiva y puede quedar.

## Open Questions

- Si Resend no llega a tiempo, el criterio 3 se cumple con la notificación en la app y el `LogMailer` deja constancia del envío; no cambia specs ni tareas.
