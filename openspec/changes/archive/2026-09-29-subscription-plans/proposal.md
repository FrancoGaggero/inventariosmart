## Why

Los planes ya condicionan casi todo el sistema: el comercio nace en FREE, las funciones de PRO y PREMIUM responden 402 y el plan FREE limita productos y usuarios. Pero el dueño no tiene dónde ver qué incluye su plan ni cómo cambiarlo: hoy el plan sólo se modifica escribiendo en la base. Para probar el comparador y el asistente hubo que pasar el comercio de la demo a PREMIUM a mano.

Esta change construye **HU-14 "Gestión de plan y suscripción"** (RF-15; RN-09), de la **Fase 3**. Es la última historia del backlog y cierra lo que las demás dieron por supuesto.

## What Changes

- **Consultar el plan** (`GET /plan`): plan vigente, funcionalidades incluidas y no incluidas con el plan que requiere cada una, y el uso actual contra los límites (productos y usuarios).
- **Cambiar de plan** (`POST /plan/change`): el dueño elige FREE, PRO o PREMIUM. El cambio rige desde el pedido siguiente, sin cerrar sesión.
- **Bajar de plan sin perder datos**: nada se borra. Lo que pertenece a un plan superior (alertas, órdenes, reportes, remarcaciones, conversaciones) queda guardado y vuelve a estar disponible al subir de plan.
- **Bajar a FREE exige entrar en sus límites**: si el comercio tiene más de 50 productos activos o más de 1 usuario activo, el cambio se rechaza e informa cuánto sobra.
- **Historial de cambios** (`GET /plan/history`): quién cambió el plan, cuándo, y de cuál a cuál.
- **Un solo catálogo de funcionalidades** en `packages/shared`, que usan la API, la página de plan y la portada, para que no digan cosas distintas.
- **Web**: página "Plan" con el plan actual, el uso, la comparación de los tres planes y el cambio con confirmación; los avisos "Disponible en el plan…" enlazan a esa página.
- **Contrato**: shared, OpenAPI y cliente regenerados. **Con migración**: una tabla nueva.

Supuestos registrados (para revisar antes de aplicar):
- **Sin cobro.** El cambio de plan es inmediato y no pasa por un medio de pago: el proyecto no integra pasarela ni facturación. La pantalla lo dice. Integrar Mercado Pago queda como evolución.
- **Sin precios.** La portada hoy dice "Gratis" y "Mensual" sin montos; se mantiene así.
- **Sólo el DUENIO cambia el plan.** EMPLEADO y CONTADOR pueden consultarlo, porque ven los avisos de plan.
- **Bajar a FREE con datos de más se rechaza**, en lugar de permitirlo y dejar al comercio fuera de los límites. El dueño da de baja productos o usuarios y vuelve a intentar.
- **Para bajar a FREE se cuenta lo activo**: productos activos y usuarios activos. Un usuario dado de baja no puede ingresar, así que no impide bajar de plan. La regla de invitaciones de `user-roles` no cambia: en FREE no se puede invitar a nadie más.
- **Las tareas programadas ya respetan el plan** (alertas y reportes sólo corren para PRO y PREMIUM); no cambian.

## Capabilities

### New Capabilities

- `subscription-plans`: consulta del plan con funcionalidades y uso, cambio de plan con sus reglas, efecto inmediato, conservación de datos e historial de cambios.

### Modified Capabilities

Ninguna. El alta en FREE, los bloqueos por plan y los límites de FREE ya están especificados en `auth-tenancy`, `user-roles` y `product-catalog`; esta change los consulta y no los modifica.

## Impact

- **Código:** `packages/shared` `planes.ts` (catálogo de funcionalidades, esquemas, regla de cambio); `apps/api` módulo nuevo `plans` (servicio, controller, DTOs); `packages/api-client` regenerado; `apps/web` `lib/plan.ts`, `lib/plan-formato.ts`, `features/config/PlanPage.tsx`, `ui/Aviso` con enlace a la página de plan, portada con el catálogo compartido, enlace en la navegación.
- **Base de datos:** migración con `cambio_plan` (con `comercio_id` y RLS, sólo inserción).
- **Documentación:** ADR 0019 (cambio de plan sin cobro y con límites al bajar), README, `docs/arquitectura.html`, `openspec/CAPACIDADES.md`.
- **Trazabilidad:** CU-14, casos CP-14.1 a CP-14.5.
- **Fuera de alcance:** cobro, facturación, precios, períodos de prueba, vencimientos, cupones, cambio de plan programado, plan por usuario, límites configurables, panel de administración de todos los comercios, app Android.
