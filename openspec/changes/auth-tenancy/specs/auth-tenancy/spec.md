## Purpose

Identidad del usuario verificada por Firebase, alta automática del comercio al primer ingreso y aislamiento total de los datos entre comercios (tenants), base de toda otra capacidad del sistema (HU-11, RF-11, RN-10, RNF-03, RNF-10).

## ADDED Requirements

### Requirement: Acceso con identidad verificada
El sistema SHALL aceptar como credencial únicamente un ID token válido del proveedor de identidad (Google o email y contraseña) enviado como `Authorization: Bearer`, y SHALL rechazar con 401 y `code: "NO_AUTENTICADO"` toda solicitud a un endpoint de negocio sin token, con token vencido o alterado (RF-11, RNF-03).

#### Scenario: CP-11.1 Login con Google
- **GIVEN** una persona con cuenta de Google
- **WHEN** inicia sesión con Google desde la web y la web consulta `GET /api/v1/me`
- **THEN** la API responde 200 con su usuario, su comercio, su rol y su plan

#### Scenario: CP-11.1b Login con email y contraseña
- **GIVEN** una persona registrada con email y contraseña
- **WHEN** inicia sesión y consulta `GET /api/v1/me`
- **THEN** la API responde 200 con la misma información que en CP-11.1

#### Scenario: CP-11.1c Sin token o token inválido
- **GIVEN** una solicitud a cualquier endpoint de negocio
- **WHEN** no incluye token, o el token está vencido o alterado
- **THEN** la API responde 401 con `{ code: "NO_AUTENTICADO", message }` y no expone ningún dato

### Requirement: Alta automática del comercio en el primer ingreso
El sistema SHALL crear, en la primera solicitud autenticada de una identidad desconocida y sin invitación pendiente, un Comercio con plan FREE y nombre provisorio y un Usuario con rol DUENIO vinculado a esa identidad, en una única transacción (RN-10, HU-14 criterio 1).

#### Scenario: CP-11.2 Primer ingreso crea comercio y dueño
- **GIVEN** una identidad válida que nunca ingresó y cuyo email no tiene invitación pendiente
- **WHEN** consulta `GET /api/v1/me`
- **THEN** existe un comercio nuevo con plan FREE, el usuario queda como DUENIO activo de ese comercio y la respuesta lo refleja con `onboardingPendiente: true`

#### Scenario: CP-11.2b Ingresos posteriores no duplican
- **GIVEN** una identidad que ya tiene usuario
- **WHEN** vuelve a ingresar, aun varias veces en paralelo
- **THEN** no se crea ningún comercio ni usuario adicional

#### Scenario: CP-11.2c Onboarding completa el nombre del comercio
- **GIVEN** un DUENIO con `onboardingPendiente: true`
- **WHEN** envía `POST /api/v1/me/onboarding` con el nombre del comercio (2 a 120 caracteres)
- **THEN** el comercio queda con ese nombre, `onboardingPendiente` pasa a `false` y un nombre vacío responde 400 `VALIDACION`

#### Scenario: CP-11.2d Datos del comercio editables por el dueño
- **GIVEN** un DUENIO
- **WHEN** envía `PATCH /api/v1/comercio` con nombre, CUIT o alícuota de IVA por defecto
- **THEN** los datos se actualizan y la respuesta devuelve el comercio completo; un EMPLEADO o CONTADOR recibe 403

### Requirement: Aislamiento de datos por comercio
El sistema SHALL devolver, crear, modificar o eliminar únicamente datos del comercio al que pertenece el usuario autenticado, en todo endpoint de negocio, y SHALL garantizarlo también en la base de datos mediante políticas de seguridad por fila, de modo que una consulta que omita el filtro por comercio no devuelva filas de otro comercio (RN-10, RNF-10).

#### Scenario: CP-11.5 Lectura cruzada rechazada
- **GIVEN** dos comercios A y B, cada uno con sus usuarios
- **WHEN** un usuario de A lista usuarios o pide por id un usuario de B
- **THEN** el listado sólo contiene usuarios de A y el pedido por id responde 404 `NO_ENCONTRADO`

#### Scenario: CP-11.5b Escritura cruzada rechazada
- **GIVEN** un DUENIO del comercio A
- **WHEN** intenta modificar el rol de un usuario del comercio B
- **THEN** la API responde 404 y el usuario de B no cambia

#### Scenario: CP-11.5c La base de datos bloquea consultas sin contexto de comercio
- **GIVEN** una conexión a la base con el rol de la aplicación y sin `app.comercio_id` fijado
- **WHEN** ejecuta `SELECT` sobre una tabla de negocio
- **THEN** no obtiene ninguna fila, aunque la tabla tenga datos de varios comercios

#### Scenario: CP-11.5d Identificadores no adivinables
- **GIVEN** cualquier entidad de negocio
- **WHEN** se expone su identificador en la API
- **THEN** es un UUID, no un número secuencial

### Requirement: Usuario inactivo sin acceso
El sistema SHALL rechazar con 403 y `code: "SIN_PERMISO"` toda solicitud de un usuario marcado como inactivo, aunque su token de Firebase sea válido.

#### Scenario: CP-11.6 Usuario dado de baja
- **GIVEN** un usuario que el DUENIO desactivó
- **WHEN** consulta cualquier endpoint de negocio con un token válido
- **THEN** la API responde 403 `SIN_PERMISO` con un mensaje que indica que su acceso fue dado de baja
