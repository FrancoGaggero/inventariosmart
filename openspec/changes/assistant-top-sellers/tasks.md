## 1. Shared

- [x] 1.1 Sumar `productos_mas_vendidos: 'Productos más vendidos'` a `HERRAMIENTAS_ASISTENTE` y crear `CriterioVentasSchema` (`UNIDADES` | `FACTURACION`) en `packages/shared/src/asistente.ts`. Listo cuando: `pnpm --filter @inventariosmart/shared build` compila y el test de `asistente.ts` cuenta once consultas
- [x] 1.2 Función pura `rankingDeVentas(filas, criterio, cantidad)` (D2): facturación neta por alícuota, orden con desempates, participación con un decimal, totales calculados antes de recortar, tope de 10, marca `dadoDeBaja` (D3). Listo cuando: los unitarios cubren los dos criterios, los desempates, el redondeo, que la participación sume 100 % sobre todas las filas, y la lista vacía con totales en cero

## 2. API

- [x] 2.1 `ProfitabilityService.ventasEntre(desde, hasta)` sobre `ventasPorProducto`, sin filtrar productos activos y con cruce en memoria (D1). Listo cuando: el e2e de CP-08.7c comprueba que una venta anulada no cuenta y que un producto dado de baja aparece
- [x] 2.2 Consulta `productos_mas_vendidos` en `herramientas.ts`: entrada con el rango ya validado y `criterio` y `cantidad` opcionales; descripción que la distingue de la de rentables; la descripción de `productos_mas_rentables` aclara que ordena por ganancia (D5). Listo cuando: `herramientas.spec.ts` define once consultas, cubre las fechas inválidas y el período de más de un año (CP-08.7e) y verifica que el resultado tiene totales y participación
- [x] 2.3 Párrafo en `INSTRUCCIONES_ASISTENTE` sobre vendido, facturación y rentable, con unidades como criterio por defecto que se aclara (D5). Listo cuando: el texto está en las instrucciones y `modelo.spec.ts` sigue pasando
- [x] 2.4 E2e con el modelo simulado en `assistant.e2e-spec.ts`: CP-08.7 (AC-5L con 120 unidades frente a FA-220 más rentable), CP-08.7b (por facturación), CP-08.7c (coincide con los movimientos, sin la venta anulada), CP-08.7d (CP-08.2b pasa a pedir `productos_mas_vendidos` y recibe lista vacía) y CP-08.7f (el comercio B no ve productos de A). Listo cuando: `assistant.e2e-spec.ts` pasa completo

## 3. Modelo real

- [ ] 3.1 Caso CP-08.7 en `assistant.live-spec.ts`: "¿Qué fue lo que más vendí en la quincena?" consulta `productos_mas_vendidos`, nombra a AC-5L y no a FA-220 como más vendido; CP-08.2b pasa a aceptar cualquiera de las dos consultas de ventas. Listo cuando: Franco aprueba correrlo (gasta saldo, unos 7 centavos con Haiku) y `pnpm --filter @inventariosmart/api test:asistente` pasa

## 4. Web

- [x] 4.1 Sumar "¿Qué fue lo que más vendí este mes?" a `PREGUNTAS_SUGERIDAS` en `lib/asistente-formato.ts`. Listo cuando: el test del formato pasa sin variables de entorno, como en CI, y las sugerencias no desbordan a 360 px

## 5. Documentación y cierre

- [x] 5.1 README y `docs/arquitectura.html` pasan de "diez" a "once" herramientas; ADR 0018 conserva su texto y suma una nota fechada que menciona la consulta nueva. Listo cuando: README y arquitectura dicen "once" y el ADR tiene la nota
- [ ] 5.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API; no hace falta regenerar OpenAPI (D1, sin cambios de contrato), y se confirma con `pnpm openapi` sin diferencias. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 5.3 Producción: Franco pregunta al asistente "¿qué fue lo que más vendí este mes?" en `https://inventariosmart0.vercel.app`. Listo cuando: la respuesta dice "Consulté: Productos más vendidos" y el producto y las unidades coinciden con la suma de ventas de ese mes en la base de producción
- [ ] 5.4 (manual, Franco) Anotar el ajuste de HU-08 en Trello y en el backlog. Listo cuando: Trello y backlog lo reflejan
