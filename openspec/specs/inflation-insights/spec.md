# inflation-insights Specification

## Purpose
Contexto inflacionario para el comercio (HU-15, RF-16, RNF-08): el sistema trae indicadores económicos oficiales de las APIs públicas del INDEC y del Banco Central, guarda el historial de precios de venta y muestra si los precios y costos propios le ganan o le pierden a la inflación, con variación real (RN-11), estado por producto y precios sugeridos.

## Requirements

### Requirement: Indicadores económicos oficiales
El sistema SHALL obtener de fuentes públicas oficiales el índice de precios al consumidor nacional (nivel general y bienes, mensual, fuente INDEC), la inflación mensual e interanual y el tipo de cambio minorista (fuente BCRA), SHALL guardarlos con su fecha y su fuente, y SHALL exponer los últimos valores en `GET /api/v1/indicators` para cualquier usuario autenticado de cualquier plan. Los datos SHALL actualizarse una vez por día y, además, al consultarlos si la última actualización tiene más de 24 horas. Si una fuente no responde o devuelve un error, el sistema SHALL responder con el último dato guardado indicando `desactualizado: true` y la fecha de la última actualización, sin fallar (RNF-08).

#### Scenario: CP-15.1 Indicadores vigentes
- **GIVEN** las fuentes oficiales con inflación mensual 1,7 (31/08/2026), interanual 33,5, tipo de cambio minorista 1545,12 (25/09/2026) e IPC general 12276,766 (08/2026)
- **WHEN** un usuario autenticado consulta `GET /api/v1/indicators`
- **THEN** obtiene `inflacionMensual: { valor: "1.70", fecha: "2026-08-31" }`, `inflacionInteranual: { valor: "33.50", … }`, `dolarMinorista: { valor: "1545.12", fecha: "2026-09-25" }`, `ipc: { valor: "12276.77", periodo: "2026-08" }`, las fuentes citadas ("INDEC", "BCRA"), `actualizadoEn` y `desactualizado: false`

#### Scenario: CP-15.1b Fuente caída
- **GIVEN** indicadores guardados ayer y una fuente que hoy responde con error o no responde en 10 segundos
- **WHEN** se consulta `GET /api/v1/indicators`
- **THEN** la respuesta es 200 con los valores guardados, `desactualizado: true` y `actualizadoEn` de ayer

#### Scenario: CP-15.1c Sin datos todavía
- **GIVEN** una instalación sin indicadores guardados y las fuentes caídas
- **WHEN** se consulta `GET /api/v1/indicators`
- **THEN** la respuesta es 200 con los indicadores en `null`, `desactualizado: true` y `actualizadoEn: null`

#### Scenario: CP-15.1d No se consulta la fuente en cada pedido
- **GIVEN** indicadores actualizados hace una hora
- **WHEN** se consulta `GET /api/v1/indicators` dos veces seguidas
- **THEN** ninguna de las dos consultas llama a las fuentes externas

### Requirement: Historial de precios de venta
El sistema SHALL registrar una fila de sólo inserción con el precio de venta, la alícuota de IVA, la fecha de vigencia, el origen (`ALTA`, `EDICION`, `IMPORT`, `INICIAL`) y el usuario cada vez que se crea un producto o cambia su precio de venta, por alta, edición o importación; un guardado que no cambia el precio SHALL no agregar filas. El historial SHALL consultarse en `GET /api/v1/products/:id/price-history` del más reciente al más antiguo, y las filas SHALL no poder modificarse ni borrarse.

#### Scenario: CP-15.2 Alta y edición dejan historial
- **GIVEN** un DUENIO que crea `FA-220` con precio 1000 y luego lo edita a 1100
- **WHEN** consulta `GET /api/v1/products/:id/price-history`
- **THEN** obtiene dos filas, `1100.00` con origen `EDICION` y `1000.00` con origen `ALTA`, cada una con `vigenteDesde` y usuario

#### Scenario: CP-15.2b Sin cambio de precio no hay fila nueva
- **GIVEN** el producto anterior
- **WHEN** el DUENIO edita sólo el nombre, o guarda el mismo precio 1100
- **THEN** el historial sigue teniendo dos filas

