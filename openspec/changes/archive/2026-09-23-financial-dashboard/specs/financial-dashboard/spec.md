## Purpose

Panel financiero del comercio: en una sola respuesta, stock, ventas y márgenes del mes con comparación contra el mes anterior, productos más rentables y alertas activas, rápido y actualizado sin recarga manual, para DUENIO y CONTADOR (HU-04, RF-05, RNF-04).

## ADDED Requirements

### Requirement: Indicadores del panel
El sistema SHALL devolver en `GET /api/v1/dashboard?periodo=YYYY-MM` (mes actual por defecto) los indicadores del mes en una sola respuesta: `stock` (productos activos, unidades en stock, valorización al costo vigente, sin stock, stock bajo), `ventas` (unidades vendidas, ventas netas, margen bruto y neto en pesos y porcentaje, gastos y motivo, con las mismas definiciones de `profitability`), `mesAnterior` (unidades y ventas netas del mes previo y variación porcentual de ventas, `null` si no hubo ventas), `topRentables` (hasta 5 productos con ventas ordenados por margen bruto generado en el mes) y `alertas` (productos sin stock, productos con stock bajo y si faltan gastos del mes) (HU-04 criterio 1).

#### Scenario: CP-04.1 Panel con datos del mes
- **GIVEN** un comercio con 3 productos activos (stock 10, 0 y 3 con seguridad 5; costos 100, 50 y 20), 12 unidades vendidas en el mes del primero a 121 con IVA 21 y gastos por 60 en el mes, y 4 unidades vendidas el mes anterior por 400 netos
- **WHEN** el DUENIO consulta `GET /api/v1/dashboard?periodo=<mes>`
- **THEN** obtiene `stock: { productosActivos: 3, unidades: 13, valorizacion: "1060.00", sinStock: 1, stockBajo: 1 }`, `ventas: { unidadesVendidas: 12, ventasNetas: "1200.00", margenBruto: "0.00", ... , gastos: "60.00", margenNeto: "-60.00", motivo: null }`, `mesAnterior: { unidadesVendidas: 4, ventasNetas: "400.00", variacionVentasPct: "200.00" }`, `topRentables` con el primer producto (`unidadesVendidas: 12`, `margenBrutoMes: "0.00"`) y `alertas: { sinStock: [...1 producto], stockBajo: [...1 producto], faltanGastos: false }`

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

### Requirement: Actualización automática
El sistema SHALL calcular el panel en cada consulta sin cachés que retrasen los cambios, de modo que un movimiento, un gasto o un costo nuevo se refleje en la siguiente consulta; y la interfaz web SHALL volver a consultarlo al menos cada 60 segundos y al recuperar el foco, sin botón de recarga (HU-04 criterio 2, RF-05).

#### Scenario: CP-04.2 Una venta nueva se refleja de inmediato
- **GIVEN** el panel consultado con 12 unidades vendidas
- **WHEN** se registra una venta de 3 unidades y se vuelve a consultar
- **THEN** `ventas.unidadesVendidas` es 15 y `stock.unidades` bajó 3

### Requirement: Rendimiento del panel
El sistema SHALL responder el panel en menos de 3 segundos para un comercio con 5.000 productos y 50.000 movimientos, sin recorrer el histórico completo de stock (RNF-04, HU-04 criterio 3).

#### Scenario: CP-04.3 Carga sintética
- **GIVEN** un comercio con 5.000 productos activos y 50.000 movimientos de venta repartidos en el mes
- **WHEN** consulta el panel (tras una consulta de calentamiento)
- **THEN** responde 200 en menos de 3 segundos con `stock.productosActivos: 5000`

### Requirement: Lenguaje claro
El sistema SHALL acompañar los indicadores con motivos y etiquetas en español rioplatense sin jerga técnica (por ejemplo, `motivo` traducido como "No se puede calcular el margen neto: cargá los gastos del mes"), y la interfaz SHALL presentar frases completas con los números del mes y enlaces a la acción que corresponde (HU-04 criterio 4).

#### Scenario: CP-04.4 Panel sin gastos guía a la acción
- **GIVEN** un mes con ventas y sin gastos
- **WHEN** el DUENIO abre el inicio
- **THEN** ve una frase con las unidades y ventas netas del mes, el margen bruto, y un aviso "No se puede calcular el margen neto: cargá los gastos del mes" con un enlace a cargar gastos

### Requirement: Permisos y aislamiento del panel
El sistema SHALL permitir el panel a DUENIO y CONTADOR, SHALL responder 403 `SIN_PERMISO` al EMPLEADO (HU-04 criterio 5, Propuesta §2.4) y SHALL calcularlo sólo con datos del propio comercio (RNF-10).

#### Scenario: CP-04.5 Roles
- **GIVEN** usuarios DUENIO, CONTADOR y EMPLEADO
- **WHEN** cada uno consulta el panel
- **THEN** DUENIO y CONTADOR reciben 200 y EMPLEADO 403; en la web el EMPLEADO ve su inicio operativo sin el panel

#### Scenario: CP-04.5b Aislamiento
- **GIVEN** dos comercios con productos, ventas y gastos propios
- **WHEN** el DUENIO de A consulta el panel
- **THEN** ningún indicador incluye datos de B
