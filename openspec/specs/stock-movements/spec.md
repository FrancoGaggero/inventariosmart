# stock-movements Specification

## Purpose
Registro inmutable de los movimientos de stock del comercio (ventas, ingresos de mercadería y ajustes), actualización transaccional del stock de cada producto sin permitir negativos, anulación mediante ajuste inverso, historial filtrable y aviso de stock bajo resultante (HU-10, RF-13, RF-02, RN-07).

## Requirements

### Requirement: Registro de movimiento
El sistema SHALL permitir a DUENIO y EMPLEADO registrar un movimiento de stock indicando tipo (`VENTA`, `INGRESO` o `AJUSTE`), producto, cantidad, fecha (por defecto el momento del registro; nunca futura), motivo y observación, y SHALL guardar en el movimiento el usuario que lo registró, el efecto sobre el stock y el stock resultante del producto (HU-10 criterio 1, RF-13). Una `VENTA` SHALL guardar además el precio unitario de venta vigente del producto en ese momento. Cada campo inválido SHALL responder 400 `VALIDACION` con el detalle por campo.

#### Scenario: CP-10.1 Venta registrada con sus datos
- **GIVEN** un producto `FA-220` con `stockActual` 47 y `precioVenta` 3900.00
- **WHEN** un EMPLEADO envía `POST /api/v1/movements` con `tipo: "VENTA"`, `productoId`, `cantidad: 2` y sin fecha
- **THEN** la API responde 201 con el movimiento: `tipo: "VENTA"`, `cantidad: 2`, `efectoStock: -2`, `stockResultante: 45`, `precioUnitario: "3900.00"`, `fecha` igual al momento del registro, `usuario` con el nombre del empleado y el `producto` con código y nombre

#### Scenario: CP-10.1b Ingreso de mercadería
- **GIVEN** el mismo producto con `stockActual` 45
- **WHEN** el DUENIO registra `tipo: "INGRESO"`, `cantidad: 30`, `observacion: "Remito 0001-00004512"`
- **THEN** la API responde 201 con `efectoStock: 30`, `stockResultante: 75` y la observación guardada

#### Scenario: CP-10.1c Ajuste con motivo obligatorio
- **GIVEN** un producto con `stockActual` 75
- **WHEN** el DUENIO registra `tipo: "AJUSTE"`, `cantidad: -3`, `motivo: "ROTURA"`
- **THEN** la API responde 201 con `efectoStock: -3`, `stockResultante: 72` y `motivo: "ROTURA"`; si el ajuste llega sin motivo, la API responde 400 `VALIDACION` con `details.motivo`

#### Scenario: CP-10.1d Fecha retroactiva permitida, futura rechazada
- **GIVEN** un producto activo
- **WHEN** se registra una `VENTA` con `fecha` de dos días atrás, y luego otra con `fecha` de mañana
- **THEN** la primera se crea con esa fecha y la segunda responde 400 `VALIDACION` con `details.fecha`

#### Scenario: CP-10.1e Datos inválidos
- **GIVEN** un DUENIO
- **WHEN** envía cantidad 0, cantidad negativa en una `VENTA` o `INGRESO`, cantidad no entera, tipo desconocido, producto inexistente o dado de baja, u observación de más de 200 caracteres
- **THEN** la API responde 400 `VALIDACION` (404 `NO_ENCONTRADO` para el producto inexistente, 409 `CONFLICTO` para el producto dado de baja) y no registra nada ni cambia el stock

### Requirement: El stock se actualiza con cada movimiento
El sistema SHALL actualizar el stock actual del producto en la misma operación que registra el movimiento, de forma que ningún lector vea el movimiento sin el stock nuevo ni el stock nuevo sin el movimiento, y SHALL recalcular el estado de stock derivado (RF-02, HU-10 criterio 2).

#### Scenario: CP-10.2 Stock reflejado de inmediato
- **GIVEN** un producto con `stockActual` 47
- **WHEN** se registra una `VENTA` de 2 unidades
- **THEN** `GET /api/v1/products/:id` devuelve `stockActual: 45` y el movimiento aparece en `GET /api/v1/movements?productoId=:id` con `stockResultante: 45`

#### Scenario: CP-10.2b Movimientos concurrentes sobre el mismo producto
- **GIVEN** un producto con `stockActual` 10
- **WHEN** se registran 10 ventas de 1 unidad en paralelo
- **THEN** las 10 responden 201, el `stockActual` final es 0 y los `stockResultante` de los movimientos son 9, 8, …, 0 sin repetidos

### Requirement: El stock nunca queda negativo
El sistema SHALL rechazar con 409 `CONFLICTO` toda `VENTA` o `AJUSTE` negativo cuya cantidad supere el stock disponible del producto, informando en `details` el stock actual y la cantidad pedida, y SHALL rechazar del mismo modo una anulación que dejaría el stock negativo (HU-10 criterio 3).

