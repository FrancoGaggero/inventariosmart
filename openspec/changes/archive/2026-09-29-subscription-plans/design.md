## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/subscription-plans/spec.md`.

Estado actual que condiciona el diseño:
- `comercio.plan` existe (`FREE` por defecto) y el guard de autenticación lo lee de la base en cada request. Por eso un cambio de plan rige desde el pedido siguiente sin invalidar sesiones ni tokens.
- `PlanGuard` aplica `@RequierePlan(...)` y responde 402 con `details.planMinimo`. Hoy lo usan alertas, órdenes, reportes, inflación, historial de precios y remarcación (PRO), y comparador y asistente (PREMIUM).
- `LIMITES_PLAN` en `packages/shared` define 50 productos y 1 usuario para FREE. Productos cuenta los activos (`ProductsService.verificarLimite`, importación); usuarios cuenta todos los del comercio al invitar (`UsersService.invitar`).
- Las tareas programadas de alertas y reportes ya filtran por plan PRO o superior.
- La portada tiene su propia lista de funcionalidades por plan, escrita a mano, y 15 pantallas muestran un aviso "Disponible en el plan…" sin enlace.
- El plan sólo se cambia hoy escribiendo en la base.

## Goals / Non-Goals

**Goals:**
- Que la lista de funcionalidades por plan tenga una sola fuente y no pueda contradecir a los bloqueos reales.
- Que bajar de plan nunca deje al comercio en un estado que el sistema no admite.
- Que cambiar de plan no borre ni modifique datos de negocio.

**Non-Goals:**
- Cobro, facturación, precios y vencimientos.
- Cambiar qué plan requiere cada funcionalidad.
- Administración de planes de todos los comercios desde un panel interno.

## Decisions

### D1 · Catálogo de funcionalidades en `packages/shared`
`planes.ts` exporta `FUNCIONALIDADES`: una lista con `clave`, `nombre`, `descripcion` y `planMinimo`. Incluye las de FREE (inventario, movimientos, panel, importación, proveedores y gastos), las de PRO (alertas, órdenes, reportes, inflación, remarcación) y las de PREMIUM (comparador, asistente). La API arma con ella la respuesta de `GET /plan`; la web, la página "Plan" y la portada.

Para que el catálogo no se desvíe de los bloqueos reales, un test e2e recorre las funcionalidades con ruta asociada y verifica que en FREE respondan 402 con el mismo `planMinimo` (CP-14.3). El mapa de rutas vive en el test, no en el catálogo: así lo que se publica a la web no lleva datos de prueba, y el test falla si una funcionalidad paga no tiene ruta asociada.

Alternativa: derivar el catálogo leyendo los decoradores en tiempo de ejecución. Descartada: no da nombres ni descripciones, y la web y la portada no pueden usarlo.

### D2 · Regla de cambio, función pura
`evaluarCambioDePlan(actual, nuevo, uso)` en `packages/shared` devuelve `{ permitido: true }` o `{ permitido: false, motivo, excesos }`. Motivos: `MISMO_PLAN` y `SUPERA_LIMITES`. `excesos` lista `{ recurso, cantidad, limite }` para productos y usuarios. La web la usa para avisar antes de confirmar; la API es la que decide.

### D3 · Uso del comercio
`uso.productos`: productos activos. `uso.usuarios`: usuarios activos. Dos `count` sobre índices existentes. La regla de invitación de `user-roles` no cambia y sigue contando todos los usuarios: en FREE, con el dueño ya alcanza el límite.

### D4 · Cambio atómico con historial
`PlansService.cambiar(plan)` corre en `transaccionTenant`: bloquea la fila del comercio con `FOR UPDATE`, cuenta el uso, evalúa D2, actualiza `comercio.plan` e inserta en `cambio_plan`. El bloqueo evita que dos cambios simultáneos registren el mismo plan anterior. Entre el conteo y el cambio podría crearse un producto; el bloqueo del comercio que ya usa el alta de productos (`ProductsService.bloquearComercio`) lo serializa.

### D5 · Persistencia
Migración `20261003_subscription_plans`:
- `cambio_plan`: `id`, `comercio_id`, `usuario_id`, `plan_anterior`, `plan_nuevo`, `creado_en`. Índice `(comercio_id, creado_en DESC, id DESC)`. `CHECK (plan_anterior <> plan_nuevo)`.
- Lleva `comercio_id`, políticas RLS `cambio_plan_tenant` y `cambio_plan_sistema`, y entra en `TENANT_MODELS`. Sólo inserción y lectura para `app_api`.
- No hay relleno inicial: los cambios hechos a mano en la base antes de esta change no tienen registro.

