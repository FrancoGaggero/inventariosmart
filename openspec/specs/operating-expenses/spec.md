# operating-expenses Specification

## Purpose
Gastos operativos del comercio, fijos y variables, con período y periodicidad, y su prorrateo sobre las unidades vendidas del período como insumo del margen neto (HU-13, RF-14, RN-02, RN-03).

## Requirements

### Requirement: ABM de gastos operativos
El sistema SHALL permitir al DUENIO crear, consultar, editar y eliminar gastos de su comercio con concepto, tipo (`FIJO` o `VARIABLE`), importe neto sin IVA mayor a cero, período (mes, `YYYY-MM`), periodicidad (`UNICO`, `MENSUAL`, `ANUAL`), fin opcional (mes) para los recurrentes y notas; cada campo inválido SHALL responder 400 `VALIDACION` con el detalle por campo (HU-13 criterios 1 y 2, RF-14).

#### Scenario: CP-13.1 Alta de un gasto fijo mensual
- **GIVEN** un DUENIO
- **WHEN** envía `POST /api/v1/expenses` con concepto "Alquiler", `tipo: "FIJO"`, `importe: "250000"`, `periodo: "2026-09"`, `periodicidad: "MENSUAL"`
- **THEN** la API responde 201 con el gasto (`importe: "250000.00"`, `fin: null`, usuario que lo cargó) y `GET /api/v1/expenses?periodo=2026-09` lo lista

#### Scenario: CP-13.1b Edición y eliminación
- **GIVEN** un gasto existente
- **WHEN** el DUENIO envía `PATCH /api/v1/expenses/:id` con `importe: "260000"` y luego `DELETE /api/v1/expenses/:id`
- **THEN** la primera responde 200 con el importe nuevo y la segunda 204; después `GET /api/v1/expenses/:id` responde 404 y el gasto ya no figura en el listado del mes

#### Scenario: CP-13.1c Datos inválidos
- **GIVEN** un DUENIO
- **WHEN** envía concepto vacío, importe 0 o negativo, tipo "OTRO", período "septiembre", periodicidad "SEMANAL" o un fin anterior al período
- **THEN** la API responde 400 `VALIDACION` con `details` que nombra cada campo inválido y no crea nada

### Requirement: Gastos aplicables a un mes
El sistema SHALL listar, para un mes dado, los gastos que le aplican con el importe correspondiente a ese mes: los `UNICO` de ese mes por su importe completo, los `MENSUAL` cuyo período es anterior o igual al mes y cuyo fin es nulo o posterior o igual, por su importe completo, y los `ANUAL` cuyo período es anterior o igual al mes, dentro de sus doce meses y de su fin, por un doceavo de su importe; y SHALL devolver los totales de fijos, variables y general del mes (HU-13 criterio 2).

#### Scenario: CP-13.2 Listado del mes con recurrentes y totales
- **GIVEN** un comercio con "Alquiler" FIJO 250000 MENSUAL desde 2026-08, "Seguro" FIJO 120000 ANUAL desde 2026-09, "Comisiones" VARIABLE 30000 UNICO en 2026-09 y "Flete" VARIABLE 8000 UNICO en 2026-08
- **WHEN** el DUENIO consulta `GET /api/v1/expenses?periodo=2026-09`
- **THEN** obtiene Alquiler con `importeMes: "250000.00"`, Seguro con `importeMes: "10000.00"`, Comisiones con `importeMes: "30000.00"`, no obtiene Flete, y los totales son `fijos: "260000.00"`, `variables: "30000.00"`, `total: "290000.00"`

#### Scenario: CP-13.2b Recurrente con fin
- **GIVEN** un gasto MENSUAL con período 2026-06 y fin 2026-08
- **WHEN** se consultan los meses 2026-07, 2026-08 y 2026-09
- **THEN** figura en los dos primeros y no en el tercero

#### Scenario: CP-13.2c Filtro por tipo y período inválido
- **GIVEN** el comercio del escenario CP-13.2
- **WHEN** consulta `?periodo=2026-09&tipo=VARIABLE`, y luego `?periodo=2026-13`
- **THEN** la primera devuelve sólo Comisiones y la segunda responde 400 `VALIDACION` con `details.periodo`

### Requirement: Prorrateo del período
El sistema SHALL calcular para un mes el total de gastos aplicables, las unidades vendidas del mes (suma de cantidades de las ventas con fecha en el mes cuyo original no fue anulado) y el gasto por unidad (total dividido unidades, redondeado a dos decimales); cuando no hay gastos aplicables el gasto por unidad SHALL ser `null` con `motivo: "SIN_GASTOS"`, y cuando hay gastos pero ninguna unidad vendida SHALL ser `null` con `motivo: "SIN_VENTAS"` (RN-02, HU-13 criterios 3 y 5).

#### Scenario: CP-13.3 Gasto por unidad vendida
- **GIVEN** el comercio del escenario CP-13.2 con 145 unidades vendidas en septiembre de 2026 y una venta más de 5 unidades anulada
- **WHEN** el DUENIO consulta `GET /api/v1/expenses/summary?periodo=2026-09`
- **THEN** la respuesta es `{ periodo: "2026-09", totalFijos: "260000.00", totalVariables: "30000.00", total: "290000.00", unidadesVendidas: 145, gastoPorUnidad: "2000.00", motivo: null }`

#### Scenario: CP-13.5 Sin gastos, el prorrateo no es calculable
- **GIVEN** un comercio sin gastos en el mes consultado pero con ventas
- **WHEN** consulta el resumen de ese mes
- **THEN** la respuesta tiene `total: "0.00"`, `unidadesVendidas` mayor a 0, `gastoPorUnidad: null` y `motivo: "SIN_GASTOS"`; no devuelve 0 como si el gasto por unidad fuera nulo

#### Scenario: CP-13.5b Con gastos pero sin ventas
- **GIVEN** un comercio con gastos en el mes y ninguna venta
- **WHEN** consulta el resumen
- **THEN** `gastoPorUnidad: null` con `motivo: "SIN_VENTAS"`

### Requirement: Permisos sobre gastos
El sistema SHALL permitir al DUENIO todas las operaciones sobre gastos, al CONTADOR sólo la consulta (listado, detalle y resumen), y SHALL responder 403 `SIN_PERMISO` al EMPLEADO en todas ellas (Propuesta §2.4, CP-11.4).

#### Scenario: CP-13.4 Contador consulta, empleado no accede
- **GIVEN** un usuario CONTADOR y uno EMPLEADO
- **WHEN** el CONTADOR consulta el listado y el resumen y luego intenta crear un gasto, y el EMPLEADO consulta el listado
- **THEN** las consultas del CONTADOR responden 200, su alta 403 `SIN_PERMISO`, y la consulta del EMPLEADO 403 `SIN_PERMISO`

### Requirement: Aislamiento de gastos entre comercios
El sistema SHALL garantizar que los gastos de un comercio sean invisibles e inalcanzables para otro, también a nivel de base de datos, y que el resumen sólo cuente ventas del propio comercio (RNF-10).

#### Scenario: CP-13.6 Acceso cruzado
- **GIVEN** un gasto del comercio B
- **WHEN** un DUENIO del comercio A lo consulta, edita o elimina por id
- **THEN** la API responde 404 `NO_ENCONTRADO` y el gasto de B no cambia; el listado y el resumen de A no lo incluyen

#### Scenario: CP-13.6b La base bloquea sin contexto
- **GIVEN** una conexión con el rol de la aplicación sin `app.comercio_id`
- **WHEN** ejecuta `SELECT` sobre `gasto`
- **THEN** no obtiene filas
