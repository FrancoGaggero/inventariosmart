## MODIFIED Requirements

### Requirement: Consulta del plan vigente
El sistema SHALL devolver en `GET /api/v1/plan`, a cualquier usuario activo del comercio: el plan vigente; la lista de funcionalidades del sistema, cada una con su nombre, el plan mínimo que la habilita y si está incluida en el plan vigente; los límites del plan (productos y usuarios, o sin límite); y el uso actual, con la cantidad de productos activos y de usuarios activos.

#### Scenario: CP-14.2 Plan vigente, funcionalidades y uso
- **GIVEN** un comercio PRO con 12 productos activos y 3 usuarios activos
- **WHEN** el DUENIO consulta `GET /api/v1/plan`
- **THEN** obtiene `plan: "PRO"`; las alertas de reposición, las pérdidas por falta de stock, las órdenes de compra, los reportes semanales, los precios frente a la inflación y la remarcación figuran como incluidas; el comparador de proveedores y el asistente con IA figuran como no incluidas con `planMinimo: "PREMIUM"`; los límites son sin tope; y el uso es de 12 productos y 3 usuarios

#### Scenario: CP-14.2b Plan FREE con sus límites
- **GIVEN** un comercio FREE con 50 productos activos y 1 usuario
- **WHEN** el DUENIO consulta `GET /api/v1/plan`
- **THEN** los límites son 50 productos y 1 usuario, el uso es de 50 productos y 1 usuario, y las funcionalidades de PRO y PREMIUM figuran como no incluidas con su plan mínimo

#### Scenario: CP-14.2c Todos los roles consultan
- **GIVEN** un comercio PRO
- **WHEN** el EMPLEADO y el CONTADOR consultan `GET /api/v1/plan`
- **THEN** los dos obtienen el plan vigente y las funcionalidades
