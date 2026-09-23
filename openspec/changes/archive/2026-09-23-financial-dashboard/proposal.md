## Why

Todo lo construido hasta acá se consulta pantalla por pantalla: inventario, movimientos, gastos, rentabilidad. La Propuesta compromete un panel único con los números clave, actualizado solo y legible por alguien sin formación técnica (HU-04, RF-05). Es la pantalla que el dueño abre cada mañana y la que la cátedra va a mirar primero; también es la que la app mobile mostrará con menos indicadores (`mobile-mvp`).

Cubre **HU-04** (RF-05, RNF-04) en la **Fase 1 – MVP**, con RN-01/RN-02 a través del motor de rentabilidad ya existente. Es la octava capacidad del mapa de `openspec/CAPACIDADES.md`.

## What Changes

- **Un solo endpoint** `GET /api/v1/dashboard?periodo=YYYY-MM` que compone, en una respuesta, los indicadores del mes: stock (productos activos, unidades en stock, valorización al costo vigente, cuántos sin stock y cuántos bajos), ventas y márgenes del mes (unidades, ventas netas, margen bruto y neto con porcentaje o motivo, gastos) con comparación contra el mes anterior, productos más rentables del mes (top 5 por margen bruto generado) y alertas activas (productos sin stock y con stock bajo, y aviso de gastos faltantes). Sin tablas nuevas: compone `ProfitabilityService`, `ExpensesService` y consultas de agregación sobre `producto`.
- **Actualización automática**: la web vuelve a consultar el panel cada 60 segundos y al volver a la pestaña, y lo invalida al registrar movimientos, gastos o costos; sin botón de recarga.
- **Rendimiento**: el panel responde en menos de 3 segundos con 5.000 productos y 50.000 movimientos (RNF-04), probado con una carga sintética en e2e y sin sumar el histórico completo (el stock ya está almacenado por producto).
- **Web**: el inicio pasa a ser el dashboard para DUENIO y CONTADOR (tarjetas de stock, ventas del mes con la variación contra el mes anterior, margen bruto y neto, top 5 rentables, alertas con enlaces a Inventario y Gastos), con frases en lenguaje claro ("Este mes vendiste 145 unidades por $1.230.000 netos"); el EMPLEADO conserva su inicio operativo (Inventario y Movimientos), porque no accede al panel.
- **Contrato**: `packages/shared` con el esquema del dashboard; OpenAPI y cliente regenerados.

Supuestos registrados:
- **"Alertas activas"** en Fase 1 son las derivadas del stock (sin stock y stock bajo respecto del stock de seguridad) más el aviso de gastos faltantes; las alertas predictivas de reposición son HU-06 (Fase 2) y se sumarán al mismo bloque.
- **"Stock total"** se informa como unidades en stock y como valorización al costo de reposición vigente (neto), que es el número que le importa al dueño; ambos salen de `producto`.
- **"Productos más rentables"** = mayor margen bruto generado en el mes (margen unitario × unidades vendidas), sólo productos con ventas; si no hubo ventas, el panel lo dice y ofrece registrar movimientos.
- **Variación contra el mes anterior** en ventas netas y unidades; `null` si el mes anterior no tuvo ventas.
- **Actualización automática por sondeo** (60 s) y no por WebSocket: alcanza para "sin recarga manual" y no agrega infraestructura en Render Free.

## Capabilities

### New Capabilities

- `financial-dashboard`: panel del mes con stock, ventas y márgenes, comparación con el mes anterior, productos más rentables y alertas activas, en una sola respuesta rápida, para DUENIO y CONTADOR, actualizado sin recarga manual.

### Modified Capabilities

Ninguna. `profitability`, `operating-expenses`, `product-catalog` y `stock-movements` se consultan tal cual; los permisos siguen `user-roles` (CP-11.4: EMPLEADO 403 en el dashboard).

## Impact

- **Código:** `apps/api` nuevo módulo `dashboard` (importa `ProfitabilityModule` y `ExpensesModule`); `packages/shared` esquema; `packages/api-client` regenerado; `apps/web` inicio rediseñado como dashboard para DUENIO y CONTADOR, `refetchInterval` e invalidaciones.
- **Base de datos:** sin migración. Lecturas agregadas sobre `producto` y `movimiento` con los índices existentes.
- **Trazabilidad:** CU-04, casos de prueba CP-04.1 a CP-04.5, más aislamiento.
- **Fuera de alcance:** alertas predictivas (HU-06), órdenes de compra (HU-07), reportes por correo (HU-09), gráficos históricos de más de dos meses, exportación, personalización de tarjetas, pantalla mobile (`mobile-mvp`, mismo endpoint).
