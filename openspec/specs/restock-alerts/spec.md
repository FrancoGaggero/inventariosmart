# restock-alerts Specification

## Purpose
Alertas predictivas de reposición (HU-06, RF-06): el sistema calcula para cada producto cuándo hay que reponer según su velocidad de venta y el lead time del proveedor (RN-04), genera una alerta antes de que el stock llegue a cero, la notifica en la app y por correo, y deja que el dueño ajuste la anticipación por producto y gestione cada alerta. Disponible desde el plan PRO.

## Requirements

### Requirement: Cálculo del punto de reposición y del umbral de alerta
El sistema SHALL calcular por producto activo la velocidad diaria de venta como las unidades de movimientos VENTA no anulados de los últimos 30 días dividido 30, el punto de reposición como velocidad × lead time en días del proveedor principal + stock de seguridad (RN-04), el umbral de alerta como velocidad × (lead time + días de anticipación del producto) + stock de seguridad, los días de cobertura como stock actual ÷ velocidad, y la cantidad sugerida para cubrir 30 días de venta más el lead time; los enteros se redondean hacia arriba. Sin proveedor principal, el lead time SHALL ser 7 días (HU-06 criterio 1).

#### Scenario: CP-06.1 Punto de reposición con ventas y lead time
- **GIVEN** un producto con stock de seguridad 4, proveedor principal con lead time 5 días, anticipación 3 días y 60 unidades vendidas en los últimos 30 días
- **WHEN** el sistema recalcula las alertas
- **THEN** la velocidad es 2 por día, el punto de reposición 14, el umbral de alerta 20 y, con stock 18, los días de cobertura son 9 y la cantidad sugerida 56 (2 × (5 + 30) + 4 − 18)

#### Scenario: CP-06.1b Sin ventas no hay alerta predictiva
- **GIVEN** un producto con stock 2 y sin ventas en los últimos 30 días
- **WHEN** el sistema recalcula
- **THEN** no se genera alerta de reposición para ese producto (las alertas de sin stock y stock bajo del panel siguen cubriéndolo)

#### Scenario: CP-06.1c Las ventas anuladas no cuentan
- **GIVEN** un producto con dos ventas de 30 unidades en el mes, una de ellas anulada
- **WHEN** el sistema recalcula
- **THEN** la velocidad se calcula con 30 unidades (1 por día)

#### Scenario: CP-06.1d Sin proveedor principal
- **GIVEN** un producto sin proveedor principal, con velocidad 1 por día y stock de seguridad 0
- **WHEN** el sistema recalcula
- **THEN** usa 7 días de lead time: punto de reposición 7

### Requirement: Alerta antes del quiebre
El sistema SHALL generar una alerta `ACTIVA` para un producto con velocidad mayor a cero cuando su stock actual sea menor o igual al umbral de alerta, con severidad `PROXIMA` si el stock supera el punto de reposición y `CRITICA` si no lo supera, guardando las cifras del cálculo (stock, velocidad, días de cobertura, punto, umbral, lead time, cantidad sugerida). SHALL existir a lo sumo una alerta abierta (`ACTIVA` o `POSPUESTA`) por producto; el recálculo SHALL actualizar sus cifras y SHALL marcarla `RESUELTA` cuando el stock vuelva a superar el umbral. El recálculo SHALL correr una vez por día para los comercios con plan PRO o superior y, además, al consultar las alertas o el panel si el último cálculo del comercio tiene más de una hora, y a pedido del DUENIO (HU-06 criterio 2).

#### Scenario: CP-06.2 Alerta generada antes de llegar a cero
- **GIVEN** el producto de CP-06.1 con stock 18 (umbral 20, punto 14)
- **WHEN** el sistema recalcula
- **THEN** existe una alerta `ACTIVA` con severidad `PROXIMA`, `diasCobertura: 9`, `puntoReposicion: 14`, `umbral: 20`, `cantidadSugerida: 56` y el producto todavía tiene stock

