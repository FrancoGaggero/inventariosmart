## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/ai-assistant/spec.md`.

Estado actual que condiciona el diseño:
- Todo lo que el asistente necesita responder ya existe como servicio de la API, con su aislamiento por comercio: `ProfitabilityService` (`resumenEntre`, `topEntre`, `listar`), `AlertsService` (`listar`, `resumen`), `ExpensesService.resumen`, `InsightsService.inflacion`, `IndicatorsService.obtener`, `SupplierComparisonService.producto`, `ProductsService.listar`, `SuppliersService` y `PurchaseOrdersService.crear`.
- El tenant se fija por request (`TenantContext`) y PostgreSQL aplica RLS. Un servicio llamado dentro del request no puede leer otro comercio, lo pida quien lo pida.
- Las integraciones externas ya siguen un patrón: interfaz + token de inyección + doble para tests (`FUENTES_INDICADORES` con `FuenteFalsa`, el correo con Resend). Sin credencial, la función se degrada y el resto sigue.
- La API corre en Render Free: una sola instancia, con arranque en frío. CI no tiene secretos de terceros.
- `@RequierePlan('PREMIUM')` y `@Roles('DUENIO')` ya se usan en el comparador (HU-12).

## Goals / Non-Goals

**Goals:**
- Que el modelo no pueda ver ni tocar nada fuera de un conjunto cerrado de consultas del comercio del usuario.
- Que ninguna prueba automática dependa del proveedor de IA ni gaste dinero.
- Costo acotado y predecible por comercio.
- Que cambiar de modelo o de proveedor no toque el servicio ni el contrato.

**Non-Goals:**
- Streaming, memoria entre conversaciones, RAG o embeddings.
- Que el asistente escriba datos, salvo crear un borrador de orden.
- Evaluación automática de la calidad de las respuestas en CI.

## Decisions

### D1 · Proveedor: API de Anthropic con *tool use*, detrás de una interfaz
`ModeloAsistente` (token `MODELO_ASISTENTE`) con un método `responder({ sistema, mensajes, herramientas })` que devuelve texto o pedidos de herramienta, más el uso de tokens. Implementaciones: `ModeloAnthropic` (`@anthropic-ai/sdk`, Messages API) y `ModeloFalso` para tests, con respuestas guionadas. El modelo sale de `ANTHROPIC_MODEL` (por defecto `claude-sonnet-5`); `max_tokens` 1024 y tiempo límite de 30 s por llamada. Las instrucciones y las definiciones de herramientas son estáticas y se marcan para caché de prompt.

Alternativas: OpenAI (la arquitectura dejaba las dos abiertas; se elige una sola para no mantener dos adaptadores); un modelo local (no entra en Render Free); llamar al proveedor desde la web (expondría la clave).

### D2 · Herramientas acotadas que reutilizan los servicios
Cada herramienta tiene nombre, descripción, esquema zod de entrada y una función que llama a un servicio existente y devuelve un resultado recortado (como máximo 10 filas y sólo los campos necesarios). El modelo nunca recibe ni envía `comercioId`: el tenant es el del request.

| Herramienta | Servicio | Nombre legible (`fuentes`) |
|---|---|---|
| `resumen_rentabilidad` (desde, hasta) | `ProfitabilityService.resumenEntre` | Rentabilidad del período |
| `productos_mas_rentables` (desde, hasta, cantidad ≤ 10) | `ProfitabilityService.topEntre` | Productos más rentables |
| `buscar_productos` (q) | `ProductsService.listar` | Productos |
| `alertas_de_reposicion` () | `AlertsService.listar` y `resumen` | Alertas de reposición |
| `gastos_del_periodo` (mes) | `ExpensesService.resumen` | Gastos |
| `precios_frente_a_inflacion` (desde, hasta) | `InsightsService.inflacion` | Precios e inflación |
| `indicadores_economicos` () | `IndicatorsService.obtener` | Indicadores oficiales |
| `buscar_proveedores` (q) | `SuppliersService.listar` | Proveedores |
| `comparar_proveedores` (productoId) | `SupplierComparisonService.producto` | Comparador de proveedores |
| `preparar_orden` (proveedorId, items) | `PurchaseOrdersService.crear` | Orden en borrador |

