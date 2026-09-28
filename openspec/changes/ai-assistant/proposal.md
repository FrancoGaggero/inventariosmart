## Why

El sistema ya calcula rentabilidad, alertas, inflación, órdenes y comparación de proveedores, pero cada respuesta vive en una pantalla distinta y hay que saber dónde buscarla. El dueño de una PyME quiere preguntar "¿cuál fue mi producto más rentable de la quincena?" y tener la respuesta, sin aprender el sistema.

Esta change construye **HU-08 "Asistente conversacional con IA"** (RF-10; RN-06, RN-09, RNF-10), de la **Fase 3** del backlog y del plan **PREMIUM**. Es la primera historia de la Fase 3 y se apoya en todo lo construido en las Fases 1 y 2: el asistente no calcula nada nuevo, consulta lo que el sistema ya sabe.

## What Changes

- **Conversación en lenguaje natural** (`POST /assistant/messages`): el dueño escribe una pregunta y recibe una respuesta en español, armada con los datos reales de su comercio.
- **Herramientas acotadas, nunca SQL libre**: el modelo sólo puede invocar consultas predefinidas que ya son servicios de la API (rentabilidad, productos más rentables, stock y alertas, gastos, precios frente a la inflación, comparación de proveedores, búsqueda de productos y proveedores). Todas corren dentro del comercio del usuario, con las mismas reglas de aislamiento que el resto de la API.
- **Redacción de pedidos con confirmación humana (RN-06)**: el asistente puede preparar una orden de compra, que queda como **borrador**. Nunca la confirma ni la envía: la respuesta trae un acceso a la orden, donde el dueño la revisa y la confirma como cualquier otra.
- **Sólo el negocio**: el asistente responde sobre el comercio y su gestión, y rechaza con amabilidad las consultas ajenas.
- **Historial**: las conversaciones se guardan por usuario (`GET /assistant/conversations`, `GET /assistant/conversations/:id`) y se pueden retomar.
- **Límites de uso**: tope diario de mensajes por comercio, largo máximo del mensaje y tope de pasos por respuesta, para acotar el costo del proveedor de IA.
- **Web**: página "Asistente" con el chat, preguntas sugeridas, las fuentes consultadas en cada respuesta y el aviso de plan.
- **Contrato**: shared, OpenAPI y cliente regenerados. **Con migración**: dos tablas nuevas.

Supuestos registrados (para revisar antes de aplicar):
- **Proveedor de IA: API de Anthropic (Claude)**, como indica el documento de arquitectura. El modelo se configura por variable de entorno; se propone `claude-sonnet-5` por defecto y se puede cambiar a uno más capaz sin tocar código.
- **La clave de la API la crea y la carga Franco** en `apps/api/.env` y en Render (`ANTHROPIC_API_KEY`). Es un servicio pago por uso. Sin clave, el asistente responde que no está disponible y el resto del sistema funciona igual.
- **Los tests no llaman al proveedor**: usan un modelo simulado. Las pruebas con el modelo real son una suite aparte, manual, fuera de CI.
- **Sólo el DUENIO**, como figura en la arquitectura. El asistente ve costos y márgenes, que el EMPLEADO no ve.
- **Respuesta completa, sin streaming**: la respuesta llega entera. El texto progresivo queda como evolución.
- **"Redactar correos a proveedores"** se cubre con el borrador de orden de compra, que ya tiene texto redactado, envío por correo o WhatsApp y confirmación (HU-07, HU-16). Correos libres a proveedores quedan fuera.
- **Datos que salen del sistema**: al proveedor de IA se le envían la pregunta y los resultados de las herramientas (nombres de productos y proveedores, cantidades y montos). No se envían correos, teléfonos ni CUIT.

## Capabilities

### New Capabilities

- `ai-assistant`: conversación en lenguaje natural sobre los datos del comercio, herramientas acotadas, borradores de orden con confirmación humana, rechazo de consultas ajenas, historial, límites de uso, plan y permisos.

### Modified Capabilities

Ninguna. La orden que prepara el asistente es un borrador común de `purchase-orders`, creado con las reglas que ya existen.

## Impact

- **Código:** `packages/shared` `asistente.ts` (esquemas, límites, códigos de error nuevos); `apps/api` módulo nuevo `assistant` (servicio, herramientas, cliente del modelo, controller, DTOs) que consume los servicios de `profitability`, `dashboard`, `alerts`, `expenses`, `insights`, `supplier-comparison`, `products`, `suppliers` y `purchase-orders`; `apps/api/src/config/env.ts`; `packages/api-client` regenerado; `apps/web` `lib/asistente.ts`, `lib/asistente-formato.ts`, `features/asistente/AsistentePage.tsx`, enlace en la navegación.
- **Dependencias:** `@anthropic-ai/sdk` en `apps/api`.
- **Base de datos:** migración con `conversacion` y `mensaje_asistente`, las dos con `comercio_id` y RLS.
- **Variables de entorno:** `ANTHROPIC_API_KEY` (secreta), `ANTHROPIC_MODEL`, `ASISTENTE_LIMITE_DIARIO`.
- **Documentación:** ADR 0018 (asistente con herramientas acotadas), README, `docs/arquitectura.html`, `docs/ARRANQUE.md` (cómo cargar la clave), `.env.example`, `openspec/CAPACIDADES.md`.
- **Trazabilidad:** CU-08, casos CP-08.1 a CP-08.5.
- **Fuera de alcance:** streaming, voz, asistente en la app Android, correos libres a proveedores, que el asistente confirme órdenes, remarque precios, cargue movimientos o modifique datos, memoria entre conversaciones, adjuntar archivos o fotos, elección del modelo desde la web, gestión de planes (HU-14).
