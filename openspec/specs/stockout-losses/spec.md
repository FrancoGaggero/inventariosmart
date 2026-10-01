# stockout-losses Specification

## Purpose
Muestra cuánto vendió y ganó de menos el comercio por haberse quedado sin stock (HU-18, RF-19). Detecta los quiebres a partir del historial de movimientos y estima la pérdida con la demanda de los días en que el producto sí tuvo stock (RN-14).

## Requirements

### Requirement: Detección de quiebres de stock
El sistema SHALL considerar **quiebre** cada intervalo en que un producto activo del comercio estuvo con stock 0, reconstruido a partir del stock que deja cada movimiento en el orden en que se registraron: empieza con el movimiento que dejó el stock en 0 y termina con el siguiente que lo dejó por encima de 0. Si el producto sigue en 0, el quiebre está **en curso** y SHALL contarse hasta el momento de la consulta. Para un período de los últimos N días, SHALL contar sólo la parte de cada quiebre que cae dentro del período, en días con un decimal. Los productos dados de baja y los que nunca tuvieron stock SHALL quedar afuera (RN-14).

#### Scenario: CP-18.1 Quiebre cerrado
- **GIVEN** un producto que vendió sus últimas unidades hace 12 días, quedó en 0, y recibió un ingreso hace 7 días
- **WHEN** el DUENIO consulta `GET /api/v1/stockouts?dias=30`
- **THEN** el producto figura con 1 quiebre, `diasSinStock: 5.0` y `enCurso: false`

#### Scenario: CP-18.1b Quiebre en curso
- **GIVEN** un producto que quedó en 0 hace 4 días y no se repuso
- **WHEN** el DUENIO consulta los quiebres de los últimos 30 días
- **THEN** el producto figura con `enCurso: true`, `diasSinStock: 4.0` y el inicio del quiebre; los totales cuentan un quiebre en curso

#### Scenario: CP-18.1c Varios quiebres y quiebres que empezaron antes del período
- **GIVEN** un producto con un quiebre de 3 días hace dos semanas, otro de 2 días hace una semana, y otro producto que quedó en 0 hace 40 días y se repuso hace 25
- **WHEN** el DUENIO consulta los quiebres de los últimos 30 días
- **THEN** el primero figura con 2 quiebres y `diasSinStock: 5.0`; el segundo, con `diasSinStock: 5.0`, sólo la parte del quiebre que cae dentro de los 30 días

#### Scenario: CP-18.1d Una venta anulada deshace el quiebre
- **GIVEN** un producto que quedó en 0 por una venta que se anuló una hora después
- **WHEN** el DUENIO consulta los quiebres
- **THEN** el quiebre dura sólo esa hora (`diasSinStock: 0.0`) y la venta anulada no cuenta para la demanda

### Requirement: Estimación de la pérdida
Para cada producto con quiebres, el sistema SHALL estimar la **demanda diaria** como las unidades vendidas, sin contar ventas anuladas, en los días en que el producto tuvo stock dentro de los últimos 90 días, divididas por esos días. Las **unidades perdidas** SHALL ser los días sin stock del período multiplicados por la demanda diaria, con un decimal. La **venta perdida** SHALL ser esas unidades por el precio de venta neto de IVA vigente (RN-03), y la **ganancia perdida**, esas unidades por el margen bruto unitario vigente (RN-01), las dos con dos decimales. Si en esos 90 días el producto tuvo stock menos de 7 días o no tuvo ventas, la pérdida SHALL informarse como no calculable con `motivo: "SIN_HISTORIAL"`, sin cifras estimadas y sin sumar en los totales (RN-14).

#### Scenario: CP-18.2 La demanda sale de los días con stock
- **GIVEN** un producto con precio 1.210 con IVA 21 % y costo 600, que en los últimos 90 días tuvo stock durante 30 días y vendió 60 unidades en ellos, y que estuvo 5 días sin stock dentro de los últimos 30
- **WHEN** el DUENIO consulta los quiebres de los últimos 30 días
- **THEN** el producto figura con `demandaDiaria: "2.0"`, `unidadesPerdidas: "10.0"`, `ventaPerdida: "10000.00"` y `gananciaPerdida: "4000.00"`

#### Scenario: CP-18.2b Sin historial suficiente
- **GIVEN** un producto que tuvo stock sólo 3 días en los últimos 90 y quedó en 0, y otro que tuvo stock 20 días sin vender nada y quedó en 0 por un ajuste
- **WHEN** el DUENIO consulta los quiebres
- **THEN** los dos figuran con sus días sin stock, `motivo: "SIN_HISTORIAL"` y unidades, venta y ganancia perdidas en `null`; y no suman en los totales

