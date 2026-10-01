## ADDED Requirements

### Requirement: Productos más vendidos
El asistente SHALL poder consultar los productos con ventas en un período, de hasta un año, ordenados por unidades vendidas o por facturación neta de IVA (RN-03), y SHALL usar esa consulta para las preguntas sobre lo que más se vende o lo que más factura. Las preguntas sobre lo más rentable SHALL seguir respondiéndose con el margen bruto (RN-01). Si la pregunta no aclara el criterio, el asistente SHALL usar unidades y decirlo. Cada producto del resultado SHALL incluir código, nombre, unidades vendidas, facturación neta y su participación porcentual en el total del período; el resultado SHALL incluir también el total de unidades y de facturación neta del período y traer como máximo 10 productos. Sólo SHALL contar las ventas no anuladas del comercio del usuario. Los productos dados de baja que tuvieron ventas en el período SHALL aparecer igual, porque sus ventas existieron.

#### Scenario: CP-08.7 El más vendido no es el más rentable
- **GIVEN** un comercio PREMIUM en el que, en los últimos 15 días, `AC-5L` vendió 120 unidades con poco margen y `FA-220` vendió 40 unidades con el mayor margen bruto
- **WHEN** el DUENIO pregunta "¿qué fue lo que más vendí en la quincena?"
- **THEN** el asistente nombra a `AC-5L` con 120 unidades, aclara que el criterio son unidades vendidas y `fuentes` incluye la consulta "Productos más vendidos" y no la de productos más rentables

#### Scenario: CP-08.7b El que más facturó
- **GIVEN** el comercio de CP-08.7, donde `FA-220` facturó más que `AC-5L` en pesos netos de IVA
- **WHEN** el DUENIO pregunta "¿qué producto facturó más este mes?"
- **THEN** la consulta se hace por facturación, el asistente nombra a `FA-220` con su facturación neta y aclara que el monto es sin IVA

#### Scenario: CP-08.7c Las cifras coinciden con los movimientos
- **GIVEN** las ventas de CP-08.7, más una venta de 10 unidades de `AC-5L` que después se anuló
- **WHEN** se consulta lo más vendido de la quincena
- **THEN** `AC-5L` figura con 120 unidades y no 130; las unidades y la facturación neta de cada producto coinciden con la suma de sus ventas en Movimientos para el mismo período; y la participación de cada producto es su parte del total de unidades o de facturación según el criterio pedido

#### Scenario: CP-08.7d Sin ventas en el período
- **GIVEN** un comercio PREMIUM sin ventas registradas en el mes
- **WHEN** el DUENIO pregunta cuál fue su producto más vendido del mes
- **THEN** la consulta "Productos más vendidos" devuelve la lista vacía con totales en cero, y el asistente responde que todavía no hay ventas en ese período sin informar ningún producto ni cifra (CP-08.2b)

#### Scenario: CP-08.7e Período inválido
- **WHEN** el asistente pide los más vendidos con una fecha inexistente, con el primer día posterior al último o con un período de más de un año
- **THEN** la consulta vuelve al asistente como error con el motivo, no se consulta ninguna venta y el asistente se lo explica al DUENIO en palabras simples

#### Scenario: CP-08.7f Aislamiento y roles
- **GIVEN** dos comercios PREMIUM con ventas, cada uno con productos distintos
- **WHEN** el DUENIO del comercio A pregunta qué fue lo que más vendió
- **THEN** el resultado sólo trae productos y totales del comercio A; y el CONTADOR y el EMPLEADO no pueden hacer esta pregunta porque el asistente responde 403 para esos roles (CP-08.5b)