#### Scenario: CP-06.2b Severidad crítica
- **GIVEN** el mismo producto con stock 10 (por debajo del punto 14)
- **WHEN** el sistema recalcula
- **THEN** la alerta abierta pasa a severidad `CRITICA` con `diasCobertura: 5`

#### Scenario: CP-06.2c Se resuelve sola al reponer
- **GIVEN** un producto con alerta `ACTIVA`
- **WHEN** se registra un INGRESO que deja el stock por encima del umbral y el sistema recalcula
- **THEN** la alerta queda `RESUELTA` con fecha de resolución y no aparece entre las activas

#### Scenario: CP-06.2d Una sola alerta abierta por producto
- **GIVEN** un producto en alerta
- **WHEN** el sistema recalcula dos veces seguidas
- **THEN** sigue habiendo una única alerta abierta para ese producto, con las cifras actualizadas

#### Scenario: CP-06.2e Recálculo bajo demanda
- **GIVEN** un comercio PRO cuyo último cálculo tiene más de una hora y una venta nueva que deja un producto por debajo del umbral
- **WHEN** el DUENIO consulta `GET /api/v1/alerts`
- **THEN** la respuesta ya incluye la alerta nueva y `calculadasEn` es reciente; una segunda consulta inmediata no vuelve a recalcular

### Requirement: Notificación en la app y por correo
El sistema SHALL exponer las alertas en `GET /api/v1/alerts` (filtro por estado, paginado por cursor, con producto, proveedor y cifras), un resumen en `GET /api/v1/alerts/summary` (activas, críticas, fecha del último cálculo) y el bloque `alertas.reposicion` del panel; y SHALL enviar por correo a los usuarios DUENIO activos del comercio, en cada recálculo que genere alertas nuevas, un único resumen con producto, stock, días de cobertura y cantidad sugerida, marcando cada alerta como notificada para no repetirla. Sin proveedor de correo configurado, el envío SHALL registrarse en el log sin fallar (HU-06 criterio 3).

#### Scenario: CP-06.3 Alerta visible en la app
- **GIVEN** un comercio PRO con dos productos en alerta y uno crítico
- **WHEN** el DUENIO consulta `GET /api/v1/alerts/summary` y `GET /api/v1/alerts?estado=ACTIVA`
- **THEN** obtiene `{ activas: 2, criticas: 1, calculadasEn }` y las dos alertas con `producto`, `proveedor` (nombre y lead time, o null), cifras y `severidad`, ordenadas por días de cobertura ascendente

#### Scenario: CP-06.3b Correo a los dueños una sola vez
- **GIVEN** un comercio PRO con un DUENIO activo y un recálculo que genera dos alertas nuevas
- **WHEN** termina el recálculo y luego corre otro sin alertas nuevas
- **THEN** se envía un solo correo al dueño con las dos alertas (producto, stock, días de cobertura, cantidad sugerida), ambas quedan con `notificadaEn`, y el segundo recálculo no envía nada

#### Scenario: CP-06.3c Sin proveedor de correo configurado
- **GIVEN** la API sin `RESEND_API_KEY`
- **WHEN** un recálculo genera alertas nuevas
- **THEN** las alertas se crean, el envío queda registrado en el log y la respuesta no falla

### Requirement: Umbral de alerta configurable por producto
El sistema SHALL permitir al DUENIO fijar por producto los días de anticipación de la alerta (`diasAnticipacionAlerta`, entero de 0 a 90, 3 por defecto) y SHALL usarlos en el umbral del siguiente recálculo (HU-06 criterio 4, ver `product-catalog`).

#### Scenario: CP-06.4 La anticipación cambia el umbral
- **GIVEN** el producto de CP-06.1 con stock 18
- **WHEN** el DUENIO fija `diasAnticipacionAlerta: 0` y recalcula, y luego lo fija en 10 y recalcula
- **THEN** con 0 el umbral es 14 y la alerta queda `RESUELTA` (18 > 14); con 10 el umbral es 34 y vuelve a haber una alerta `ACTIVA`

#### Scenario: CP-06.4b Valor fuera de rango
- **WHEN** el DUENIO envía `diasAnticipacionAlerta: 120` o `-1`
- **THEN** la API responde 400 `VALIDACION` con `details.diasAnticipacionAlerta`

