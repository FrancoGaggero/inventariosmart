## Purpose

Catálogo de productos del comercio: alta, consulta, modificación, baja lógica y reactivación, con código único por comercio, estado de stock derivado y límite de productos del plan FREE (HU-01, RF-01, RF-02, RN-03, RN-05).

## ADDED Requirements

### Requirement: Alta de producto
El sistema SHALL permitir al DUENIO crear un producto con código, nombre, precio de venta (con IVA incluido), alícuota de IVA, costo de reposición (sin IVA), stock inicial y stock de seguridad, y SHALL validar cada campo devolviendo 400 `VALIDACION` con el detalle por campo (RF-01).

#### Scenario: CP-01.1 Producto nuevo queda registrado y visible
- **GIVEN** un DUENIO con plan PRO
- **WHEN** envía `POST /api/v1/products` con código `FA-220`, nombre, costo, precio, IVA 21 y stock inicial 47
- **THEN** la API responde 201 con el producto, `stockActual` 47, `activo: true`, `estadoStock: "OK"`, y el producto aparece en `GET /api/v1/products`

#### Scenario: CP-01.1b Alícuota por defecto del comercio
- **GIVEN** un comercio con IVA por defecto 10,5
- **WHEN** el DUENIO crea un producto sin indicar alícuota
- **THEN** el producto queda con `alicuotaIva` 10,5 (RN-03)

#### Scenario: CP-01.1c Datos inválidos
- **GIVEN** un DUENIO
- **WHEN** envía precio negativo, stock inicial negativo, alícuota mayor a 100, código vacío o nombre de más de 120 caracteres
- **THEN** la API responde 400 `VALIDACION` con `details` que nombra cada campo inválido y no crea nada

### Requirement: Código único por comercio
El sistema SHALL rechazar con 409 `CONFLICTO` un código de producto que ya exista en el mismo comercio, incluidos los productos dados de baja, y SHALL permitir que el mismo código exista en comercios distintos (RN-05).

#### Scenario: CP-01.2 Código repetido en el mismo comercio
- **GIVEN** un comercio con el producto `FA-220`
- **WHEN** el DUENIO intenta crear otro producto con código `FA-220` (o `fa-220`, la comparación no distingue mayúsculas)
- **THEN** la API responde 409 `CONFLICTO` con un mensaje que indica que el código ya existe

#### Scenario: CP-01.2b Código repetido de un producto dado de baja
- **GIVEN** un producto `FA-220` con `activo: false`
- **WHEN** el DUENIO intenta crear otro `FA-220`
- **THEN** la API responde 409 y el mensaje sugiere reactivar el existente

#### Scenario: CP-01.2c Mismo código en dos comercios
- **GIVEN** dos comercios A y B
- **WHEN** cada uno crea un producto con código `FA-220`
- **THEN** ambos se crean y cada comercio ve sólo el suyo

### Requirement: Consulta del catálogo
El sistema SHALL listar los productos del comercio con búsqueda por código o nombre, filtro por estado de stock y por activo, orden alfabético y paginación por cursor, y SHALL devolver un producto por id; DUENIO y EMPLEADO pueden consultar, EMPLEADO sin campos de costo, y CONTADOR recibe 403 (RF-01, §2.4).

#### Scenario: CP-01.3 Búsqueda y filtros
- **GIVEN** un comercio con productos `Filtro Aire FA-220` (stock 47, seguridad 10), `Aceite Mineral 1L` (stock 8, seguridad 10) y `Bujía BI-09` (stock 0)
- **WHEN** consulta `GET /api/v1/products?q=fil` y luego `?estado=BAJO` y luego `?estado=SIN_STOCK`
- **THEN** obtiene respectivamente sólo el filtro de aire, sólo el aceite (`estadoStock: "BAJO"`) y sólo la bujía (`estadoStock: "SIN_STOCK"`)

#### Scenario: CP-01.3b Paginación por cursor
- **GIVEN** un comercio con 5 productos
- **WHEN** consulta `GET /api/v1/products?limit=2` y sigue con el `siguienteCursor` devuelto
- **THEN** recorre los 5 productos en orden alfabético sin repetir ni omitir ninguno y la última página devuelve `siguienteCursor: null`

#### Scenario: CP-01.3c Empleado consulta sin costos
- **GIVEN** un usuario con rol EMPLEADO
- **WHEN** lista productos o consulta uno por id
- **THEN** la respuesta no incluye `costoReposicion` y sí incluye precio de venta y stock

#### Scenario: CP-01.3d Contador sin acceso al catálogo
- **GIVEN** un usuario con rol CONTADOR
- **WHEN** consulta `GET /api/v1/products`
- **THEN** la API responde 403 `SIN_PERMISO`

#### Scenario: CP-01.3e Por defecto sólo activos
- **GIVEN** un comercio con productos activos y dados de baja
- **WHEN** consulta el listado sin filtros
- **THEN** sólo obtiene los activos; con `?activo=false` obtiene los dados de baja

### Requirement: Modificación de producto
El sistema SHALL permitir al DUENIO editar código, nombre, categoría, precio de venta, alícuota, costo de reposición y stock de seguridad, con las mismas validaciones del alta, y SHALL rechazar cambios directos al stock actual, que sólo se modifica por movimientos (RF-02, RN-07).

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

### Requirement: Baja lógica y reactivación
El sistema SHALL dar de baja un producto marcándolo inactivo sin borrarlo, conservando su código y su historial, y SHALL permitir reactivarlo; el producto dado de baja no aparece en el listado por defecto (HU-01 criterio 4).

#### Scenario: CP-01.5 Baja lógica
- **GIVEN** un producto activo
- **WHEN** el DUENIO envía `DELETE /api/v1/products/:id`
- **THEN** la API responde 200 con `activo: false`, el producto desaparece del listado por defecto y sigue accesible por id

#### Scenario: CP-01.5b Reactivación
- **GIVEN** un producto dado de baja
- **WHEN** el DUENIO envía `PATCH /api/v1/products/:id` con `activo: true`
- **THEN** vuelve a aparecer en el listado con su código original

### Requirement: Límite de productos del plan FREE
El sistema SHALL impedir que un comercio con plan FREE tenga más de 50 productos activos, respondiendo 402 `PLAN_REQUERIDO` con `details.planMinimo: "PRO"` al crear o reactivar (HU-14 criterio 4, RF-15).

#### Scenario: CP-01.6 Alta bloqueada al llegar al límite
- **GIVEN** un comercio FREE con 50 productos activos
- **WHEN** el DUENIO intenta crear el número 51 o reactivar uno dado de baja
- **THEN** la API responde 402 `{ code: "PLAN_REQUERIDO", details: { planMinimo: "PRO" } }`

#### Scenario: CP-01.6b Sin límite en PRO
- **GIVEN** el mismo comercio con plan PRO
- **WHEN** crea el producto número 51
- **THEN** se crea normalmente

### Requirement: Aislamiento del catálogo entre comercios
El sistema SHALL garantizar que los productos de un comercio sean invisibles e inalcanzables para otro, también a nivel de base de datos (RNF-10).

#### Scenario: CP-01.7 Acceso cruzado
- **GIVEN** un producto del comercio B
- **WHEN** un DUENIO del comercio A lo consulta, edita o da de baja por id
- **THEN** la API responde 404 `NO_ENCONTRADO` y el producto de B no cambia

#### Scenario: CP-01.7b La base bloquea sin contexto
- **GIVEN** una conexión con el rol de la aplicación sin `app.comercio_id`
- **WHEN** ejecuta `SELECT` sobre `producto`
- **THEN** no obtiene filas