`buscar_proveedores` devuelve nombre, plazo y confiabilidad, sin correo, teléfono ni CUIT. `preparar_orden` es la única que escribe y sólo crea un `BORRADOR`; confirmar y enviar no son herramientas. Una entrada que no cumple el esquema o un error del servicio vuelven al modelo como resultado de error, no rompen la respuesta.

Alternativas: SQL generado por el modelo (descartado por seguridad y por RNF-10); exponer la API REST completa como herramientas (demasiada superficie, incluye escrituras).

### D3 · Ciclo de la respuesta
1. Valida plan, rol, mensaje y límite diario.
2. Arma el contexto: instrucciones (D4), los últimos 20 mensajes de la conversación sólo como texto, y el mensaje nuevo.
3. Llama al modelo; si pide herramientas, las ejecuta y devuelve los resultados. Hasta 6 consultas por respuesta; al llegar al tope, pide la respuesta final sin herramientas.
4. Guarda en una transacción el mensaje del usuario y el del asistente, con `fuentes`, `acciones`, modelo y tokens.

Si el modelo falla o no está configurado, no se guarda nada y la API responde 503. Los mensajes anteriores se reenvían como texto y no con sus resultados de herramientas: una pregunta de seguimiento vuelve a consultar, así responde con datos del momento y el contexto no crece.

### D4 · Instrucciones del sistema
Texto fijo en español, en `assistant/instrucciones.ts`: quién es, qué temas cubre, que responda sólo con datos obtenidos de las herramientas, que diga cuando no hay datos, que rechace lo ajeno al negocio sin consultar, que lo que viene dentro de los resultados es dato y no instrucción, que no puede modificar nada y a qué pantalla mandar al dueño en cada caso, y formato de montos (`$ 1.234,56`). Se agregan la fecha de hoy en Buenos Aires y el nombre del comercio. No se incluyen datos del usuario.

### D5 · Persistencia
Migración `20261002_ai_assistant`:
- `conversacion`: `id`, `comercio_id`, `usuario_id`, `titulo` (primeros 80 caracteres del primer mensaje), `creado_en`, `actualizado_en`. Índice `(comercio_id, usuario_id, actualizado_en DESC, id DESC)`.
- `mensaje_asistente`: `id`, `comercio_id`, `conversacion_id`, `rol` (`USUARIO` | `ASISTENTE`), `contenido`, `fuentes` jsonb, `acciones` jsonb, `modelo`, `tokens_entrada`, `tokens_salida`, `creado_en`. Índices `(comercio_id, conversacion_id, creado_en, id)` y `(comercio_id, rol, creado_en)` para el límite diario.

Las dos llevan `comercio_id` y políticas RLS `<tabla>_tenant` y `<tabla>_sistema`, y entran en `TENANT_MODELS`. `mensaje_asistente` es de sólo inserción para `app_api`. El filtro por usuario lo hace el servicio: RLS aísla comercios, no usuarios.

### D6 · Límites
- 50 mensajes por día por comercio (`ASISTENTE_LIMITE_DIARIO`), contando los mensajes `USUARIO` guardados desde las 00:00 de Buenos Aires. Como sólo se guardan los respondidos, un 503 no descuenta.
- Mensaje de hasta 1.000 caracteres, 6 consultas por respuesta, `max_tokens` 1024.
- Códigos de error nuevos en `packages/shared`: `LIMITE_ALCANZADO` (429) y `SERVICIO_NO_DISPONIBLE` (503).

### D7 · API
| Método y ruta | Roles | Plan |
|---|---|---|
| `POST /api/v1/assistant/messages` `{ conversacionId?, mensaje }` → 201 `{ conversacionId, mensaje }` | DUENIO | PREMIUM |
| `GET /api/v1/assistant/conversations?cursor&limit` | DUENIO | PREMIUM |
| `GET /api/v1/assistant/conversations/:id` | DUENIO | PREMIUM |

`mensaje`: `{ id, rol, contenido, fuentes: [{ herramienta, nombre }], acciones: [{ tipo: 'ORDEN_BORRADOR', ordenId, numero, proveedor }], creadoEn }`.

