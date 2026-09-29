# subscription-plans Specification

## Purpose
Gestión de plan y suscripción (HU-14, RF-15): el comercio consulta su plan vigente, las funcionalidades que incluye y su uso contra los límites, y el dueño cambia de plan con efecto inmediato. Bajar de plan no borra datos y el plan FREE exige entrar en sus límites.

## Requirements

### Requirement: Plan inicial del comercio
Todo comercio SHALL darse de alta con el plan FREE, y su plan SHALL poder consultarse desde el primer ingreso sin haber hecho ningún cambio.

#### Scenario: CP-14.1 Alta en plan FREE
- **GIVEN** una persona que ingresa por primera vez y crea su comercio
- **WHEN** consulta `GET /api/v1/plan`
- **THEN** obtiene `plan: "FREE"`, y el historial de cambios de plan está vacío

### Requirement: Consulta del plan vigente
El sistema SHALL devolver en `GET /api/v1/plan`, a cualquier usuario activo del comercio: el plan vigente; la lista de funcionalidades del sistema, cada una con su nombre, el plan mínimo que la habilita y si está incluida en el plan vigente; los límites del plan (productos y usuarios, o sin límite); y el uso actual, con la cantidad de productos activos y de usuarios activos.

#### Scenario: CP-14.2 Plan vigente, funcionalidades y uso
- **GIVEN** un comercio PRO con 12 productos activos y 3 usuarios activos
- **WHEN** el DUENIO consulta `GET /api/v1/plan`
- **THEN** obtiene `plan: "PRO"`; las alertas de reposición, las órdenes de compra, los reportes semanales, los precios frente a la inflación y la remarcación figuran como incluidas; el comparador de proveedores y el asistente con IA figuran como no incluidas con `planMinimo: "PREMIUM"`; los límites son sin tope; y el uso es de 12 productos y 3 usuarios

#### Scenario: CP-14.2b Plan FREE con sus límites
- **GIVEN** un comercio FREE con 50 productos activos y 1 usuario
- **WHEN** el DUENIO consulta `GET /api/v1/plan`
- **THEN** los límites son 50 productos y 1 usuario, el uso es de 50 productos y 1 usuario, y las funcionalidades de PRO y PREMIUM figuran como no incluidas con su plan mínimo

#### Scenario: CP-14.2c Todos los roles consultan
- **GIVEN** un comercio PRO
- **WHEN** el EMPLEADO y el CONTADOR consultan `GET /api/v1/plan`
- **THEN** los dos obtienen el plan vigente y las funcionalidades

### Requirement: Bloqueo por plan con el plan requerido
Toda funcionalidad no incluida en el plan vigente SHALL responder 402 `PLAN_REQUERIDO` con `details.planMinimo`, y ese plan mínimo SHALL coincidir con el que informa `GET /api/v1/plan` para la misma funcionalidad.

#### Scenario: CP-14.3 La consulta del plan y los bloqueos coinciden
- **GIVEN** un comercio FREE
- **WHEN** el DUENIO consulta cada funcionalidad que `GET /api/v1/plan` informa como no incluida
- **THEN** cada una responde 402 `PLAN_REQUERIDO` con el mismo `planMinimo` que informa la consulta del plan; y las que informa como incluidas no responden 402

### Requirement: Límites del plan FREE
El plan FREE SHALL admitir hasta 50 productos activos y 1 usuario. Al alcanzar un límite, el alta siguiente SHALL rechazarse informando el plan requerido, y `GET /api/v1/plan` SHALL reflejar el uso en el límite.

#### Scenario: CP-14.4 Límites de productos y usuarios
- **GIVEN** un comercio FREE con 50 productos activos y 1 usuario
- **WHEN** el DUENIO intenta crear otro producto e invitar a otro usuario
- **THEN** las dos operaciones responden 402 `PLAN_REQUERIDO` con `planMinimo: "PRO"`, y el uso sigue en 50 productos y 1 usuario

### Requirement: Cambio de plan
El sistema SHALL permitir al DUENIO cambiar el plan del comercio con `POST /api/v1/plan/change` indicando `FREE`, `PRO` o `PREMIUM`. El cambio SHALL regir desde el pedido siguiente de cualquier usuario del comercio, sin cerrar sesión. El cambio a `FREE` SHALL rechazarse con 409 `CONFLICTO` si el comercio tiene más de 50 productos activos o más de 1 usuario activo, informando en `details` la cantidad y el límite de cada uno; los usuarios dados de baja no cuentan. Pedir el plan vigente SHALL responder 409 `CONFLICTO` sin registrar nada. El EMPLEADO y el CONTADOR SHALL recibir 403 `SIN_PERMISO`.

