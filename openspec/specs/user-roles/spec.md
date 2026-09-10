# user-roles Specification

## Purpose
Roles DUENIO, EMPLEADO y CONTADOR con sus permisos sobre las funciones del sistema, gestión de los usuarios de un comercio por parte del dueño y límite de usuarios del plan FREE (HU-11, RF-11, Propuesta §2.4, RN-06, RN-09).

## Requirements

### Requirement: Permisos por rol
El sistema SHALL restringir cada función según el rol del usuario dentro de su comercio: DUENIO acceso total; EMPLEADO consulta del catálogo y registro de movimientos, sin costos, márgenes, gastos, dashboard financiero ni configuración; CONTADOR sólo lectura de dashboard y reportes. Toda función no permitida SHALL responder 403 con `code: "SIN_PERMISO"` (Propuesta §2.4).

#### Scenario: CP-11.4 Empleado no accede a configuración ni datos financieros
- **GIVEN** un usuario con rol EMPLEADO
- **WHEN** solicita el dashboard financiero, los gastos o la configuración del comercio
- **THEN** la API responde 403 `SIN_PERMISO`

#### Scenario: CP-11.4b Empleado no ve campos sensibles
- **GIVEN** un usuario con rol EMPLEADO
- **WHEN** consulta un recurso que incluye costo, margen bruto o margen neto
- **THEN** la respuesta omite esos campos, sin cambiar la ruta ni el resto de la estructura

#### Scenario: CP-11.4c Contador sólo lectura
- **GIVEN** un usuario con rol CONTADOR
- **WHEN** intenta crear, editar o eliminar cualquier dato operativo
- **THEN** la API responde 403 y el dato no cambia; sus consultas de lectura de dashboard y reportes responden 200

#### Scenario: CP-11.4d El rol se resuelve en cada solicitud
- **GIVEN** un usuario cuyo rol cambió de DUENIO a CONTADOR
- **WHEN** realiza la siguiente solicitud con el mismo token
- **THEN** ya rige el rol nuevo, sin volver a iniciar sesión

### Requirement: Gestión de usuarios del comercio
El sistema SHALL permitir al DUENIO listar los usuarios de su comercio, invitar a un usuario por email con un rol, cambiar el rol de un usuario y desactivarlo o reactivarlo. EMPLEADO y CONTADOR SHALL recibir 403 en estas funciones (HU-11 criterio 3).

#### Scenario: CP-11.3 Invitar un usuario
- **GIVEN** un DUENIO con plan PRO
- **WHEN** envía `POST /api/v1/users` con email válido y rol EMPLEADO
- **THEN** se crea un usuario del comercio con ese email, ese rol y estado "invitado" (sin identidad vinculada), y el listado lo muestra

#### Scenario: CP-11.3b El invitado entra al comercio correcto
- **GIVEN** una invitación pendiente para `ana@comercio.com` con rol EMPLEADO
- **WHEN** Ana inicia sesión por primera vez con Google o email usando esa dirección
- **THEN** su identidad queda vinculada al usuario invitado, no se crea otro comercio y `GET /api/v1/me` la muestra como EMPLEADO del comercio que la invitó

#### Scenario: CP-11.3c Cambiar rol y desactivar
- **GIVEN** un DUENIO y un usuario EMPLEADO de su comercio
- **WHEN** envía `PATCH /api/v1/users/:id` con `rol: "CONTADOR"` o con `activo: false`
- **THEN** el cambio aplica en la siguiente solicitud del usuario afectado

#### Scenario: CP-11.3d El dueño no puede quedarse sin acceso
- **GIVEN** el único DUENIO activo del comercio
- **WHEN** intenta cambiar su propio rol o desactivarse
- **THEN** la API responde 400 `VALIDACION` con un mensaje que explica que el comercio necesita al menos un dueño activo

#### Scenario: CP-11.3e Email repetido
- **GIVEN** un email que ya pertenece a un usuario de cualquier comercio
- **WHEN** un DUENIO lo invita
- **THEN** la API responde 409 con `code: "CONFLICTO"` y un mensaje que indica que ese email ya está en uso (RN-10)

#### Scenario: CP-11.3f Sólo el dueño administra usuarios
- **GIVEN** un usuario con rol EMPLEADO o CONTADOR
- **WHEN** intenta listar, invitar o modificar usuarios
- **THEN** la API responde 403 `SIN_PERMISO`

### Requirement: Límite de usuarios del plan FREE
El sistema SHALL impedir que un comercio con plan FREE tenga más de 1 usuario, respondiendo 402 con `code: "PLAN_REQUERIDO"` y `details.planMinimo: "PRO"` al intentar invitar (HU-14 criterio 4, RF-15).

#### Scenario: CP-11.7 Invitación bloqueada en plan FREE
- **GIVEN** un comercio con plan FREE que ya tiene su DUENIO
- **WHEN** el DUENIO intenta invitar a otro usuario
- **THEN** la API responde 402 `{ code: "PLAN_REQUERIDO", details: { planMinimo: "PRO" } }` y no se crea la invitación

#### Scenario: CP-11.7b Invitación permitida en plan PRO
- **GIVEN** el mismo comercio con plan PRO
- **WHEN** el DUENIO invita a otro usuario
- **THEN** la invitación se crea (CP-11.3)
