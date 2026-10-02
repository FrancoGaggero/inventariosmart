## 1. Shared y API

- [x] 1.1 Sumar `perdidas_por_falta_de_stock: 'Pérdidas por falta de stock'` y `stock_parado: 'Stock parado'` a `HERRAMIENTAS_ASISTENTE`. Listo cuando: el test de `asistente.ts` cuenta trece consultas y `pnpm --filter @inventariosmart/shared build` compila
- [x] 1.2 Las dos consultas en `herramientas.ts` con entrada (D2), descripción y resultado (D1); `assistant.module.ts` importa `StockoutsModule` y `DeadStockModule`. Listo cuando: `herramientas.spec.ts` define trece consultas, cubre los períodos inválidos (CP-08.8c) y verifica que los servicios reciben `limit: 10` y que el resultado trae totales y productos
- [x] 1.3 Párrafo en `INSTRUCCIONES_ASISTENTE` (D3). Listo cuando: el texto está y `modelo.spec.ts` sigue pasando
- [x] 1.4 E2e con el modelo simulado: CP-08.8 (las cifras coinciden con `/stockouts?dias=30`), CP-08.8b (coinciden con `/dead-stock?dias=90`) y CP-08.8c (período inválido y aislamiento). Listo cuando: `assistant.e2e-spec.ts` pasa completo

## 2. Modelo real

- [ ] 2.1 Casos CP-08.8 y CP-08.8b en `assistant.live-spec.ts`. Listo cuando: Franco aprueba correrlo (unos 9 centavos con Haiku) y `pnpm --filter @inventariosmart/api test:asistente` pasa

## 3. Web

- [x] 3.1 "¿Tengo plata parada en productos que no se venden?" reemplaza a "¿Cuánto gasté este mes?" en `PREGUNTAS_SUGERIDAS`. Listo cuando: el test del formato pasa sin variables de entorno, como en CI

## 4. Documentación y cierre

- [x] 4.1 README y `docs/arquitectura.html` pasan de "once" a "trece" herramientas; ADR 0018 suma una nota fechada. Listo cuando: los documentos dicen "trece" y el ADR tiene la nota
- [x] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API; `pnpm openapi` sin diferencias; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [x] 4.3 Producción: Franco pregunta al asistente "¿tengo plata parada en productos que no se venden?". Listo cuando: la respuesta dice "Consulté: Stock parado" y lo que informa coincide con la página
- [ ] 4.4 (manual, Franco) Anotar el ajuste de HU-08 en Trello y en el backlog. Listo cuando: Trello y backlog lo reflejan
