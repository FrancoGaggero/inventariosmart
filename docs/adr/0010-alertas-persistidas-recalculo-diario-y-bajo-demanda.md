# ADR 0010 · Alertas de reposición persistidas, con recálculo diario y bajo demanda

**Estado:** aceptada · 25/09/2026

## Contexto

HU-06 (RF-06) pide alertas predictivas de reposición según RN-04: velocidad de venta de los últimos 30 días × lead time del proveedor principal + stock de seguridad, con aviso antes de llegar a cero, notificación en la app y por correo, y un umbral configurable por producto. A diferencia de la rentabilidad (ADR 0008), una alerta tiene ciclo de vida propio (el dueño la atiende o la pospone) y una notificación que debe ocurrir una sola vez. La API corre en Render Free, que duerme la instancia sin tráfico, y el correo transaccional es Resend, que sin dominio verificado sólo entrega a la casilla del dueño de la cuenta.

## Decisión

1. **Las alertas se persisten** en la tabla `alerta` (una abierta por producto, índice único parcial) con las cifras del cálculo y su estado (`ACTIVA`, `POSPUESTA`, `ATENDIDA`, `RESUELTA`); `app_api` no puede borrarlas: el historial se cierra con `RESUELTA`. RN-04 vive como funciones puras en `packages/shared/src/alertas.ts` (`evaluarReposicion`), con tests unitarios, y el umbral suma los `dias_anticipacion_alerta` del producto al lead time.
2. **Recálculo en una pasada por comercio**: una consulta agrupa las ventas de la ventana, el último ingreso y la última atención por producto; las escrituras se hacen por lote (`createManyAndReturn`, `UPDATE … FROM unnest`). Un `pg_advisory_xact_lock` por comercio evita cálculos simultáneos.
3. **Tres disparadores**: cron diario a las 07:00 de Buenos Aires (`@nestjs/schedule`, sólo comercios PRO o superior), recálculo bajo demanda al leer alertas o el panel si el último cálculo tiene más de una hora, y `POST /alerts/recalculate` a pedido del dueño. El bajo demanda garantiza frescura aunque Render esté dormido a la hora del cron.
4. **Correo intercambiable**: `Mailer` con `ResendMailer` (cuando hay `RESEND_API_KEY` y no es test) y `LogMailer` (desarrollo, tests, o sin key). Se envía un resumen por recálculo con las alertas nuevas y cada una se marca `notificada_en` antes del envío; un fallo del proveedor queda en el log y no interrumpe el recálculo.
5. **Plan PRO** con `@RequierePlan('PRO')`; el panel devuelve `alertas.reposicion: null` en FREE. Hasta HU-14, el plan se cambia por SQL con la propietaria (runbook de deploy).

## Alternativas consideradas

- **Alertas derivadas en cada consulta, sin tabla:** no permiten atender ni posponer, ni notificar una sola vez.
- **Sólo cron:** con Render Free dormido el job no corre; el dueño podría abrir la app y ver datos de ayer.
- **Servicio externo de cron (cron-job.org, GitHub Actions):** suma configuración y un secreto más; el bajo demanda ya cubre el caso.
- **Cola de trabajos (BullMQ, Redis):** infraestructura que el plan gratuito no tiene y que cuatro pantallas no justifican.
- **`@nestjs/schedule` 12:** es sólo ESM y Jest lo rechaza en este proyecto CommonJS; se usa la línea 6.x, compatible con Nest 11.

## Consecuencias

- La primera lectura del día puede tardar el recálculo (segundos con miles de productos); las siguientes dentro de la hora no.
- Comercios con menos de 30 días de ventas tienen velocidades bajas y pocas alertas; la pantalla muestra la velocidad y la fecha del cálculo para que el número se entienda.
- El correo sólo llega a casillas verificadas en Resend hasta registrar un dominio; con `LogMailer` la alerta sigue visible en la app.
- Contra Neon desde Argentina el recálculo de 5.000 productos ronda los 3 s por la latencia de cada viaje; en CI (Postgres local) queda muy por debajo del presupuesto de RNF-04.
