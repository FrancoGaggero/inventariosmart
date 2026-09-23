# profitability Specification

## Purpose
Motor de rentabilidad: margen bruto y neto por producto y consolidado del mes, calculados sobre importes netos de IVA a partir del precio, la alícuota, el costo vigente, las ventas y los gastos prorrateados (HU-03, RF-04, RN-01, RN-02, RN-03).

## Requirements

### Requirement: Margen bruto por producto
El sistema SHALL calcular para cada producto activo el precio de venta neto (precio con IVA dividido por uno más la alícuota del producto), el margen bruto en pesos (precio neto menos costo de reposición) y en porcentaje (margen sobre precio neto, con dos decimales), y SHALL devolverlos sin almacenarlos, de modo que cualquier cambio de precio, alícuota o costo se refleje en la siguiente consulta (RN-01, RN-03, HU-03 criterios 1, 3 y 4).

#### Scenario: CP-03.1 Margen bruto en pesos y porcentaje
- **GIVEN** un producto con `precioVenta` 12100 (con IVA), `alicuotaIva` 21 y `costoReposicion` 6000
- **WHEN** el DUENIO consulta `GET /api/v1/profitability/products`
- **THEN** el producto figura con `precioNeto: "10000.00"`, `margenBruto: "4000.00"` y `margenBrutoPct: "40.00"`

#### Scenario: CP-03.3 Alícuota configurable por producto
- **GIVEN** el mismo comercio con otro producto de `precioVenta` 1105, `alicuotaIva` 10.5 y costo 800
- **WHEN** consulta la rentabilidad
- **THEN** ese producto figura con `precioNeto: "1000.00"`, `margenBruto: "200.00"` y `margenBrutoPct: "20.00"`

#### Scenario: CP-03.4 Recalculado al cambiar precio o costo
- **GIVEN** el producto del escenario CP-03.1
- **WHEN** el DUENIO cambia el precio a 14520 y luego un proveedor principal informa un costo de 7000
- **THEN** la siguiente consulta muestra `precioNeto: "12000.00"`, `margenBruto: "5000.00"` y `margenBrutoPct: "41.67"`

#### Scenario: CP-03.1b Margen negativo y precio cero
- **GIVEN** un producto con precio neto menor al costo y otro con precio 0
- **WHEN** consulta la rentabilidad
- **THEN** el primero muestra margen bruto negativo con porcentaje negativo, y el segundo `margenBruto` igual a menos su costo y `margenBrutoPct: null`

### Requirement: Margen neto por producto
El sistema SHALL calcular el margen neto unitario de cada producto como margen bruto menos el gasto operativo por unidad vendida del mes consultado (definido en `operating-expenses`), en pesos y porcentaje sobre el precio neto; cuando el gasto por unidad no es calculable el margen neto SHALL ser `null` con el mismo motivo (`SIN_GASTOS` o `SIN_VENTAS`), nunca igual al bruto (RN-02, HU-03 criterio 2, HU-13 criterio 5).

#### Scenario: CP-03.2 Margen neto con gastos cargados
- **GIVEN** un mes con gastos por 290000 y 145 unidades vendidas (gasto por unidad 2000) y el producto del escenario CP-03.1
- **WHEN** consulta `GET /api/v1/profitability/products?periodo=<ese mes>`
- **THEN** el producto figura con `gastoPorUnidad: "2000.00"`, `margenNeto: "2000.00"`, `margenNetoPct: "20.00"` y `motivoNeto: null`

#### Scenario: CP-03.2b Sin gastos el neto no es calculable
- **GIVEN** un mes sin gastos cargados
- **WHEN** consulta la rentabilidad de ese mes
- **THEN** cada producto muestra su margen bruto, `margenNeto: null`, `margenNetoPct: null` y `motivoNeto: "SIN_GASTOS"`

