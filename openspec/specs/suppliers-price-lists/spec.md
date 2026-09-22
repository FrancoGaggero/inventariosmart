# suppliers-price-lists Specification

## Purpose
Proveedores del comercio con datos de contacto, lead time e índice de confiabilidad, y sus listas de precios: historial de costos netos por producto y proveedor de sólo inserción, carga manual e importación desde planilla con vista previa, proveedor principal por producto y costo de reposición vigente actualizado automáticamente (HU-02, RF-03, RN-08, RN-04).

## Requirements

### Requirement: ABM de proveedores
El sistema SHALL permitir al DUENIO crear, consultar, editar y dar de baja proveedores de su comercio con nombre (único por comercio, sin distinguir mayúsculas), contacto, email, teléfono, CUIT, notas, lead time en días e índice de confiabilidad de 1 a 5; la baja SHALL ser lógica y reversible, conservando el historial de precios (HU-02 criterio 1, RF-03).

#### Scenario: CP-02.1 Alta y edición de proveedor
- **GIVEN** un DUENIO
- **WHEN** envía `POST /api/v1/suppliers` con nombre "Distribuidora Norte", email, teléfono y `leadTimeDias: 5`, y luego `PATCH /api/v1/suppliers/:id` con teléfono nuevo
- **THEN** la API responde 201 con el proveedor (`confiabilidad: 3` por defecto, `activo: true`) y luego 200 con el teléfono nuevo; `GET /api/v1/suppliers` lo lista

#### Scenario: CP-02.1b Nombre repetido
- **GIVEN** un comercio con el proveedor "Distribuidora Norte"
- **WHEN** el DUENIO crea otro llamado "distribuidora norte"
- **THEN** la API responde 409 `CONFLICTO`; el mismo nombre puede existir en otro comercio

#### Scenario: CP-02.1c Baja lógica y reactivación
- **GIVEN** un proveedor activo con precios cargados
- **WHEN** el DUENIO envía `DELETE /api/v1/suppliers/:id` y después `PATCH` con `activo: true`
- **THEN** el proveedor desaparece del listado por defecto (`?activo=false` lo muestra), sigue accesible por id con su historial de precios intacto, y luego vuelve al listado

#### Scenario: CP-02.1d Datos inválidos
- **GIVEN** un DUENIO
- **WHEN** envía nombre vacío, email mal formado, `leadTimeDias` negativo o `confiabilidad` 6
- **THEN** la API responde 400 `VALIDACION` con `details` por campo

### Requirement: Lead time y confiabilidad del proveedor
El sistema SHALL guardar por proveedor el plazo de entrega en días (entero ≥ 0, default 7) y un índice de confiabilidad entero de 1 a 5 (default 3), editables por el DUENIO, y SHALL exponerlos en cada respuesta del proveedor para que el punto de reposición (RN-04, HU-06) y el comparador (HU-12) los consuman (HU-02 criterios 2 y 3).

#### Scenario: CP-02.2 Lead time registrado
- **GIVEN** un proveedor con `leadTimeDias` 7
- **WHEN** el DUENIO envía `PATCH` con `leadTimeDias: 12`
- **THEN** `GET /api/v1/suppliers/:id` devuelve `leadTimeDias: 12`

#### Scenario: CP-02.3 Confiabilidad actualizada
- **GIVEN** un proveedor con `confiabilidad` 3
- **WHEN** el DUENIO envía `PATCH` con `confiabilidad: 5`, y luego con `confiabilidad: 0`
- **THEN** la primera responde 200 con 5 y la segunda 400 `VALIDACION` con `details.confiabilidad`

### Requirement: Historial de costos por producto y proveedor
El sistema SHALL registrar cada costo informado por un proveedor para un producto como una fila nueva con costo neto sin IVA, fecha de vigencia, origen (`MANUAL` o `IMPORT`) y usuario, sin modificar ni borrar filas anteriores, y SHALL exponer la lista vigente de un proveedor (último costo por producto) y el historial de costos de un producto (RN-08).

#### Scenario: CP-02.4 Carga manual de costos
- **GIVEN** un proveedor y un producto `FA-220`
- **WHEN** el DUENIO envía `POST /api/v1/suppliers/:id/prices` con `items: [{ productoId, costoNeto: "2100.00" }]`
- **THEN** la API responde 201 con las filas creadas (`origen: "MANUAL"`, `vigenteDesde` igual al momento) y `GET /api/v1/suppliers/:id/prices` muestra `FA-220` con `costoNeto: "2100.00"`

#### Scenario: CP-02.4b Historial del producto
- **GIVEN** un producto con costos de dos proveedores en distintas fechas
- **WHEN** el DUENIO consulta `GET /api/v1/products/:id/prices`
- **THEN** obtiene todas las filas del más reciente al más antiguo, cada una con proveedor, costo, vigencia y origen

#### Scenario: CP-02.4c Sin edición ni borrado de costos
- **GIVEN** una fila de costo existente
- **WHEN** se envía `PATCH` o `DELETE` sobre ella, o una conexión con el rol de la aplicación ejecuta `UPDATE` o `DELETE` sobre la tabla
- **THEN** la API responde 404 (la ruta no existe) y la base rechaza la operación por falta de privilegios

### Requirement: Importación de lista de precios con vista previa
El sistema SHALL aceptar del DUENIO un archivo `.xlsx` o `.csv` de hasta 5.000 filas y 2 MB con código de producto y costo neto, SHALL devolver una vista previa que clasifique cada fila como coincidente sin cambio, coincidente con cambio de costo (indicando el costo anterior), sin producto o inválida, y SHALL registrar los costos sólo cuando el DUENIO confirma la vista previa; el archivo no se conserva (HU-02 criterio 4).

