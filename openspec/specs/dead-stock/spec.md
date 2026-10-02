# dead-stock Specification

## Purpose
Muestra cuánta plata del comercio está parada en productos que no se venden (HU-19, RF-20): detecta los productos con stock y sin ventas en un período y valoriza ese stock al costo vigente (RN-15).

## Requirements

### Requirement: Detección de stock parado
El sistema SHALL considerar **parado** a un producto activo con stock mayor a 0 que no tuvo ventas no anuladas, por su fecha de venta, en los últimos N días (N = 30, 60, 90 o 180). Los productos dados de alta hace menos de N días SHALL quedar afuera. Para cada producto parado SHALL informar la fecha de su última venta no anulada, o `null` si nunca se vendió, y los **días sin vender**, en días enteros, desde esa venta o, si nunca se vendió, desde el alta (RN-15).

#### Scenario: CP-19.1 Producto sin ventas en el período
- **GIVEN** un producto con stock 10 y costo 2.100, dado de alta hace 200 días, cuya última venta fue hace 120 días
- **WHEN** el DUENIO consulta `GET /api/v1/dead-stock?dias=90`
- **THEN** el producto figura con `stock: 10`, `capitalParado: "21000.00"`, la fecha de su última venta y `diasSinVender: 120`

#### Scenario: CP-19.1b Producto que nunca se vendió
- **GIVEN** un producto con stock 5, dado de alta hace 200 días y sin ninguna venta
- **WHEN** el DUENIO consulta el stock parado de 90 días
- **THEN** el producto figura con `ultimaVenta: null` y `diasSinVender: 200`

#### Scenario: CP-19.1c Lo que no es stock parado
- **GIVEN** un producto que vendió hace 10 días, uno sin stock, uno dado de baja, uno dado de alta hace 20 días sin ventas, y uno cuya única venta del período se anuló
- **WHEN** el DUENIO consulta el stock parado de 90 días
- **THEN** sólo figura el de la venta anulada, con la fecha de su última venta anterior o `null`; los otros cuatro no aparecen

#### Scenario: CP-19.1d El período cambia el resultado
- **GIVEN** un producto cuya última venta fue hace 45 días
- **WHEN** el DUENIO consulta con `dias=30` y después con `dias=60`
- **THEN** figura en la primera consulta y no en la segunda

### Requirement: Capital parado y consulta
El **capital parado** de un producto SHALL ser su stock por su costo de reposición vigente, neto de IVA (RN-08), con dos decimales. El sistema SHALL responder en `GET /api/v1/dead-stock?dias=30|60|90|180` (90 por defecto) con el período, los totales (capital parado, productos, unidades y porcentaje del capital parado sobre el stock valorizado de todos los productos activos, con dos decimales, o `null` si el stock valorizado es 0) y los productos parados ordenados por capital parado de mayor a menor, y después por días sin vender y por nombre, con paginación por cursor. Un valor de `dias` fuera de los permitidos SHALL responder 400 `VALIDACION`.

#### Scenario: CP-19.2 Totales y orden
- **GIVEN** un comercio con stock valorizado de 100.000 en el que hay tres productos parados con capital de 21.000, 4.000 y 9.000
- **WHEN** el DUENIO consulta `GET /api/v1/dead-stock`
- **THEN** obtiene `dias: 90`, `totales: { capitalParado: "34000.00", productos: 3, porcentajeDelStock: "34.00", ... }` y los productos en orden 21.000, 9.000 y 4.000

#### Scenario: CP-19.2b Paginación
- **GIVEN** 30 productos parados
- **WHEN** el DUENIO pide `?limit=25` y después la página siguiente con el cursor
- **THEN** recibe 25 y 5 productos sin repetir ninguno, y los totales son los mismos en las dos páginas

#### Scenario: CP-19.2c Período inválido
- **WHEN** el DUENIO consulta `?dias=45`
- **THEN** la API responde 400 `VALIDACION` con `details.dias`

#### Scenario: CP-19.2d Sin stock parado
- **GIVEN** un comercio en el que todos los productos con stock vendieron en los últimos 90 días
- **WHEN** el DUENIO consulta el stock parado
- **THEN** obtiene `capitalParado: "0.00"`, `productos: 0`, el porcentaje en `"0.00"` y la lista vacía

### Requirement: Plan, permisos y aislamiento del stock parado
La consulta SHALL estar disponible desde el plan PRO, SHALL responder 402 `PLAN_REQUERIDO` con `details.planMinimo: "PRO"` en el plan FREE, SHALL permitirse a DUENIO y CONTADOR, y SHALL responder 403 `SIN_PERMISO` al EMPLEADO, porque informa costos. SHALL calcularse sólo con datos del comercio del usuario (RNF-10).

#### Scenario: CP-19.3 Plan FREE
- **GIVEN** un comercio FREE con un producto parado
- **WHEN** el DUENIO consulta el stock parado
- **THEN** la API responde 402 `PLAN_REQUERIDO` con `details.planMinimo: "PRO"`

#### Scenario: CP-19.3b Roles
- **GIVEN** un comercio PRO
- **WHEN** consultan el DUENIO, el CONTADOR y el EMPLEADO
- **THEN** DUENIO y CONTADOR reciben 200 y EMPLEADO 403 `SIN_PERMISO`

#### Scenario: CP-19.3c Aislamiento
- **GIVEN** dos comercios PRO, cada uno con un producto parado
- **WHEN** el DUENIO del comercio A consulta el stock parado
- **THEN** sólo ve el producto de su comercio, y los totales no incluyen nada del comercio B

### Requirement: Rendimiento del stock parado
La consulta SHALL responder en menos de 3 segundos para un comercio con 5.000 productos y 50.000 movimientos (RNF-04).

#### Scenario: CP-19.4 Carga sintética
- **GIVEN** un comercio con 5.000 productos y 50.000 movimientos de venta, 1.000 de ellos sin ventas en los últimos 90 días
- **WHEN** el DUENIO consulta `GET /api/v1/dead-stock` (tras una consulta de calentamiento)
- **THEN** responde 200 en menos de 3 segundos con `totales.productos: 1000`

### Requirement: Stock parado en la web
La web SHALL ofrecer la página "Stock parado" con los totales, un selector de 30, 60, 90 y 180 días y la tabla de productos con capital parado, stock, última venta ("Nunca se vendió" si no tiene) y días sin vender, y una línea con ideas para liberar esa plata. SHALL llegarse desde el panel y desde "Falta de stock". En el plan FREE SHALL mostrar el aviso de plan con el enlace a los planes, y no SHALL mostrarse al EMPLEADO.

#### Scenario: CP-19.5 Ver el stock parado
- **GIVEN** un DUENIO de un comercio PRO con productos parados
- **WHEN** abre "Stock parado" desde la tarjeta del panel
- **THEN** ve el capital parado en pesos y qué parte es de su stock, y la tabla ordenada por capital; al elegir 180 días, las cifras se actualizan

#### Scenario: CP-19.5b Plan FREE en la web
- **GIVEN** un DUENIO de un comercio FREE
- **WHEN** abre "Stock parado"
- **THEN** ve el aviso de que la funcionalidad es del plan PRO, con el enlace "Ver planes"
