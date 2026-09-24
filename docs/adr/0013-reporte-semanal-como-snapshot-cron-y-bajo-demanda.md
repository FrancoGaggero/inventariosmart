# ADR 0013 · Reporte semanal como snapshot, generado por cron y bajo demanda, con oportunidades de ahorro por reglas

**Estado:** aceptada · 27/09/2026

## Contexto

HU-09 (RF-09) pide un reporte semanal de rentabilidad enviado automáticamente, con productos estrella y oportunidades de ahorro, consultable después. Ya existen los cálculos de RN-01/RN-02 (`ProfitabilityService`, `ExpensesService`), las alertas persistidas (ADR 0010), el correo intercambiable (`Mailer`) y el patrón de job por comercio (`AlertsCron`). Render Free duerme la instancia y Resend sin dominio verificado sólo entrega a la casilla del dueño de la cuenta.

## Decisión

1. **Semana ISO en Buenos Aires**: `AAAA-Www`, de lunes 00:00 a domingo 23:59:59 con desfase fijo −03:00 (Argentina no tiene horario de verano). Funciones puras en `packages/shared/src/reportes.ts` (`semanaDe`, `rangoSemana`, `ultimaSemanaCerrada`, `mesDeSemana`) con tests en límites de año y de mes.
2. **Snapshot persistido**: tabla `reporte_semanal` única por comercio y semana, con el contenido en JSONB tal como se envió (los costos y gastos cambian después y el correo debe coincidir con la web). Se valida con `ContenidoReporteSchema` al leer. `app_api` no borra reportes.
3. **Cálculos por rango reutilizados**: `ProfitabilityService` gana `resumenEntre(desde, hasta, mesGastos, modo)` y `topEntre(desde, hasta, n)`; los métodos por mes delegan en ellos. El margen neto semanal resta el gasto por unidad del mes en que termina la semana × unidades de la semana (RN-02), sin inventar un prorrateo nuevo.
4. **Oportunidades de ahorro por reglas explícitas** (funciones puras, tope de 5 por lista, total sobre todo lo detectado): comprar más barato (menor costo cargado por otro proveedor activo × unidades de 30 días, RN-08), capital inmovilizado (stock sin ventas en 30 días) y margen bajo (< 15 % del precio neto). Una sola consulta por producto activo alimenta las tres.
5. **Tres disparadores y envío después del commit**: cron los lunes 08:00 (`@nestjs/schedule`) para comercios PRO/PREMIUM con reportes activos; generación bajo demanda al listar si falta la última semana cerrada (cubre Render dormido), con advisory lock por comercio; y `POST /reports/weekly/generate` a pedido. El correo sale fuera de la transacción: `enviado_en` o `motivo_no_envio` (`SIN_PROVEEDOR`, `ENVIO_FALLIDO`, `SIN_DESTINATARIOS`). `Mailer.configurado` distingue el `LogMailer` de producción sin key (motivo) del de tests (simula un proveedor real).
6. **Ajustes mínimos en el comercio**: `reportes_activos` y `reportes_destinatarios` (hasta 5 correos extra); sin elección de día y hora.

## Alternativas consideradas

- **Recalcular el reporte al leer**: más simple, pero el correo enviado dejaría de coincidir con la web cuando cambian precios o gastos.
- **Prorrateo semanal propio de gastos** (total del mes × 7 / días): otro número distinto del de HU-03 y HU-04; se prefiere el gasto por unidad ya definido.
- **Puntuación de proveedores para el ahorro**: es HU-12; una regla de "menor costo cargado" es explicable y suficiente.
- **PDF adjunto / WhatsApp**: fuera de alcance; el correo enlaza al detalle en la web.

## Consecuencias

- Regenerar una semana reemplaza el contenido pero conserva `enviado_en`; el reenvío es explícito.
- Comercios nuevos reciben reportes con ceros y lenguaje claro; no se comparan semanas sin datos.
- La consulta de oportunidades suma un `LEFT JOIN LATERAL` por producto activo; con 5.000 productos entra en el mismo orden que el recálculo de alertas.
