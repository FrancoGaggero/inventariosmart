## MODIFIED Requirements

### Requirement: Indicadores del panel
El sistema SHALL devolver en `GET /api/v1/dashboard?periodo=YYYY-MM` (mes actual por defecto) los indicadores del mes en una sola respuesta: `stock` (productos activos, unidades en stock, valorización al costo vigente, sin stock, stock bajo), `ventas` (unidades vendidas, ventas netas, margen bruto y neto en pesos y porcentaje, gastos y motivo, con las mismas definiciones de `profitability`), `mesAnterior` (unidades y ventas netas del mes previo y variación porcentual de ventas, `null` si no hubo ventas), `topRentables` (hasta 5 productos con ventas ordenados por margen bruto generado en el mes), `alertas` (productos sin stock, productos con stock bajo, si faltan gastos del mes y `reposicion`: total de alertas de reposición activas y hasta 5 de ellas ordenadas por días de cobertura, o `null` si el plan del comercio no las incluye) (HU-04 criterio 1, HU-06 criterio 3) y `quiebres` (ganancia perdida, venta perdida y productos afectados por falta de stock en los últimos 30 días, con las definiciones de `stockout-losses` y RN-14, o `null` si el plan del comercio no las incluye) (HU-18) y `stockParado` (capital parado y productos parados con el criterio de 90 días, con las definiciones de `dead-stock` y RN-15, o `null` si el plan del comercio no lo incluye) (HU-19). Los bloques `quiebres` y `stockParado` SHALL calcularse siempre sobre sus períodos fijos (30 y 90 días hasta el momento de la consulta), sin importar el `periodo` pedido. Si el último recálculo de alertas del comercio tiene más de una hora, la consulta del panel SHALL recalcularlas antes de responder (ver `restock-alerts`).

#### Scenario: CP-04.1 Panel con datos del mes
- **GIVEN** un comercio con 3 productos activos (stock 10, 0 y 3 con seguridad 5; costos 100, 50 y 20), 12 unidades vendidas en el mes del primero a 121 con IVA 21 y gastos por 60 en el mes, y 4 unidades vendidas el mes anterior por 400 netos
- **WHEN** el DUENIO consulta `GET /api/v1/dashboard?periodo=<mes>`
- **THEN** obtiene `stock: { productosActivos: 3, unidades: 13, valorizacion: "1060.00", sinStock: 1, stockBajo: 1 }`, `ventas: { unidadesVendidas: 12, ventasNetas: "1200.00", margenBruto: "0.00", ... , gastos: "60.00", margenNeto: "-60.00", motivo: null }`, `mesAnterior: { unidadesVendidas: 4, ventasNetas: "400.00", variacionVentasPct: "200.00" }`, `topRentables` con el primer producto (`unidadesVendidas: 12`, `margenBrutoMes: "0.00"`) y `alertas: { sinStock: [...1 producto], stockBajo: [...1 producto], faltanGastos: false, reposicion: ... }`

#### Scenario: CP-04.1b Top rentables ordenado por margen generado
- **GIVEN** un mes con ventas de tres productos cuyos márgenes generados son 500, 900 y 100
- **WHEN** consulta el panel
- **THEN** `topRentables` los lista en orden 900, 500, 100 con código, nombre, unidades vendidas, margen bruto unitario, porcentaje y margen generado; un cuarto producto sin ventas no aparece

#### Scenario: CP-04.1c Sin ventas ni gastos
- **GIVEN** un mes sin ventas ni gastos
- **WHEN** consulta el panel
- **THEN** `ventas.unidadesVendidas: 0`, `ventas.margenNeto: null` con `motivo: "SIN_GASTOS"`, `topRentables: []`, `mesAnterior.variacionVentasPct: null` y `alertas.faltanGastos: true`

#### Scenario: CP-04.1d Mes inválido
- **GIVEN** un DUENIO
- **WHEN** consulta `?periodo=2026-13`
- **THEN** la API responde 400 `VALIDACION` con `details.periodo`

#### Scenario: CP-04.1e Alertas de reposición en el panel
- **GIVEN** un comercio PRO con dos productos en alerta de reposición (cobertura 3 y 9 días) y un comercio FREE
- **WHEN** cada DUENIO consulta el panel
- **THEN** el PRO obtiene `alertas.reposicion: { total: 2, items: [<cobertura 3>, <cobertura 9>] }` con producto, severidad, días de cobertura y cantidad sugerida; el FREE obtiene `alertas.reposicion: null`

#### Scenario: CP-18.7 Pérdidas por falta de stock en el panel
- **GIVEN** un comercio PRO cuya consulta de quiebres de los últimos 30 días informa una ganancia perdida de 4.000 en 1 producto, y un comercio FREE
- **WHEN** cada DUENIO consulta el panel, el PRO con `?periodo=` de un mes anterior
- **THEN** el PRO obtiene `quiebres: { gananciaPerdida: "4000.00", ventaPerdida: ..., productosAfectados: 1 }`, igual a los totales de `GET /api/v1/stockouts?dias=30`; el FREE obtiene `quiebres: null`; y en la web el panel del PRO muestra la tarjeta "Perdiste por falta de stock" con el monto y el enlace a la página

#### Scenario: CP-19.6 Stock parado en el panel
- **GIVEN** un comercio PRO cuya consulta de stock parado de 90 días informa un capital parado de 21.000 en 1 producto, y un comercio FREE
- **WHEN** cada DUENIO consulta el panel, el PRO con `?periodo=` de un mes anterior
- **THEN** el PRO obtiene `stockParado: { capitalParado: "21000.00", productos: 1 }`, igual a los totales de `GET /api/v1/dead-stock?dias=90`; el FREE obtiene `stockParado: null`; y en la web el panel del PRO muestra la tarjeta "Plata parada en stock" con el monto y el enlace a la página