### Requirement: Gestión de alertas por el dueño
El sistema SHALL permitir al DUENIO marcar una alerta abierta como `ATENDIDA` (ya se pidió la mercadería) o `POSPUESTA` por 7 días. Una alerta `POSPUESTA` SHALL volver a `ACTIVA` en el primer recálculo posterior a su vencimiento si el producto sigue en alerta. Un producto con alerta `ATENDIDA` SHALL no generar una alerta nueva hasta que se registre un INGRESO posterior a la atención.

#### Scenario: CP-06.5 Atender una alerta
- **GIVEN** una alerta `ACTIVA`
- **WHEN** el DUENIO envía `PATCH /api/v1/alerts/:id` con `{ accion: "ATENDER" }` y el sistema recalcula sin que haya entrado mercadería
- **THEN** la alerta queda `ATENDIDA` con `atendidaEn` y no aparece una alerta nueva para ese producto

#### Scenario: CP-06.5b Posponer y vencimiento
- **GIVEN** una alerta `ACTIVA`
- **WHEN** el DUENIO envía `{ accion: "POSPONER" }`, y más tarde el sistema recalcula con la fecha de posposición vencida y el producto aún en alerta
- **THEN** primero queda `POSPUESTA` con `pospuestaHasta` a 7 días y no cuenta entre las activas; después vuelve a `ACTIVA`

#### Scenario: CP-06.5c Atendida y luego ingreso
- **GIVEN** un producto con alerta `ATENDIDA`
- **WHEN** se registra un INGRESO que igual deja el stock por debajo del umbral y el sistema recalcula
- **THEN** se genera una alerta `ACTIVA` nueva

#### Scenario: CP-06.5d Acciones inválidas
- **WHEN** el DUENIO intenta atender una alerta `RESUELTA` o envía una acción desconocida
- **THEN** la API responde 409 `CONFLICTO` o 400 `VALIDACION` respectivamente

### Requirement: Plan, permisos y aislamiento
Las alertas de reposición SHALL requerir plan PRO o superior (RF-15): en plan FREE los endpoints de alertas responden 402 `PLAN_REQUERIDO` y el panel devuelve `alertas.reposicion: null`. El DUENIO SHALL gestionar y consultar, el CONTADOR SHALL sólo consultar y el EMPLEADO SHALL recibir 403 `SIN_PERMISO` (CP-11.4). Un comercio SHALL ver únicamente sus alertas (RNF-10).

#### Scenario: CP-06.6 Plan FREE
- **GIVEN** un comercio en plan FREE
- **WHEN** el DUENIO consulta `GET /api/v1/alerts` o el panel
- **THEN** la primera responde 402 `PLAN_REQUERIDO` y el panel trae `alertas.reposicion: null`

#### Scenario: CP-06.6b Roles
- **GIVEN** un comercio PRO con una alerta activa
- **WHEN** el CONTADOR consulta las alertas y luego intenta `PATCH`, y el EMPLEADO consulta
- **THEN** el CONTADOR obtiene 200 en la consulta y 403 en el `PATCH`; el EMPLEADO obtiene 403

#### Scenario: CP-06.6c Aislamiento
- **GIVEN** dos comercios PRO con alertas
- **WHEN** el dueño de uno consulta las alertas o intenta `PATCH` sobre una alerta del otro
- **THEN** sólo ve las propias y el `PATCH` ajeno responde 404 `NO_ENCONTRADO`

### Requirement: Rendimiento del recálculo
El recálculo de un comercio SHALL completarse en menos de 3 segundos con 5.000 productos y 50.000 movimientos (RNF-04), en una sola pasada sobre las ventas de los últimos 30 días.

#### Scenario: CP-06.7 Carga sintética
- **GIVEN** un comercio PRO con 5.000 productos y 50.000 movimientos
- **WHEN** el DUENIO ejecuta `POST /api/v1/alerts/recalculate`
- **THEN** responde en menos de 3 segundos con `{ creadas, actualizadas, resueltas }`