#### Scenario: CP-14.5 Subir de plan habilita de inmediato
- **GIVEN** un comercio FREE cuyo DUENIO recibe 402 al consultar las alertas de reposición
- **WHEN** cambia el plan a `PRO` y vuelve a consultar las alertas con la misma sesión
- **THEN** el cambio responde 200 con `plan: "PRO"`, la consulta de alertas responde 200, y el comparador de proveedores sigue respondiendo 402 con `planMinimo: "PREMIUM"`

#### Scenario: CP-14.5b Bajar de plan restringe de inmediato y conserva los datos
- **GIVEN** un comercio PREMIUM con una orden de compra y una conversación con el asistente, y 10 productos activos y 1 usuario
- **WHEN** el DUENIO cambia el plan a `FREE`
- **THEN** las órdenes y el asistente responden 402; y al volver a `PREMIUM` la orden y la conversación siguen estando

#### Scenario: CP-14.5c Bajar a FREE con datos por encima de los límites
- **GIVEN** un comercio PRO con 60 productos activos y 3 usuarios activos
- **WHEN** el DUENIO pide cambiar a `FREE`
- **THEN** la API responde 409 `CONFLICTO` con `details` que informa 60 productos contra un límite de 50 y 3 usuarios contra un límite de 1; el plan sigue siendo `PRO`; y tras dar de baja 10 productos y 2 usuarios, el mismo pedido responde 200

#### Scenario: CP-14.5d Pedidos inválidos y permisos
- **WHEN** el DUENIO pide el plan que ya tiene, o un plan que no existe; y el EMPLEADO o el CONTADOR piden un cambio
- **THEN** el primero responde 409 `CONFLICTO`, el segundo 400 `VALIDACION`, y los del EMPLEADO y el CONTADOR 403 `SIN_PERMISO`; en ningún caso cambia el plan

### Requirement: Historial de cambios de plan
El sistema SHALL registrar cada cambio de plan con el plan anterior, el plan nuevo, quién lo hizo y cuándo, y SHALL devolverlos en `GET /api/v1/plan/history` al DUENIO, del más reciente al más antiguo y paginados por cursor. Los registros SHALL NOT poder modificarse ni borrarse. Un comercio SHALL ver y cambiar únicamente su propio plan (RNF-10).

#### Scenario: CP-14.5e Historial
- **GIVEN** un comercio que pasó de FREE a PRO y después a PREMIUM
- **WHEN** el DUENIO consulta `GET /api/v1/plan/history`
- **THEN** obtiene dos registros, el primero de `PRO` a `PREMIUM` y el segundo de `FREE` a `PRO`, cada uno con el usuario y la fecha

#### Scenario: CP-14.5f Aislamiento
- **GIVEN** dos comercios, A en PRO y B en FREE
- **WHEN** el dueño de B cambia su plan a PREMIUM
- **THEN** el plan de A sigue siendo `PRO` y su historial no tiene el cambio de B

### Requirement: Plan en la web
La web SHALL ofrecer la página "Plan" a todos los roles, con el plan vigente, el uso contra los límites y la comparación de los tres planes con sus funcionalidades. El DUENIO SHALL poder cambiar de plan con una confirmación que informe qué se habilita o qué deja de estar disponible, y que aclare que el cambio no tiene cobro. Los avisos de funcionalidad no incluida SHALL enlazar a la página "Plan". La portada pública SHALL mostrar las mismas funcionalidades por plan que la página "Plan".

#### Scenario: CP-14.6 Cambiar de plan desde la web
- **GIVEN** un DUENIO de un comercio PRO en la página "Comparador", que muestra el aviso de plan
- **WHEN** sigue el enlace del aviso, elige PREMIUM y confirma
- **THEN** la página "Plan" muestra PREMIUM como plan vigente y, al volver al comparador, ya no ve el aviso

#### Scenario: CP-14.6b No se puede bajar a FREE
- **GIVEN** un DUENIO de un comercio PRO con 60 productos activos
- **WHEN** elige FREE y confirma
- **THEN** ve un aviso que indica que tiene 60 productos y el plan FREE admite 50, y el plan sigue siendo PRO

#### Scenario: CP-14.6c Roles sin permiso de cambio
- **GIVEN** un EMPLEADO en la página "Plan"
- **WHEN** mira los planes
- **THEN** ve el plan vigente y las funcionalidades, y no ve los botones para cambiar de plan
