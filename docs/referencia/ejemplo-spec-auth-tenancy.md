## ADDED Requirements

### Requirement: Inicio de sesión con proveedor de identidad externo
El sistema SHALL aceptar como credencial un token de identidad emitido por el proveedor de autenticación (Google o email y contraseña) y SHALL rechazar toda solicitud a la API sin un token válido (RF-11, RNF-03).

#### Scenario: CP-11.1 Login con Google
- **GIVEN** un usuario con cuenta de Google
- **WHEN** inicia sesión con Google desde la web o la app
- **THEN** obtiene acceso a la API con su identidad y ve su comercio

#### Scenario: CP-11.1b Token ausente o inválido
- **GIVEN** una solicitud a cualquier endpoint de negocio
- **WHEN** no incluye token o el token está vencido o alterado
- **THEN** la API responde 401 con `{ code: "NO_AUTENTICADO" }` y no expone datos

### Requirement: Alta automática del comercio en el primer ingreso
El sistema SHALL crear el comercio con plan FREE y el usuario con rol DUENIO la primera vez que una identidad válida ingresa, sin pasos adicionales (HU-14 criterio 1, RN-10).

#### Scenario: CP-11.2 Primer ingreso
- **GIVEN** una identidad válida que nunca ingresó
- **WHEN** consulta `GET /me`
- **THEN** existe un comercio nuevo con plan FREE, el usuario queda asociado como DUENIO y la respuesta incluye comercio, rol y plan

#### Scenario: CP-11.2b Ingresos posteriores
- **GIVEN** una identidad que ya tiene usuario
- **WHEN** vuelve a ingresar
- **THEN** no se crea otro comercio ni otro usuario

### Requirement: Aislamiento de datos por comercio
El sistema SHALL devolver únicamente datos del comercio al que pertenece el usuario autenticado, en todo endpoint de negocio (RN-10, RNF-10).

#### Scenario: CP-11.5 Lectura cruzada rechazada
- **GIVEN** dos comercios A y B con productos propios
- **WHEN** un usuario de A lista productos o pide por id un producto de B
- **THEN** el listado sólo contiene productos de A y el pedido por id responde 404

#### Scenario: CP-11.5b Escritura cruzada rechazada
- **GIVEN** un usuario del comercio A
- **WHEN** intenta registrar un movimiento sobre un producto del comercio B
- **THEN** la API responde 404 y no se crea ningún registro

### Requirement: Permisos por rol
El sistema SHALL restringir cada función según el rol del usuario: DUENIO acceso total; EMPLEADO consulta de catálogo y registro de movimientos sin costos, márgenes ni dashboard; CONTADOR sólo lectura de dashboard y reportes (§2.4 Propuesta).

#### Scenario: CP-11.4 Empleado no ve costos
- **GIVEN** un usuario con rol EMPLEADO
- **WHEN** consulta el listado de productos
- **THEN** la respuesta no incluye costo, margen bruto ni margen neto

#### Scenario: CP-11.4b Empleado sin dashboard
- **GIVEN** un usuario con rol EMPLEADO
- **WHEN** solicita el dashboard financiero
- **THEN** la API responde 403 con `{ code: "SIN_PERMISO" }`

#### Scenario: CP-11.4c Contador sólo lectura
- **GIVEN** un usuario con rol CONTADOR
- **WHEN** intenta crear, editar o eliminar un producto, proveedor o gasto
- **THEN** la API responde 403 y el dato no cambia

### Requirement: Gestión de usuarios del comercio
El sistema SHALL permitir al DUENIO invitar usuarios a su comercio, asignarles rol DUENIO, EMPLEADO o CONTADOR y darlos de baja (HU-11 criterio 3).

#### Scenario: CP-11.3 Asignar rol
- **GIVEN** un DUENIO y un usuario de su comercio
- **WHEN** cambia el rol del usuario a CONTADOR
- **THEN** el cambio aplica en la siguiente solicitud del usuario afectado, sin necesidad de volver a iniciar sesión

#### Scenario: CP-11.3b Sólo el dueño administra usuarios
- **GIVEN** un usuario con rol EMPLEADO o CONTADOR
- **WHEN** intenta listar, invitar o modificar usuarios
- **THEN** la API responde 403

#### Scenario: CP-11.3c Límite del plan FREE
- **GIVEN** un comercio con plan FREE que ya tiene 1 usuario
- **WHEN** el DUENIO intenta invitar a otro
- **THEN** la API responde 402 con `{ code: "PLAN_REQUERIDO", details: { planMinimo: "PRO" } }`
