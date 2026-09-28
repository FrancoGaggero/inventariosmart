## MODIFIED Requirements

### Requirement: Historial de precios de venta
El sistema SHALL registrar una fila de sólo inserción con el precio de venta, la alícuota de IVA, la fecha de vigencia, el origen (`ALTA`, `EDICION`, `IMPORT`, `INICIAL`, `REMARCACION`) y el usuario cada vez que se crea un producto o cambia su precio de venta, por alta, edición, importación o remarcación en lote (aplicada o deshecha); un guardado que no cambia el precio SHALL no agregar filas. El historial SHALL consultarse en `GET /api/v1/products/:id/price-history` del más reciente al más antiguo, y las filas SHALL no poder modificarse ni borrarse.

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

#### Scenario: CP-15.2e La remarcación también registra
- **GIVEN** `FA-220` con precio 1200
- **WHEN** el DUENIO aplica una remarcación que lo lleva a 1380 y después la deshace
- **THEN** el historial suma una fila `1380.00` y otra `1200.00`, las dos con origen `REMARCACION` y el usuario que las hizo