#### Scenario: CP-03.2c Con gastos pero sin ventas
- **GIVEN** un mes con gastos y sin ventas
- **WHEN** consulta la rentabilidad de ese mes
- **THEN** `margenNeto: null` con `motivoNeto: "SIN_VENTAS"`

### Requirement: Consolidado del mes
El sistema SHALL calcular para un mes las ventas netas (suma de cantidad por precio unitario neto de cada venta no anulada), el costo de lo vendido (cantidad por costo de reposición vigente), el margen bruto total en pesos y en porcentaje sobre ventas netas, los gastos del mes y el margen neto total (bruto menos gastos) en pesos y porcentaje, con `null` y motivo cuando no es calculable; y SHALL incluir en el listado por producto las unidades vendidas y el margen bruto del mes de cada uno (HU-03 criterio 5).

#### Scenario: CP-03.5 Consolidado con ventas y gastos
- **GIVEN** un mes con 10 ventas del producto de CP-03.1 a 12100 (con IVA) y 5 ventas del producto de CP-03.3 a 1105, con gastos por 30000
- **WHEN** el DUENIO consulta `GET /api/v1/profitability/summary?periodo=<ese mes>`
- **THEN** obtiene `ventasNetas: "105000.00"`, `costoVendido: "64000.00"`, `margenBruto: "41000.00"`, `margenBrutoPct: "39.05"`, `gastos: "30000.00"`, `margenNeto: "11000.00"`, `margenNetoPct: "10.48"`, `unidadesVendidas: 15` y `motivo: null`; y en el listado por producto el primero muestra `unidadesVendidas: 10` y `margenBrutoMes: "40000.00"`

#### Scenario: CP-03.5b Consolidado sin ventas
- **GIVEN** un mes sin ventas
- **WHEN** consulta el consolidado
- **THEN** `ventasNetas: "0.00"`, `margenBruto: "0.00"`, `margenBrutoPct: null`, `margenNeto: null` y `motivo` igual a `SIN_GASTOS` si tampoco hay gastos o `SIN_VENTAS` si los hay

#### Scenario: CP-03.5c Las ventas anuladas no cuentan
- **GIVEN** el mes de CP-03.5 con una venta más de 3 unidades anulada
- **WHEN** consulta el consolidado
- **THEN** los importes y las unidades son los mismos de CP-03.5

### Requirement: Consulta del listado de rentabilidad
El sistema SHALL listar la rentabilidad de los productos activos en orden alfabético con búsqueda por código o nombre y paginación por cursor, para el mes indicado o el mes actual por defecto, y SHALL rechazar un mes mal formado con 400 `VALIDACION`.

#### Scenario: CP-03.6 Búsqueda y paginación
- **GIVEN** un comercio con 5 productos activos y uno dado de baja
- **WHEN** consulta `?limit=2` y sigue con `siguienteCursor`, y luego `?q=<código de uno>`
- **THEN** recorre los 5 activos sin repetir ni omitir, no incluye el dado de baja, y la búsqueda devuelve sólo el buscado; `?periodo=2026-13` responde 400

### Requirement: Permisos y aislamiento de la rentabilidad
El sistema SHALL permitir consultar la rentabilidad a DUENIO y CONTADOR, SHALL responder 403 `SIN_PERMISO` al EMPLEADO (el margen es información sensible, Propuesta §2.4) y SHALL calcular sólo con productos, ventas y gastos del propio comercio (RNF-10).

#### Scenario: CP-03.7 Roles
- **GIVEN** usuarios DUENIO, CONTADOR y EMPLEADO del mismo comercio
- **WHEN** cada uno consulta el listado y el consolidado
- **THEN** DUENIO y CONTADOR reciben 200 y EMPLEADO 403 en ambos

#### Scenario: CP-03.7b Aislamiento
- **GIVEN** dos comercios con productos, ventas y gastos propios
- **WHEN** el DUENIO de A consulta listado y consolidado
- **THEN** no aparece ningún producto de B y los totales sólo reflejan las ventas y gastos de A
