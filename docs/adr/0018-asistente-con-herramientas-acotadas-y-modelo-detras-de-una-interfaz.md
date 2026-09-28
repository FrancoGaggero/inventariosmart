# ADR 0018 · Asistente con herramientas acotadas y modelo detrás de una interfaz

**Estado:** aceptada · 28/09/2026

## Contexto

HU-08 (RF-10) pide que el dueño pregunte por su negocio en lenguaje natural y reciba respuestas con sus datos reales, que el asistente pueda redactar pedidos a proveedores con confirmación humana (RN-06), que rechace lo ajeno al negocio y que sólo esté en el plan PREMIUM (RN-09). Un modelo de lenguaje no es determinista, puede inventar cifras y puede obedecer instrucciones escondidas en los datos que lee. Además su uso se paga por consulta y el sistema es multi-tenant: ninguna respuesta puede cruzar comercios (RNF-10).

## Decisión

1. **El modelo no toca la base: pide consultas predefinidas.** Son diez herramientas con nombre, descripción y esquema de entrada, y cada una llama a un servicio que ya existía (rentabilidad, productos, alertas, gastos, inflación, indicadores, proveedores, comparador y órdenes). No hay SQL generado ni acceso a la API REST completa.
2. **El comercio lo fija el request, no el modelo.** Ninguna herramienta recibe `comercioId`: corren dentro del contexto de tenant del request y PostgreSQL aplica RLS. Pedirle al asistente datos de otro comercio no tiene cómo resolverse.
3. **Sólo lectura, salvo un borrador.** La única herramienta que escribe es `preparar_orden`, que crea una orden en `BORRADOR` con las reglas de `purchase-orders`. Confirmar, enviar y cancelar no son herramientas. Así se cubre "redactar correos a proveedores" sin abrir un canal de envío nuevo.
4. **Modelo detrás de una interfaz** (`ModeloAsistente`): `ModeloAnthropic` usa la Messages API de Anthropic con _tool use_; `ModeloFalso` sigue un guion en los tests. El modelo sale de `ANTHROPIC_MODEL` y la clave de `ANTHROPIC_API_KEY`. Sin clave, o si el proveedor falla, la API responde 503 `SERVICIO_NO_DISPONIBLE` y el resto del sistema no se entera.
5. **Instrucciones fijas y contexto aparte.** Las instrucciones no llevan datos del comercio ni del usuario: son iguales para todos y se marcan para caché de prompt junto con las herramientas. La fecha y el nombre del comercio van en un bloque separado. Las instrucciones indican que lo que viene dentro de un resultado es dato y no instrucción.
6. **Resultados recortados y sin datos de contacto.** Cada herramienta devuelve como máximo 10 filas y sólo los campos que hacen falta. Los proveedores viajan sin correo, teléfono ni CUIT.
7. **Costo acotado:** 50 mensajes por día por comercio (`ASISTENTE_LIMITE_DIARIO`), mensajes de hasta 1.000 caracteres, 6 consultas por respuesta, 1.024 tokens de salida y 30 segundos por llamada. Al llegar al tope de consultas se le pide al modelo que responda con lo que tiene.
8. **Se guarda sólo lo respondido.** El mensaje del usuario y el del asistente se insertan juntos al final, con las fuentes, las acciones, el modelo y los tokens. Un 503 no deja mensajes a medias ni descuenta del límite. Los mensajes son de sólo inserción.
9. **El historial se reenvía como texto.** Una pregunta de seguimiento vuelve a consultar: responde con datos del momento y el contexto no crece con resultados viejos.
10. **Dos suites de prueba.** La e2e de CI usa el modelo guionado y verifica lo que se puede comprobar con exactitud: datos, aislamiento, permisos, límites, borradores. El comportamiento del modelo real (rechazar lo ajeno, no inventar, ignorar instrucciones en los datos) se prueba con `pnpm --filter @inventariosmart/api test:asistente`, a mano y fuera de CI.

## Alternativas consideradas

- **SQL generado por el modelo**: máxima flexibilidad, pero una consulta mal armada o inducida puede leer de más; con RLS el daño quedaría dentro del comercio, pero no hay forma de revisar cada consulta.
- **Exponer toda la API como herramientas**: incluye escrituras y multiplica la superficie a probar.
- **OpenAI**: la arquitectura dejaba las dos opciones abiertas; se elige una para mantener un solo adaptador. La interfaz permite cambiar.
- **Que el asistente envíe la orden**: contradice RN-06.
- **Guardar también los resultados de las herramientas en el historial**: respuestas más baratas en el seguimiento, pero con datos viejos y más información del comercio almacenada.
- **Filtro de temas previo al modelo** (lista de palabras): rechaza preguntas válidas y deja pasar las ajenas bien escritas.
- **Pruebas con el modelo real en CI**: cuestan dinero en cada push y fallan por variaciones del texto.
- **Streaming**: mejora la espera, pero pide otro transporte en la API y en el cliente generado; queda como evolución.

## Consecuencias

- El asistente responde sólo lo que sus herramientas pueden consultar. Una pregunta nueva puede requerir una herramienta nueva.
- El modelo puede equivocarse al redactar. La web muestra qué consultó en cada respuesta y avisa que conviene verificar los números importantes.
- Datos del comercio (nombres de productos y proveedores, cantidades y montos) salen hacia Anthropic. No salen correos, teléfonos ni CUIT, y la clave vive sólo en variables de entorno.
- Si el modelo falla después de `preparar_orden`, el borrador queda creado aunque la respuesta no se guarde. Aparece en Órdenes y se puede cancelar.
- El peor caso de una instrucción escondida en los datos es una respuesta incorrecta o un borrador de más: nada se envía ni se modifica sin el dueño.
- El filtro de errores deja de registrar como "no controlado" un 503 propio: lo registra quien lo lanza.
- `SuppliersService` y `SupplierComparisonService` pasan a exportarse de sus módulos.