#### Scenario: CP-15.2c La importación también registra
- **GIVEN** una planilla que actualiza el precio de `FA-220` a 1200 y crea `AM-1L` a 500
- **WHEN** el DUENIO confirma la importación
- **THEN** `FA-220` suma una fila `1200.00` con origen `IMPORT` y `AM-1L` tiene una fila `500.00` con origen `IMPORT`

#### Scenario: CP-15.2d Historial inmutable
- **WHEN** una conexión con el rol de la aplicación ejecuta `UPDATE` o `DELETE` sobre el historial de precios
- **THEN** la base rechaza la operación por falta de privilegios

### Requirement: Comparación de precios y costos propios contra la inflación
El sistema SHALL calcular, para un período de meses completos (`desde` y `hasta` en formato `AAAA-MM`, por defecto los últimos 6 meses hasta el último mes con IPC publicado), series mensuales en índice base 100 al primer mes de: mis precios y mis costos, como canasta fija de los productos activos con ventas en el período ponderada por las unidades vendidas en todo el período y valuada con el precio o costo vigente al cierre de cada mes; e IPC general e IPC de bienes. SHALL informar la variación porcentual de cada serie entre el primer y el último mes y las brechas en términos reales entre precios e IPC y entre precios y costos según RN-11: variación real = ((1 + variación nominal) ÷ (1 + variación de referencia) − 1) × 100. Si el período pedido excede el último mes con IPC publicado, SHALL recortarse a ese mes e informarlo (HU-15, RN-01, RN-08, RN-11).

#### Scenario: CP-15.3 Índices y brechas
- **GIVEN** un comercio PRO con `A` (precio 1000 en enero y 1100 en junio, costo 600 y 720, 30 unidades vendidas en el período) y `B` (precio 2000 y 2600, costo 1200 y 1500, 10 unidades), y un IPC que pasa de 100 a 120 entre enero y junio
- **WHEN** el DUENIO consulta `GET /api/v1/insights/inflation?desde=2026-01&hasta=2026-06`
- **THEN** la serie `misPrecios` termina en `118.00`, `misCostos` en `122.00` e `ipc` en `120.00`; `variaciones` es `{ misPrecios: "18.00", misCostos: "22.00", ipc: "20.00" }`; `brechas.preciosVsIpc` es `"-1.67"` y `brechas.preciosVsCostos` es `"-3.28"`

#### Scenario: CP-15.3b Período recortado al último IPC publicado
- **GIVEN** el último IPC publicado es de agosto de 2026
- **WHEN** el DUENIO consulta `?desde=2026-04&hasta=2026-09`
- **THEN** la respuesta cubre de abril a agosto, con `hasta: "2026-08"` y `recortado: true`

#### Scenario: CP-15.3c Sin ventas en el período
- **GIVEN** un comercio PRO sin ventas entre `desde` y `hasta`
- **WHEN** consulta la comparación
- **THEN** `misPrecios` y `misCostos` vienen vacías con `motivo: "SIN_VENTAS"`, la serie del IPC viene completa y la respuesta es 200

#### Scenario: CP-15.3d Período inválido
- **WHEN** el DUENIO consulta con `desde` posterior a `hasta`, con más de 24 meses o con un formato distinto de `AAAA-MM`
- **THEN** la API responde 400 `VALIDACION` con `details` por campo

### Requirement: Estado y precio sugerido por producto
El sistema SHALL informar por cada producto activo, para el mismo período: precio inicial y final, costo inicial y final, variación de precio y de costo, variación real del precio contra el IPC general (RN-11), el estado `ATRASADO` si la variación real es menor a −2 %, `ADELANTADO` si es mayor a +2 % y `ALINEADO` en otro caso, el precio sugerido para alcanzar la inflación (precio inicial × (1 + variación del IPC)) y el precio sugerido para sostener el margen bruto porcentual del inicio del período con el costo final (RN-01). Los productos SHALL venir ordenados del más atrasado al más adelantado, y los precios sugeridos SHALL ser informativos: consultar no cambia ningún precio.

