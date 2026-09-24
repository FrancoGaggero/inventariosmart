## MODIFIED Requirements

### Requirement: Modificación de producto
El sistema SHALL permitir al DUENIO editar código, nombre, categoría, precio de venta, alícuota, costo de reposición, stock de seguridad, proveedor principal y días de anticipación de la alerta de reposición (`diasAnticipacionAlerta`, entero de 0 a 90, 3 por defecto en el alta; HU-06 criterio 4), con las mismas validaciones del alta, y SHALL rechazar cambios directos al stock actual, que sólo se modifica por movimientos (RF-02, RN-07). El producto SHALL exponer `proveedorPrincipal` (id y nombre, o null) y `diasAnticipacionAlerta`; al cambiar el proveedor principal el costo de reposición SHALL pasar al último costo informado por ese proveedor, si existe (RN-08, ver `suppliers-price-lists`).

#### Scenario: CP-01.4 Edición reflejada de inmediato
- **GIVEN** un producto existente
- **WHEN** el DUENIO envía `PATCH /api/v1/products/:id` con nuevo precio y stock de seguridad
- **THEN** la respuesta y el siguiente `GET` muestran los valores nuevos y `estadoStock` recalculado

#### Scenario: CP-01.4b El stock no se edita a mano
- **GIVEN** un producto con `stockActual` 47
- **WHEN** el DUENIO envía `PATCH` con `stockActual: 100`
- **THEN** la API responde 400 `VALIDACION` indicando que el stock se ajusta con movimientos

#### Scenario: CP-01.4c Empleado no edita
- **GIVEN** un usuario con rol EMPLEADO
- **WHEN** intenta crear, editar o dar de baja un producto
- **THEN** la API responde 403 `SIN_PERMISO`

#### Scenario: CP-01.4d Proveedor principal del producto
- **GIVEN** un producto sin proveedor principal y un proveedor "Norte" del comercio
- **WHEN** el DUENIO envía `PATCH /api/v1/products/:id` con `proveedorPrincipalId` de "Norte", y luego con `proveedorPrincipalId` de un proveedor de otro comercio
- **THEN** la primera responde 200 con `proveedorPrincipal: { id, nombre: "Norte" }` y la segunda 404 `NO_ENCONTRADO`

#### Scenario: CP-01.4e Días de anticipación de la alerta
- **GIVEN** un producto recién creado sin indicar anticipación
- **WHEN** el DUENIO lo consulta, luego envía `PATCH` con `diasAnticipacionAlerta: 10` y después con `diasAnticipacionAlerta: 120`
- **THEN** el `GET` inicial muestra `diasAnticipacionAlerta: 3`, el primer `PATCH` responde 200 con 10 y el segundo 400 `VALIDACION` con `details.diasAnticipacionAlerta`
