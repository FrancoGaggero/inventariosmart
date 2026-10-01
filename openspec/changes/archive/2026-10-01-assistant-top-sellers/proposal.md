## Why

En la verificación en producción del 29/09/2026, Franco le preguntó al asistente qué producto "se vendió mejor" y el asistente respondió con el más **rentable**: entre sus diez consultas no hay ninguna que ordene los productos por unidades vendidas, así que usó la más parecida. "¿Qué es lo que más vendo?" es de las primeras preguntas que hace un dueño, y responderla con otra métrica le hace perder confianza en el asistente. Esta change completa **HU-08 "Asistente conversacional con IA"** (RF-10; RN-09), de la **Fase 3** del backlog y del plan **PREMIUM**, sin historia nueva.

## What Changes

- Nueva consulta del asistente **"Productos más vendidos"** (`productos_mas_vendidos`): productos con ventas entre dos fechas, ordenados por **unidades vendidas** o por **facturación** (ventas netas de IVA, RN-03), según lo que pregunte el dueño. Por cada producto devuelve código, nombre, unidades, facturación neta y su participación en el total del período, y además el total de unidades y de facturación del período.
- Las instrucciones del asistente distinguen las tres preguntas: "más vendido" (unidades), "el que más facturó" (facturación) y "más rentable" (margen bruto, la consulta que ya existe). Si la pregunta es ambigua, usa unidades y lo aclara.
- La lista de consultas del asistente pasa de diez a once. El nombre legible "Productos más vendidos" aparece en `fuentes` y en la leyenda "Consulté: …" de la web sin cambios en la pantalla.
- La web suma "¿Qué fue lo que más vendí este mes?" a las preguntas sugeridas.
- No cambian los endpoints, el contrato OpenAPI ni la base de datos: la consulta se arma con las ventas que ya registra `movimiento`.

### Fuera de alcance

- Productos **menos vendidos** o **sin movimiento** ("qué no se vende"): necesita incluir productos sin ventas y una definición de antigüedad. Queda anotado para una change posterior.
- Un endpoint o una pantalla de ranking de ventas fuera del asistente. El panel ya muestra los más rentables; un ranking por unidades en la web sería otra historia.
- Ventas por categoría o por proveedor.
- Cambios en la app móvil.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `ai-assistant`: suma el requisito "Productos más vendidos": el asistente responde las preguntas sobre lo más vendido con unidades o facturación reales del período, y no con el margen.

## Impact

- **API**: `apps/api/src/assistant/herramientas.ts` (consulta nueva y su descripción), `apps/api/src/assistant/instrucciones.ts` (cómo elegir entre vendidos, facturación y rentables), `apps/api/src/profitability/profitability.service.ts` (método nuevo que reutiliza la suma de ventas por producto que ya existe).
- **Shared**: `packages/shared/src/asistente.ts` suma la clave y el nombre legible de la consulta; hay que recompilar el paquete.
- **Web**: `apps/web/src/lib/asistente-formato.ts` (pregunta sugerida).
- **Tests**: unitarios de la consulta, e2e con el modelo simulado (CP-08.7 y CP-08.7b, y CP-08.2b pasa a usar la consulta nueva), y un caso en la suite con el modelo real, que se corre sólo con aviso porque gasta saldo.
- **Costo de uso**: una herramienta más agrega unos 150 tokens al pedido. Como ese bloque se cachea, el impacto por pregunta es menor a una décima de centavo con Haiku.
- **Sin cambios**: base de datos, RLS, OpenAPI, clientes TS/Dart, planes y roles.