#### Scenario: CP-02.4d Vista previa clasifica las filas
- **GIVEN** un comercio con productos `FA-220` (costo vigente 2100) y `AM-1L`, y una planilla con filas `FA-220;2340`, `AM-1L;880`, `ZZ-999;100` y `FA-220;abc`
- **WHEN** el DUENIO envía la planilla a `POST /api/v1/suppliers/:id/price-list/preview`
- **THEN** la API responde 200 con `FA-220` como cambio (`costoAnterior: "2100.00"`, `costoNeto: "2340.00"`), `AM-1L` como nuevo costo para ese proveedor, `ZZ-999` como sin producto y la cuarta fila como inválida con su motivo, más un resumen con los conteos; no se registra nada

#### Scenario: CP-02.4e Confirmación registra e ignora las no aplicables
- **GIVEN** la vista previa anterior
- **WHEN** el DUENIO envía `POST /api/v1/suppliers/:id/price-list` con las filas coincidentes
- **THEN** la API responde 201 con `insertados: 2`, ambas filas quedan con `origen: "IMPORT"` y el mismo lote, y una segunda confirmación idéntica responde 201 con `insertados: 0` porque los costos ya son los vigentes

#### Scenario: CP-02.4f Archivo inválido
- **GIVEN** un DUENIO
- **WHEN** sube un archivo que no es `.xlsx` ni `.csv`, o de más de 2 MB, o de más de 5.000 filas, o sin ninguna columna de código y costo reconocible
- **THEN** la API responde 400 `VALIDACION` con un mensaje que explica el problema

#### Scenario: CP-02.4g Encabezados y decimales flexibles
- **GIVEN** una planilla con encabezados "Código" y "Costo" y costos escritos como `2.340,50`
- **WHEN** se solicita la vista previa
- **THEN** la fila se interpreta con `costoNeto: "2340.50"`

### Requirement: Proveedor principal y costo vigente del producto
El sistema SHALL mantener por producto un proveedor principal y SHALL actualizar `costoReposicion` con el último costo de ese proveedor: cuando el proveedor principal informa un costo nuevo, cuando se cambia el proveedor principal y cuando un producto sin proveedor principal recibe su primer costo (ese proveedor queda como principal). Un costo de un proveedor no principal SHALL quedar en el historial sin cambiar el costo vigente (RN-08, HU-02 criterio 5).

#### Scenario: CP-02.5 El costo vigente sigue a la última lista del proveedor principal
- **GIVEN** un producto `FA-220` con `costoReposicion` 2100 y proveedor principal "Norte"
- **WHEN** se importa una lista de "Norte" con `FA-220;2340`
- **THEN** `GET /api/v1/products/:id` devuelve `costoReposicion: "2340.00"`

#### Scenario: CP-02.5b Un proveedor secundario no cambia el costo vigente
- **GIVEN** el mismo producto con principal "Norte"
- **WHEN** el proveedor "Sur" informa `FA-220` a 2000
- **THEN** el historial del producto muestra los dos costos y `costoReposicion` sigue en 2340

#### Scenario: CP-02.5c Cambiar el proveedor principal cambia el costo vigente
- **GIVEN** el producto anterior
- **WHEN** el DUENIO envía `PATCH /api/v1/products/:id` con `proveedorPrincipalId` de "Sur"
- **THEN** la respuesta muestra `proveedorPrincipal.nombre: "Sur"` y `costoReposicion: "2000.00"`

#### Scenario: CP-02.5d Primer costo de un producto sin proveedor
- **GIVEN** un producto sin proveedor principal
- **WHEN** un proveedor informa su primer costo
- **THEN** ese proveedor queda como principal y el costo vigente se actualiza

#### Scenario: CP-02.5e Costo editado a mano queda en el historial
- **GIVEN** un producto con proveedor principal "Norte"
- **WHEN** el DUENIO edita `costoReposicion` desde el producto
- **THEN** el costo vigente cambia y el historial muestra una fila `MANUAL` de "Norte" con ese costo; si el producto no tiene proveedor principal, sólo cambia el costo vigente

### Requirement: Permisos sobre proveedores y costos
El sistema SHALL permitir sólo al DUENIO operar proveedores, precios e importaciones; EMPLEADO y CONTADOR SHALL recibir 403 `SIN_PERMISO` en todas esas rutas (Propuesta §2.4).

#### Scenario: CP-02.7 Empleado y contador sin acceso
- **GIVEN** un usuario EMPLEADO y uno CONTADOR
- **WHEN** consultan `GET /api/v1/suppliers`, `GET /api/v1/products/:id/prices` o intentan crear un proveedor
- **THEN** la API responde 403 `SIN_PERMISO` en todos los casos

### Requirement: Aislamiento de proveedores y precios entre comercios
El sistema SHALL garantizar que los proveedores y los costos de un comercio sean invisibles e inalcanzables para otro, también a nivel de base de datos, y SHALL rechazar cargar costos de un producto o un proveedor de otro comercio (RNF-10).

#### Scenario: CP-02.6 Acceso cruzado
- **GIVEN** un proveedor y un producto del comercio B
- **WHEN** un DUENIO del comercio A consulta o edita ese proveedor por id, o intenta cargarle un costo, o intenta cargar un costo para ese producto desde un proveedor propio
- **THEN** la API responde 404 `NO_ENCONTRADO` y nada cambia en B

#### Scenario: CP-02.6b La base bloquea sin contexto
- **GIVEN** una conexión con el rol de la aplicación sin `app.comercio_id`
- **WHEN** ejecuta `SELECT` sobre `proveedor` o `precio_proveedor`
- **THEN** no obtiene filas
