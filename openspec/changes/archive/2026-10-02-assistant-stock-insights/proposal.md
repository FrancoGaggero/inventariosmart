## Why

HU-18 ("Falta de stock") y HU-19 ("Stock parado") dejaron afuera, a propósito, que el asistente respondiera sobre ellas. Hoy, si el dueño le pregunta "¿qué productos no se venden?" o "¿cuánto perdí por quedarme sin stock?", el asistente no tiene ninguna consulta que lo responda. Termina diciendo que no tiene el dato o, peor, contesta con la consulta más parecida, el mismo problema que corrigió `assistant-top-sellers`. Esta change completa **HU-08 "Asistente conversacional con IA"** (RF-10; RN-09) con las dos capacidades nuevas, sin historia nueva. Es de la **Fase 3** y del plan **PREMIUM**.

## What Changes

- **Consulta nueva "Pérdidas por falta de stock"** (`perdidas_por_falta_de_stock`): con un período de 30, 60 o 90 días (30 por defecto), devuelve los totales del período y hasta 10 productos ordenados por ganancia perdida. Por producto trae días sin stock, si sigue sin stock, demanda diaria, unidades, venta y ganancia perdidas, o el motivo por el que no se estima. Reutiliza el cálculo de RN-14.
- **Consulta nueva "Stock parado"** (`stock_parado`): con un período de 30, 60, 90 o 180 días (90 por defecto), devuelve los totales y hasta 10 productos ordenados por capital parado, con stock, capital, última venta y días sin vender. Reutiliza el cálculo de RN-15.
- **Instrucciones**:
  - Cuándo usar cada consulta.
  - Que la ganancia perdida es una estimación y lo diga así.
  - Que "no se vende" es stock parado y no rotación lenta.
  - Que, si sugiere qué hacer con el stock parado, lo haga en una frase y sin inventar cifras.
- La lista de consultas pasa de once a trece. Los nombres legibles aparecen en `fuentes` y en "Consulté: …" sin cambios en la pantalla.
- **Sugerencia en la web**: "¿Tengo plata parada en productos que no se venden?" reemplaza a "¿Cuánto gasté este mes?", para que la lista siga en cinco preguntas.
- Sin cambios en la base, los endpoints, el contrato OpenAPI ni los permisos.

### Fuera de alcance

- Que el asistente arme una promoción, una remarcación o una devolución: sigue sin poder modificar nada (CP-08.2c).
- Rotación lenta, que no existe como cálculo en el sistema.
- Cambios en la app móvil.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `ai-assistant`: suma el requisito "Consultas sobre el stock". El asistente responde sobre quiebres y stock parado con las cifras de RN-14 y RN-15.

## Impact

- **API**: `apps/api/src/assistant/herramientas.ts` (dos consultas nuevas y sus descripciones), `instrucciones.ts` y `assistant.module.ts`, que importa `StockoutsModule` y `DeadStockModule`. Los dos ya exportan su servicio.
- **Shared**: `packages/shared/src/asistente.ts` suma las dos claves con su nombre legible.
- **Web**: `apps/web/src/lib/asistente-formato.ts` (preguntas sugeridas).
- **Tests**: unitarios de las consultas, e2e con el modelo simulado (CP-08.8 a CP-08.8c) y un caso con el modelo real, que se corre sólo con aviso a Franco porque gasta saldo.
- **Costo de uso**: dos herramientas más suman unos 300 tokens al bloque cacheado. Es menos de una décima de centavo por pregunta con Haiku.