#### Scenario: CP-10.3 Venta mayor al stock disponible
- **GIVEN** un producto con `stockActual` 3
- **WHEN** un EMPLEADO registra una `VENTA` de 5 unidades
- **THEN** la API responde 409 `{ code: "CONFLICTO", details: { stockActual: 3, cantidad: 5 } }` con un mensaje que indica que no hay stock suficiente, y el stock sigue en 3

#### Scenario: CP-10.3b Ajuste negativo mayor al stock
- **GIVEN** un producto con `stockActual` 3
- **WHEN** el DUENIO registra un `AJUSTE` con `cantidad: -4`
- **THEN** la API responde 409 `CONFLICTO` y el stock sigue en 3

#### Scenario: CP-10.3c Venta exacta del stock disponible
- **GIVEN** un producto con `stockActual` 3
- **WHEN** se registra una `VENTA` de 3 unidades
- **THEN** la API responde 201 con `stockResultante: 0` y `estadoStock: "SIN_STOCK"`

### Requirement: Los movimientos son inmutables y se corrigen por anulación
El sistema SHALL impedir modificar o eliminar un movimiento y SHALL ofrecer la anulación, que registra un `AJUSTE` inverso con referencia al movimiento original y devuelve el stock al valor previo; un movimiento SHALL anularse a lo sumo una vez y el ajuste de anulación no SHALL ser anulable (RN-07, HU-10 criterio 4).

#### Scenario: CP-10.4 Anular una venta cargada por error
- **GIVEN** una `VENTA` de 2 unidades que dejó el stock en 45
- **WHEN** el DUENIO envía `POST /api/v1/movements/:id/anular` con `observacion: "Cobrada dos veces"`
- **THEN** la API responde 201 con un `AJUSTE` de `efectoStock: 2`, `motivo: "ANULACION"`, `corrigeAId` igual al id de la venta y `stockResultante: 47`; la venta original sigue en el historial con `anuladoPorId` igual al id del ajuste

#### Scenario: CP-10.4b No se anula dos veces ni se anula una anulación
- **GIVEN** una venta ya anulada
- **WHEN** se intenta anularla de nuevo, o se intenta anular el ajuste de anulación
- **THEN** la API responde 409 `CONFLICTO` en ambos casos

#### Scenario: CP-10.4c No hay edición ni borrado
- **GIVEN** un movimiento existente
- **WHEN** se envía `PATCH` o `DELETE` a `/api/v1/movements/:id`
- **THEN** la API responde 404 (la ruta no existe) y el movimiento no cambia

#### Scenario: CP-10.4d Sólo el dueño anula
- **GIVEN** un usuario con rol EMPLEADO
- **WHEN** intenta anular un movimiento
- **THEN** la API responde 403 `SIN_PERMISO`

### Requirement: Historial de movimientos
El sistema SHALL listar los movimientos del comercio ordenados del más reciente al más antiguo, con filtros por producto, tipo y rango de fechas y paginación por cursor, y SHALL devolver un movimiento por id; el rango de fechas SHALL permitir obtener las ventas de un período, que es la base de la velocidad de venta (RN-04) y de los indicadores del dashboard (RF-13, HU-10 criterio 5).

#### Scenario: CP-10.5 Ventas de los últimos 30 días
- **GIVEN** un producto con ventas registradas hace 40, 20 y 2 días y un ingreso hace 10 días
- **WHEN** se consulta `GET /api/v1/movements?productoId=:id&tipo=VENTA&desde=<hace 30 días>`
- **THEN** la respuesta contiene sólo las ventas de hace 20 y 2 días, en ese orden inverso (la más reciente primero)

#### Scenario: CP-10.5b Historial global paginado
- **GIVEN** un comercio con 5 movimientos de distintos productos
- **WHEN** se consulta `GET /api/v1/movements?limit=2` y se sigue con el `siguienteCursor`
- **THEN** se recorren los 5 del más reciente al más antiguo sin repetir ni omitir, cada uno con el código y el nombre de su producto, y la última página devuelve `siguienteCursor: null`

#### Scenario: CP-10.5c Rango de fechas inválido
- **GIVEN** cualquier usuario con acceso
- **WHEN** consulta con `hasta` anterior a `desde` o con una fecha que no es ISO 8601
- **THEN** la API responde 400 `VALIDACION` con `details` sobre el campo

### Requirement: Permisos por rol sobre movimientos
El sistema SHALL permitir a DUENIO y EMPLEADO registrar y consultar movimientos, sin exponer costos ni márgenes al EMPLEADO; CONTADOR SHALL poder consultar el historial y SHALL recibir 403 `SIN_PERMISO` al intentar registrar o anular (HU-10 criterio 6, Propuesta §2.4).

