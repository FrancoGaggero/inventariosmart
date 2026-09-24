## Purpose
Reporte semanal automático de rentabilidad (HU-09, RF-09): cada semana el sistema resume las ventas, los márgenes, los productos estrella y las oportunidades de ahorro del comercio, lo envía por correo sin intervención manual y lo deja consultable en la web. Disponible desde el plan PRO.

## ADDED Requirements

### Requirement: Contenido del reporte semanal
El sistema SHALL generar por comercio y semana ISO (lunes 00:00 a domingo 23:59:59 en Buenos Aires, identificada `AAAA-Www`) un reporte con: unidades vendidas, ventas netas, costo vendido, margen bruto y su porcentaje (RN-01), margen neto y su porcentaje usando el gasto operativo por unidad del mes en que termina la semana (RN-02; nulo con motivo si ese mes no tiene gastos o ventas), la variación porcentual de ventas netas contra la semana anterior, hasta 5 productos estrella ordenados por margen bruto generado en la semana, las oportunidades de ahorro y las alertas de reposición críticas abiertas al momento de generar. Las ventas SHALL ser los movimientos VENTA no anulados con fecha dentro de la semana; los costos, los vigentes (RN-08). El contenido SHALL quedar guardado tal como se generó (HU-09 criterios 1 y 2).

#### Scenario: CP-09.1 Números y estrellas de la semana
- **GIVEN** un comercio PRO con ventas en la semana `2026-W38` de `FA-220` (30 unidades, precio neto 3.223,14, costo 2.100) y `AM-1L` (10 unidades, precio neto 1.652,89, costo 900), un gasto de 100.000 en septiembre y sin más ventas en el mes
- **WHEN** el DUENIO genera el reporte de `2026-W38`
- **THEN** el reporte tiene `unidadesVendidas: 40`, `ventasNetas: "113223.14"` (suma de cantidad × precio neto de cada venta), `costoVendido: "72000.00"`, `margenBruto: "41223.14"`, `margenNeto` igual al bruto menos 40 × el gasto por unidad del mes (2.500), es decir `"-58776.86"`, y `estrellas` con `FA-220` primero (`margenBrutoSemana: "33694.20"`) y `AM-1L` segundo

#### Scenario: CP-09.1b Sin ventas en la semana
- **GIVEN** un comercio PRO sin ventas en una semana
- **WHEN** se genera el reporte
- **THEN** los importes son `"0.00"`, `margenBrutoPct` y `margenNeto` son nulos con motivo `SIN_VENTAS`, `estrellas` está vacío y el reporte igual se genera y se envía

#### Scenario: CP-09.1c Variación contra la semana anterior
- **GIVEN** ventas netas de 100.000 en `2026-W37` y 113.223,14 en `2026-W38`
- **WHEN** se genera el reporte de `2026-W38`
- **THEN** `semanaAnterior.variacionVentasPct` es `"13.22"`; sin ventas la semana anterior, es nula

### Requirement: Oportunidades de ahorro
El reporte SHALL incluir tres listas de hasta 5 productos cada una, con un monto estimado por producto y el total por lista: `comprarMasBarato`, productos activos cuyo costo vigente supera el menor costo cargado por otro proveedor activo (ahorro = diferencia × unidades vendidas en los últimos 30 días, sólo si es mayor a cero); `capitalInmovilizado`, productos activos con stock mayor a cero y sin ventas en los últimos 30 días (monto = stock × costo vigente); `margenBajo`, productos vendidos en la semana con margen bruto menor al 15 % del precio neto (monto = ventas netas de la semana del producto). Cada lista SHALL venir ordenada por monto descendente (HU-09 criterio 2, RN-01, RN-08).

#### Scenario: CP-09.2 Comprar más barato
- **GIVEN** `FA-220` con proveedor principal "Norte" a 2.340 y "Sur" a 2.000, y 30 unidades vendidas en los 30 días previos al cierre de la semana
- **WHEN** se genera el reporte
- **THEN** `comprarMasBarato` incluye `FA-220` con `proveedorActual: "Norte"`, `proveedorSugerido: "Sur"`, `costoActual: "2340.00"`, `costoSugerido: "2000.00"` y `ahorroEstimado: "10200.00"`

#### Scenario: CP-09.2b Capital inmovilizado y margen bajo
- **GIVEN** `ZZ-1` con stock 20, costo 500 y sin ventas en 30 días, y `LB-1` vendido en la semana con precio neto 1.000 y costo 900
- **WHEN** se genera el reporte
- **THEN** `capitalInmovilizado` incluye `ZZ-1` con `monto: "10000.00"` y `margenBajo` incluye `LB-1` con `margenBrutoPct: "10.00"`; un producto vendido con margen del 20 % no aparece

#### Scenario: CP-09.2c Sin oportunidades
- **GIVEN** un comercio cuyos productos compran al proveedor más barato, rotan y tienen buen margen
- **WHEN** se genera el reporte
- **THEN** las tres listas están vacías con total `"0.00"` y el reporte lo dice en lenguaje claro

### Requirement: Generación y envío automáticos
El sistema SHALL generar el reporte de la semana recién cerrada para cada comercio con plan PRO o superior y reportes activos, una vez por semana los lunes a las 08:00 de Buenos Aires, y SHALL enviarlo por correo a los usuarios DUENIO activos más los destinatarios extra configurados, una sola vez por reporte, guardando destinatarios y fecha de envío; sin proveedor de correo configurado o con envío rechazado, el reporte SHALL quedar generado con `motivoNoEnvio`. Además, al consultar los reportes, si falta el de la última semana cerrada el sistema SHALL generarlo y enviarlo en ese momento. El DUENIO SHALL poder pedir la generación de la semana en curso o de una semana dada; regenerar SHALL reemplazar el contenido sin volver a enviar el correo, salvo que se pida explícitamente (HU-09 criterios 1 y 3).

