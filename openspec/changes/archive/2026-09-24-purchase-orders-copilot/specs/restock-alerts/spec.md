## MODIFIED Requirements

### Requirement: Gestión de alertas por el dueño
El sistema SHALL permitir al DUENIO marcar una alerta abierta como `ATENDIDA` (ya se pidió la mercadería) o `POSPUESTA` por 7 días. Una alerta `POSPUESTA` SHALL volver a `ACTIVA` en el primer recálculo posterior a su vencimiento si el producto sigue en alerta. Un producto con alerta `ATENDIDA` SHALL no generar una alerta nueva hasta que se registre un INGRESO posterior a la atención. La confirmación de una orden de compra (HU-07) SHALL atender las alertas abiertas de los productos incluidos dejando en cada una la referencia a la orden (`ordenCompraId`), que la alerta SHALL exponer (nulo cuando se atendió a mano).

#### Scenario: CP-06.5 Atender una alerta
- **GIVEN** una alerta `ACTIVA`
- **WHEN** el DUENIO envía `PATCH /api/v1/alerts/:id` con `{ accion: "ATENDER" }` y el sistema recalcula sin que haya entrado mercadería
- **THEN** la alerta queda `ATENDIDA` con `atendidaEn`, `ordenCompraId` nulo, y no aparece una alerta nueva para ese producto

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

#### Scenario: CP-06.5e Atendida por una orden de compra
- **GIVEN** un producto con alerta `ACTIVA` y otro con alerta `POSPUESTA`, ambos en un borrador de orden de compra
- **WHEN** el DUENIO confirma la orden y el sistema recalcula sin que haya entrado mercadería
- **THEN** las dos alertas quedan `ATENDIDA` con `atendidaEn` y `ordenCompraId` igual a la orden, `GET /api/v1/alerts?estado=ATENDIDA` las devuelve con ese campo y no aparece una alerta nueva para esos productos