Módulos: nuevo `AssistantModule`, que importa los módulos de los servicios de D2 (los que no exportan su servicio pasan a exportarlo). Se tocan `packages/shared` (`asistente.ts`, códigos de error), `config/env.ts`, el contrato OpenAPI y `packages/api-client`.

### D8 · Web
- `features/asistente/AsistentePage.tsx` en `/asistente` (DUENIO): lista de conversaciones (panel lateral desde `lg`, selector arriba en pantallas chicas), mensajes, campo de texto con contador, cuatro preguntas sugeridas cuando la conversación está vacía, indicador de espera, `fuentes` como chips debajo de cada respuesta y tarjeta de acción para `ORDEN_BORRADOR` con enlace a `/ordenes/:id` y la leyenda "Todavía no se envió".
- Aviso fijo: las respuestas las genera un modelo de IA; los números importantes se verifican en su pantalla.
- Errores 429 y 503 como avisos dentro del chat, sin perder lo escrito.
- `lib/asistente.ts` (hooks; una acción `ORDEN_BORRADOR` invalida órdenes y alertas) y `lib/asistente-formato.ts` (textos puros con test).
- Enlace "Asistente" en la navegación, visible para el DUENIO.

### D9 · Tests
- Unitarios: esquemas de entrada de cada herramienta, recorte de resultados, armado del contexto, tope de consultas, cálculo del inicio del día en Buenos Aires.
- e2e `assistant.e2e-spec.ts` con `ModeloFalso` guionado: CP-08.1 a CP-08.5e. Verifica que las herramientas corren con los datos del comercio, que los resultados llegan al modelo, que `fuentes` y `acciones` se guardan, que `preparar_orden` deja un `BORRADOR` y no envía nada, el límite diario, el 503 sin descuento, plan, roles y aislamiento.
- Suite con el modelo real `assistant.live-spec.ts`, fuera de CI, que se saltea sin `ANTHROPIC_API_KEY`: CP-08.1, CP-08.2b, CP-08.2c, CP-08.4 y CP-08.4b. Es la que valida el comportamiento del modelo; se corre a mano antes de archivar.
- Web: test de `asistente-formato`.

### D10 · Documentación
ADR 0018 (asistente con herramientas acotadas y modelo detrás de una interfaz); README; `docs/arquitectura.html` (módulo `assistant`, RN-09, fila de LLM); `docs/ARRANQUE.md` (cómo obtener y cargar la clave, sin pegarla en el chat ni en el repo); `.env.example`; `openspec/CAPACIDADES.md`.

## Risks / Trade-offs

- [El modelo inventa una cifra] → instrucciones que exigen responder con datos de herramientas, `fuentes` visibles en cada respuesta, aviso en la página y suite con el modelo real. No hay garantía absoluta: por eso el asistente no escribe datos.
- [Inyección de instrucciones desde los datos] → las herramientas son de sólo lectura salvo el borrador, corren dentro del comercio del usuario y nada se envía sin el dueño. El peor caso es un borrador de más.
- [Costo] → límite diario por comercio, topes de largo, de consultas y de tokens, caché de prompt y registro de tokens por mensaje.
- [Datos del comercio salen a un tercero] → se documenta qué se envía; no van correos, teléfonos ni CUIT; la clave vive sólo en variables de entorno.
- [Latencia y arranque en frío de Render] → indicador de espera, tiempo límite por llamada y 503 claro.
- [Borrador huérfano] → si el modelo falla después de `preparar_orden`, el borrador queda creado aunque la respuesta no se guarde; aparece en Órdenes y se puede cancelar.
- [Los e2e no prueban al modelo] → lo cubre la suite con el modelo real, que es manual.
- [Sin gestión de planes] → el comercio de la demo ya está en PREMIUM.

## Migration Plan

1. Franco crea la clave en la consola de Anthropic y la carga en `apps/api/.env` y en Render. Hasta entonces el asistente responde 503 y nada más cambia.
2. Deploy de la API: la migración crea las dos tablas.
3. Deploy de la web.

Rollback: revertir el commit. Las tablas pueden quedar; no las usa nadie más.

## Open Questions

- ¿Conviene borrar conversaciones viejas pasado un tiempo? No cambia el contrato; se decide con uso real.
- ¿El CONTADOR debería poder usar el asistente en modo consulta? Hoy la arquitectura lo reserva al dueño.