#### Scenario: CP-15.4 Atrasado, adelantado y sugeridos
- **GIVEN** los productos de CP-15.3
- **WHEN** el DUENIO consulta la comparación
- **THEN** `A` viene primero con `variacionPrecio: "10.00"`, `variacionReal: "-8.33"`, `estado: "ATRASADO"`, `precioSugeridoInflacion: "1200.00"` y `precioSugeridoMargen: "1200.00"`; `B` viene con `variacionPrecio: "30.00"`, `variacionReal: "8.33"`, `estado: "ADELANTADO"`, `precioSugeridoInflacion: "2400.00"` y `precioSugeridoMargen: "2500.00"`; los precios de los productos no cambian

#### Scenario: CP-15.4b Alineado y producto sin historial de costos
- **GIVEN** `C` con precio 1000 que pasó a 1210 (IPC 20 %) y sin historial de costos de su proveedor
- **WHEN** se consulta la comparación
- **THEN** `C` tiene `variacionReal: "0.83"`, `estado: "ALINEADO"`, `variacionCosto: "0.00"` y `precioSugeridoMargen` igual a su precio inicial

### Requirement: Plan, permisos y aislamiento de la comparación
La comparación y el historial de precios SHALL requerir plan PRO o superior: en plan FREE `GET /api/v1/insights/inflation` responde 402 `PLAN_REQUERIDO`, mientras `GET /api/v1/indicators` sigue disponible. El DUENIO y el CONTADOR SHALL consultar la comparación; el EMPLEADO SHALL recibir 403 `SIN_PERMISO` en la comparación y en el historial de precios (no ve costos ni márgenes). Un comercio SHALL ver únicamente sus precios, costos y productos (RNF-10).

#### Scenario: CP-15.5 Plan FREE
- **GIVEN** un comercio en plan FREE
- **WHEN** el DUENIO consulta `GET /api/v1/insights/inflation` y `GET /api/v1/indicators`
- **THEN** la primera responde 402 `PLAN_REQUERIDO` y la segunda 200

#### Scenario: CP-15.5b Roles
- **GIVEN** un comercio PRO
- **WHEN** el CONTADOR y el EMPLEADO consultan la comparación y los indicadores
- **THEN** el CONTADOR obtiene 200 en ambas; el EMPLEADO obtiene 403 `SIN_PERMISO` en la comparación y 200 en los indicadores

#### Scenario: CP-15.5c Aislamiento
- **GIVEN** dos comercios PRO con productos y ventas
- **WHEN** el dueño de uno consulta la comparación o el historial de precios de un producto del otro
- **THEN** la comparación sólo incluye sus productos y el historial ajeno responde 404 `NO_ENCONTRADO`

### Requirement: Visualización en la web
La web SHALL mostrar en la página "Precios e inflación" un gráfico de líneas con las series de mis precios, mis costos e IPC en índice base 100, con leyenda, valor al pasar el cursor y una tabla alternativa con los mismos datos; las variaciones y brechas en lenguaje claro; la tabla de productos con estado y precios sugeridos; y un selector de período de 3, 6 y 12 meses. Inicio SHALL mostrar una tarjeta "Contexto" con la inflación del mes e interanual, el dólar minorista y el stock valorizado en dólares, citando la fuente y la fecha de cada dato, y avisando cuando está desactualizado.

#### Scenario: CP-15.6 Gráfico y lenguaje claro
- **GIVEN** la comparación de CP-15.3
- **WHEN** el DUENIO abre `/inflacion`
- **THEN** ve las tres líneas con su leyenda, la frase "Tus precios subieron 18 % y la inflación 20 %: en términos reales bajaron 1,7 %", la tabla con `A` marcado como atrasado y su precio sugerido, y puede cambiar el período

#### Scenario: CP-15.6b Contexto en Inicio
- **GIVEN** indicadores vigentes y un stock valorizado de 2.362.100 pesos con el dólar a 1545,12
- **WHEN** el DUENIO abre Inicio
- **THEN** la tarjeta "Contexto" muestra la inflación mensual e interanual, el dólar, "Stock en dólares: US$ 1.528,75" y las fuentes con su fecha