#### Scenario: CP-10.6 Empleado registra sin ver costos
- **GIVEN** un usuario con rol EMPLEADO
- **WHEN** registra una `VENTA` y consulta el historial
- **THEN** ambas respuestas son exitosas, incluyen `precioUnitario` y no incluyen ninguna clave que empiece con `costo` o `margen`

#### Scenario: CP-10.6b Contador sólo consulta
- **GIVEN** un usuario con rol CONTADOR
- **WHEN** consulta `GET /api/v1/movements` y luego intenta `POST /api/v1/movements`
- **THEN** la consulta responde 200 y el registro responde 403 `SIN_PERMISO`

### Requirement: Registro idempotente
El sistema SHALL aceptar en `POST /api/v1/movements` una cabecera `Idempotency-Key` y, ante una repetición de la misma clave en el mismo comercio, SHALL devolver el movimiento ya creado sin registrar otro ni tocar el stock.

#### Scenario: CP-10.8 Reintento de una venta con la misma clave
- **GIVEN** un producto con `stockActual` 10
- **WHEN** se envía dos veces la misma `VENTA` de 1 unidad con `Idempotency-Key: abc-123`
- **THEN** la primera responde 201, la segunda responde 200 con el mismo `id`, y el stock queda en 9

#### Scenario: CP-10.8b La clave es por comercio
- **GIVEN** dos comercios A y B
- **WHEN** cada uno registra un movimiento con `Idempotency-Key: abc-123`
- **THEN** se crean dos movimientos distintos, uno en cada comercio

### Requirement: Stock inicial registrado como movimiento
El sistema SHALL registrar el stock inicial de un producto nuevo como un `INGRESO` con motivo `STOCK_INICIAL`, en la misma operación del alta, de modo que el historial de todo producto empiece con su primer movimiento; un producto creado con stock inicial 0 no genera movimiento.

#### Scenario: CP-10.9 El alta deja su primer movimiento
- **GIVEN** un DUENIO
- **WHEN** crea un producto con `stockInicial: 47`
- **THEN** `GET /api/v1/movements?productoId=:id` devuelve un único `INGRESO` con `cantidad: 47`, `motivo: "STOCK_INICIAL"`, `stockResultante: 47` y el usuario que dio de alta el producto

#### Scenario: CP-10.9b Productos anteriores a esta capacidad
- **GIVEN** un producto creado antes de que existieran los movimientos, con `stockActual` 12
- **WHEN** se consulta su historial después de desplegar esta capacidad
- **THEN** aparece un `INGRESO` de 12 unidades con motivo `STOCK_INICIAL` y fecha igual a la del alta del producto

### Requirement: Aviso de stock bajo al registrar
El sistema SHALL incluir en la respuesta de cada movimiento y de cada anulación el `estadoStock` resultante del producto (`OK`, `BAJO` o `SIN_STOCK`, calculado con el stock de seguridad), para que la interfaz avise de inmediato cuando una operación deja el producto por debajo de su stock de seguridad.

#### Scenario: CP-10.10 Venta que deja el stock bajo
- **GIVEN** un producto con `stockActual` 11 y `stockSeguridad` 10
- **WHEN** se registra una `VENTA` de 2 unidades
- **THEN** la respuesta incluye `stockResultante: 9` y `estadoStock: "BAJO"`, y `GET /api/v1/products?estado=BAJO` incluye el producto

### Requirement: Aislamiento de movimientos entre comercios
El sistema SHALL garantizar que los movimientos de un comercio sean invisibles e inalcanzables para otro, también a nivel de base de datos, y SHALL rechazar registrar un movimiento sobre un producto de otro comercio (RNF-10).

#### Scenario: CP-10.7 Acceso cruzado
- **GIVEN** un producto y un movimiento del comercio B
- **WHEN** un DUENIO del comercio A consulta el movimiento por id, intenta anularlo o intenta registrar una `VENTA` sobre ese producto
- **THEN** la API responde 404 `NO_ENCONTRADO` en los tres casos y nada cambia en B; el historial de A no incluye movimientos de B

#### Scenario: CP-10.7b La base bloquea sin contexto
- **GIVEN** una conexión con el rol de la aplicación sin `app.comercio_id`
- **WHEN** ejecuta `SELECT` sobre `movimiento`
- **THEN** no obtiene filas

#### Scenario: CP-10.7c La base impide modificar el historial
- **GIVEN** una conexión con el rol de la aplicación con `app.comercio_id` fijado
- **WHEN** ejecuta `UPDATE` o `DELETE` sobre `movimiento`
- **THEN** la base rechaza la operación por falta de privilegios