### Requirement: Consulta de pérdidas por falta de stock
El sistema SHALL responder en `GET /api/v1/stockouts?dias=30|60|90` (30 por defecto) con el inicio y el fin del período, los totales (ganancia perdida, venta perdida, unidades perdidas, productos afectados y quiebres en curso) y los productos con al menos un quiebre en el período, ordenados por ganancia perdida de mayor a menor, con los no calculables al final, y con paginación por cursor. Cada producto SHALL incluir código, nombre, cantidad de quiebres, días sin stock, si está en curso, inicio del último quiebre, demanda diaria, unidades, venta y ganancia perdidas, y motivo. Un valor de `dias` fuera de los permitidos SHALL responder 400 `VALIDACION`.

#### Scenario: CP-18.3 Totales y orden
- **GIVEN** tres productos con ganancias perdidas de 4.000, 9.000 y una no calculable
- **WHEN** el DUENIO consulta `GET /api/v1/stockouts`
- **THEN** obtiene el período de los últimos 30 días, `totales.gananciaPerdida: "13000.00"`, `totales.productosAfectados: 3`, y los productos en orden 9.000, 4.000 y el no calculable

#### Scenario: CP-18.3b Paginación
- **GIVEN** 30 productos con quiebres
- **WHEN** el DUENIO pide `?limit=25` y después la página siguiente con el cursor
- **THEN** recibe 25 y 5 productos sin repetir ninguno, y los totales son los mismos en las dos páginas

#### Scenario: CP-18.3c Período inválido
- **WHEN** el DUENIO consulta `?dias=45`
- **THEN** la API responde 400 `VALIDACION` con `details.dias`

#### Scenario: CP-18.3d Sin quiebres
- **GIVEN** un comercio cuyos productos nunca se quedaron sin stock
- **WHEN** el DUENIO consulta los quiebres
- **THEN** obtiene totales en cero y la lista vacía

### Requirement: Plan, permisos y aislamiento de las pérdidas
La consulta SHALL estar disponible desde el plan PRO, SHALL responder 402 `PLAN_REQUERIDO` con `details.planMinimo: "PRO"` en el plan FREE, SHALL permitirse a DUENIO y CONTADOR, y SHALL responder 403 `SIN_PERMISO` al EMPLEADO, porque informa márgenes. SHALL calcularse sólo con datos del comercio del usuario (RNF-10).

#### Scenario: CP-18.4 Plan FREE
- **GIVEN** un comercio FREE con un producto que estuvo sin stock
- **WHEN** el DUENIO consulta los quiebres
- **THEN** la API responde 402 `PLAN_REQUERIDO` con `details.planMinimo: "PRO"`

#### Scenario: CP-18.4b Roles
- **GIVEN** un comercio PRO
- **WHEN** consultan el DUENIO, el CONTADOR y el EMPLEADO
- **THEN** DUENIO y CONTADOR reciben 200 y EMPLEADO 403 `SIN_PERMISO`

#### Scenario: CP-18.4c Aislamiento
- **GIVEN** dos comercios PRO, cada uno con un producto que estuvo sin stock
- **WHEN** el DUENIO del comercio A consulta los quiebres
- **THEN** sólo ve el producto de su comercio, y los totales no incluyen nada del comercio B

### Requirement: Rendimiento de la consulta
La consulta SHALL responder en menos de 3 segundos para un comercio con 5.000 productos y 50.000 movimientos en los últimos 90 días (RNF-04).

#### Scenario: CP-18.5 Carga sintética
- **GIVEN** un comercio con 5.000 productos y 50.000 movimientos en los últimos 90 días, 500 de ellos con quiebres
- **WHEN** el DUENIO consulta `GET /api/v1/stockouts?dias=90` (tras una consulta de calentamiento)
- **THEN** responde 200 en menos de 3 segundos con `totales.productosAfectados: 500`

### Requirement: Pérdidas por falta de stock en la web
La web SHALL ofrecer la página "Falta de stock" con los totales del período, un selector de 30, 60 y 90 días y la tabla de productos con días sin stock, la marca "Sin stock ahora" para los quiebres en curso, unidades y ganancia perdidas, y "Sin historial suficiente" para los no calculables. SHALL explicar en una frase cómo se estima la pérdida. SHALL llegarse desde el panel y desde la página de Alertas. En el plan FREE SHALL mostrar el aviso de plan con el enlace a los planes, y no SHALL mostrarse al EMPLEADO.

#### Scenario: CP-18.6 Ver las pérdidas
- **GIVEN** un DUENIO de un comercio PRO con quiebres en el último mes
- **WHEN** abre "Falta de stock" desde la tarjeta del panel
- **THEN** ve la ganancia perdida del período en pesos, la explicación de la estimación y la tabla ordenada por ganancia perdida; al elegir 90 días, las cifras se actualizan

#### Scenario: CP-18.6b Plan FREE en la web
- **GIVEN** un DUENIO de un comercio FREE
- **WHEN** abre "Falta de stock"
- **THEN** ve el aviso de que la funcionalidad es del plan PRO, con el enlace "Ver planes"