`comercio` no cambia. Verificar en la migración que `app_api` pueda actualizar `comercio.plan`; si el permiso de `UPDATE` sobre `comercio` es por columnas, sumar `plan`.

### D6 · API
| Método y ruta | Roles | Plan |
|---|---|---|
| `GET /api/v1/plan` | DUENIO, EMPLEADO, CONTADOR | todos |
| `POST /api/v1/plan/change` `{ plan }` → 200 con el mismo cuerpo que `GET /plan` | DUENIO | todos |
| `GET /api/v1/plan/history?cursor&limit` | DUENIO | todos |

`GET /plan`: `{ plan, limites: { productos, usuarios }, uso: { productos, usuarios }, funcionalidades: [{ clave, nombre, descripcion, planMinimo, incluida }] }`. Límite `null` significa sin tope.

409 al bajar a FREE: `details: { motivo: 'SUPERA_LIMITES', excesos: [{ recurso: 'productos', cantidad: 60, limite: 50 }, …] }`. 409 por mismo plan: `details: { motivo: 'MISMO_PLAN' }`.

Módulo nuevo `PlansModule`. Se tocan `packages/shared`, el contrato OpenAPI y `packages/api-client`.

### D7 · Web
- `features/config/PlanPage.tsx` en `/configuracion/plan`, para todos los roles: plan vigente, barras de uso contra los límites (`ui/Barra`), las tres columnas de planes con sus funcionalidades y, para el DUENIO, el botón de cada plan y el historial de cambios.
- Cambio con `ui/Confirmar`: al subir lista lo que se habilita; al bajar, lo que deja de estar disponible y que los datos se conservan. Siempre aclara que el cambio no tiene cobro.
- Al cambiar se invalida la sesión en caché (`ME_KEY`) y todas las consultas, porque cualquiera puede pasar de 402 a 200 o al revés.
- `ui/Aviso` agrega el enlace "Ver planes" a todo aviso de tono `plan`. No se creó un componente aparte: así lo tienen las 15 pantallas sin tocarlas y también los avisos que se arman a partir de un error 402.
- La portada arma sus tres tarjetas con `FUNCIONALIDADES`.
- `lib/plan.ts` (hooks) y `lib/plan-formato.ts` (textos puros con test).
- Enlace "Plan" en la navegación, para todos los roles.

### D8 · Tests
- Shared `planes.test.ts`: catálogo (claves únicas, toda funcionalidad con plan válido), `evaluarCambioDePlan` con subir, bajar, mismo plan y excesos de uno y de los dos recursos.
- e2e `plans.e2e-spec.ts`: CP-14.1 a CP-14.5f, incluido el recorrido de CP-14.3 contra las rutas reales y la conservación de datos de CP-14.5b.
- `rls.e2e-spec.ts`: `cambio_plan` con RLS y sin `UPDATE` ni `DELETE`.
- Web: test de `plan-formato`.

### D9 · Documentación
ADR 0019 (cambio de plan sin cobro, inmediato, con límites al bajar y catálogo único); README; `docs/arquitectura.html` (módulo `plans` con sus tres rutas; la arquitectura preveía `GET /plan` y `POST /plan/change`); `docs/runbooks/deploy.md` (ya no hace falta cambiar el plan en la base); `openspec/CAPACIDADES.md`.

## Risks / Trade-offs

- [Cualquier dueño se pasa a PREMIUM gratis] → es el alcance del trabajo final, sin pasarela de pago. La pantalla lo dice, el ADR lo registra y el historial deja constancia de cada cambio.
- [El asistente tiene costo real por uso] → el límite diario por comercio (`ASISTENTE_LIMITE_DIARIO`) y el saldo prepago acotan el gasto aunque varios comercios suban a PREMIUM.
- [El catálogo se desactualiza cuando se suma una funcionalidad] → el test de CP-14.3 falla si una ruta del catálogo no responde con el plan esperado; lo que no detecta es una funcionalidad nueva que nadie agregó al catálogo.
- [Bajar a FREE obliga a dar de baja productos] → el rechazo informa cuánto sobra; dar de baja no borra y se puede reactivar al volver a subir.
- [Reemplazar 15 avisos toca muchas pantallas] → cambio mecánico; se verifica con typecheck y una pasada visual.
- [Cambios hechos a mano en la base no figuran en el historial] → se documenta; desde esta change el plan se cambia por la API.

## Migration Plan

1. Deploy de la API: la migración crea `cambio_plan`.
2. Deploy de la web.

Rollback: revertir el commit. La tabla puede quedar.

## Open Questions

- ¿Conviene que subir a PREMIUM pida una confirmación extra por el costo del asistente? No cambia el contrato.
- Si más adelante se integra un medio de pago, `POST /plan/change` pasaría a iniciar el cobro y el cambio real lo haría la confirmación del pago.