#### Scenario: CP-09.3 El reporte llega solo
- **GIVEN** un comercio PRO con un DUENIO activo, un destinatario extra `contadora@ejemplo.test` y ventas en la semana cerrada
- **WHEN** corre el job semanal (o el DUENIO consulta `GET /api/v1/reports/weekly` sin que exista el reporte de esa semana)
- **THEN** existe un reporte de esa semana con `enviadoEn` y `destinatarios` con los dos correos, y se envió un único correo con el asunto "Tu semana en {comercio}", los números, las estrellas, las oportunidades y un enlace al reporte

#### Scenario: CP-09.3b Una sola vez y sin duplicados
- **GIVEN** el reporte anterior ya enviado
- **WHEN** corre el job otra vez, o el DUENIO consulta la lista de nuevo, o pide regenerar esa semana
- **THEN** no se crea otro reporte para la misma semana, no se envía otro correo, y la regeneración actualiza el contenido conservando `enviadoEn`

#### Scenario: CP-09.3c Sin correo configurado o rechazado
- **GIVEN** la API sin proveedor de correo, o un proveedor que rechaza el envío
- **WHEN** se genera el reporte
- **THEN** el reporte queda guardado con `enviadoEn` nulo y `motivoNoEnvio` (`SIN_PROVEEDOR` o `ENVIO_FALLIDO`) y la consulta no falla

#### Scenario: CP-09.3d Reportes desactivados
- **GIVEN** un comercio PRO con `activo: false` en los ajustes
- **WHEN** corre el job semanal o el DUENIO consulta la lista
- **THEN** no se genera ni se envía nada automáticamente; `POST /api/v1/reports/weekly/generate` sigue funcionando a pedido

#### Scenario: CP-09.3e Generar a pedido con reenvío explícito
- **GIVEN** un DUENIO
- **WHEN** envía `POST /api/v1/reports/weekly/generate` con `{ semana: "2026-W38", enviar: true }`
- **THEN** la API responde 200 con el reporte regenerado y se envía el correo aunque ya se hubiera enviado; con `semana` inválida (`"2026-W60"`) responde 400 `VALIDACION`

### Requirement: Consulta del historial
El sistema SHALL listar los reportes del comercio de la semana más reciente a la más antigua, paginados por cursor, con semana, rango de fechas, ventas netas, margen bruto, cantidad de oportunidades y estado de envío; y SHALL exponer el detalle completo por id (HU-09 criterio 4).

#### Scenario: CP-09.4 Listado y detalle
- **GIVEN** un comercio con reportes de `2026-W36`, `2026-W37` y `2026-W38`
- **WHEN** el DUENIO consulta `GET /api/v1/reports/weekly` y luego `GET /api/v1/reports/weekly/:id` del más reciente
- **THEN** la lista viene `W38`, `W37`, `W36` con `desde`, `hasta`, `ventasNetas`, `margenBruto`, `oportunidades` (conteo) y `enviadoEn`; el detalle trae el contenido completo tal como se generó

### Requirement: Ajustes del reporte
El sistema SHALL permitir al DUENIO consultar y modificar los ajustes del reporte de su comercio: `activo` (booleano, verdadero por defecto) y `destinatariosExtra` (lista de hasta 5 correos válidos, sin repetidos); el CONTADOR SHALL poder consultarlos.

#### Scenario: CP-09.5 Ajustes
- **GIVEN** un DUENIO
- **WHEN** envía `PATCH /api/v1/reports/settings` con `{ destinatariosExtra: ["contadora@ejemplo.test"] }` y luego `{ activo: false }`
- **THEN** `GET /api/v1/reports/settings` devuelve ambos cambios; seis correos, un correo mal formado o uno repetido responden 400 `VALIDACION` con `details.destinatariosExtra`

### Requirement: Plan, permisos y aislamiento de los reportes
Los reportes SHALL requerir plan PRO o superior (RF-15): en plan FREE todas las rutas responden 402 `PLAN_REQUERIDO` y el job los omite. El DUENIO SHALL generar, consultar y ajustar; el CONTADOR SHALL sólo consultar reportes y ajustes; el EMPLEADO SHALL recibir 403 `SIN_PERMISO` (CP-11.4). Un comercio SHALL ver únicamente sus reportes (RNF-10).

#### Scenario: CP-09.6 Plan FREE
- **GIVEN** un comercio en plan FREE
- **WHEN** el DUENIO consulta `GET /api/v1/reports/weekly` o corre el job
- **THEN** la API responde 402 `PLAN_REQUERIDO` y el job no genera nada para ese comercio

#### Scenario: CP-09.6b Roles
- **GIVEN** un comercio PRO con un reporte
- **WHEN** el CONTADOR consulta el listado, el detalle y los ajustes, luego intenta generar o cambiar ajustes, y el EMPLEADO consulta el listado
- **THEN** el CONTADOR obtiene 200 en las consultas y 403 `SIN_PERMISO` en las escrituras; el EMPLEADO obtiene 403 `SIN_PERMISO`

#### Scenario: CP-09.6c Aislamiento
- **GIVEN** dos comercios PRO con reportes
- **WHEN** el dueño de uno lista sus reportes o consulta un reporte del otro por id
- **THEN** sólo ve los propios y el ajeno responde 404 `NO_ENCONTRADO`
