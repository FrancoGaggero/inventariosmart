# ADR 0019 · Cambio de plan sin cobro, con límites al bajar y catálogo único

**Estado:** aceptada · 29/09/2026

## Contexto

Los planes ya condicionaban casi todo el sistema: el comercio nace en FREE, las funciones de PRO y PREMIUM responden 402 y FREE limita productos y usuarios. Pero el plan sólo se podía cambiar escribiendo en la base, y qué incluye cada plan estaba escrito a mano en la portada, separado de los bloqueos reales de la API. HU-14 (RF-15) pide que el dueño consulte su plan y lo cambie, con efecto inmediato.

## Decisión

1. **Cambio de plan sin cobro.** `POST /plan/change` cambia el plan en el momento. El proyecto no integra pasarela de pago ni facturación; la pantalla lo dice antes de confirmar. Cada cambio queda registrado.
2. **Efecto inmediato sin tocar sesiones.** El guard de autenticación ya lee el plan de la base en cada request, así que el cambio rige desde el pedido siguiente de cualquier usuario del comercio. No se invalidan tokens.
3. **Bajar de plan no borra datos.** Alertas, órdenes, reportes, remarcaciones y conversaciones quedan guardados y responden 402 hasta que el comercio vuelva a subir.
4. **Para bajar a FREE hay que entrar en sus límites.** Con más de 50 productos activos o más de 1 usuario activo, el cambio responde 409 con cuánto sobra de cada recurso. El dueño da de baja lo que sobra, que tampoco se borra, y vuelve a intentar.
5. **Se cuenta lo activo.** Productos activos y usuarios activos, incluidos los invitados que todavía no ingresaron. Un usuario dado de baja no puede ingresar, así que no impide bajar de plan. La regla de invitaciones de `user-roles` no cambia.
6. **Catálogo único de funcionalidades** en `packages/shared` (`FUNCIONALIDADES`): clave, nombre, descripción y plan mínimo. Lo usan `GET /plan`, la página "Plan" y la portada. Un test e2e recorre una ruta real por funcionalidad y verifica que el 402 informe el mismo plan mínimo que el catálogo.
7. **Regla de cambio como función pura** (`evaluarCambioDePlan`), compartida entre la API, que decide, y la web, que explica.
8. **Cambio atómico.** Bloquea la fila del comercio, cuenta el uso, evalúa, actualiza el plan e inserta en `cambio_plan`, todo en una transacción. Es el mismo bloqueo que usan las altas de productos, así que no entra un producto entre el conteo y el cambio.
9. **Historial de sólo inserción.** `cambio_plan` guarda plan anterior, plan nuevo, quién y cuándo. La API no puede modificarlo ni borrarlo.
10. **Todos los roles consultan; sólo el dueño cambia.** Empleado y contador ven avisos de plan, así que pueden ver qué incluye cada uno.
11. **Los avisos de plan enlazan a la página "Plan".** Lo resuelve `ui/Aviso` para el tono `plan`, en lugar de un componente nuevo: así también lo tienen los avisos que se arman a partir de un error 402.

## Alternativas consideradas

- **Integrar un medio de pago** (Mercado Pago): fuera del alcance del trabajo final; exige cuenta comercial, webhooks y manejo de cobros fallidos. El contrato queda preparado: `POST /plan/change` pasaría a iniciar el cobro.
- **Permitir bajar a FREE por encima de los límites** y bloquear sólo las altas nuevas: deja al comercio en un estado que el sistema no admite y obliga a decidir qué usuarios siguen entrando.
- **Dar de baja automáticamente lo que sobra:** el sistema elegiría qué productos y qué usuarios quedan; es una decisión del dueño.
- **Derivar el catálogo de los decoradores `@RequierePlan`:** no da nombres ni descripciones, y la web y la portada no pueden usarlo.
- **Guardar la ruta de prueba de cada funcionalidad en el catálogo:** publicaría datos de test a la web. El mapa vive en el test, que falla si una funcionalidad paga no tiene ruta.
- **Borrar los datos de planes superiores al bajar:** irreversible y sin beneficio.

## Consecuencias

- Cualquier dueño puede pasar su comercio a PREMIUM sin pagar. El único costo real es el del asistente, acotado por el límite diario de mensajes por comercio y por el saldo prepago del proveedor de IA.
- Ya no hace falta escribir en la base para cambiar un plan. Los cambios hechos así antes de esta decisión no figuran en el historial.
- Sumar una funcionalidad paga implica agregarla al catálogo y al mapa de rutas del test. El test detecta un plan mínimo equivocado, pero no una funcionalidad que nadie agregó al catálogo.
- La portada dejó de ofrecer "Soporte prioritario" en Premium: no es una funcionalidad del sistema.
- `PLANES`, `PlanSchema`, `LIMITES_PLAN` y `planCumple` pasaron del índice de `packages/shared` a `planes.ts`, para que otros módulos los importen sin crear un ciclo.
