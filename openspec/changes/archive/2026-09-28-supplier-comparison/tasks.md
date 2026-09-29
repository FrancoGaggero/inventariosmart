## 1. Contrato compartido

- [x] 1.1 `packages/shared/src/comparador.ts` (D1): pesos, `puntuarProveedores`, `recomendado`, `masBarato`, `ahorroEstimado` y esquemas; exportado en `index.ts` y `dist` reconstruido. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con los puntajes de CP-12.1 y CP-12.2 (72,78; 81,38; 97,14), los de CP-12.4 (81,50; 72,38; 88,57), plazo 0 (88,00 y 75,25), los desempates, costo 0, un solo proveedor (94,00) y el ahorro de 14.400

## 2. API

- [x] 2.1 `SupplierComparisonService.producto` (D2, D3). Listo cuando: CP-12.1, CP-12.1b, CP-12.1c, CP-12.2, CP-12.2b, CP-12.4 y CP-12.4b pasan
- [x] 2.2 `SupplierComparisonService.resumen` con filtro, búsqueda, orden por ahorro, cursor y totales. Listo cuando: CP-12.3 y CP-12.3b pasan y la segunda página continúa donde terminó la primera
- [x] 2.3 `SupplierComparisonController` y DTOs Swagger (D4) con `@RequierePlan('PREMIUM')` y `@Roles('DUENIO')`; módulo en `AppModule`. Listo cuando: CP-12.5, CP-12.5b y CP-12.5c pasan, y cambiar el principal con `PATCH /products/:id` saca al producto de las oportunidades
- [x] 2.4 Rendimiento: 5.000 productos con 3 proveedores cada uno y tablas recién cargadas. Listo cuando: el resumen responde en menos de 3 segundos en CI
- [x] 2.5 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene `/supplier-comparison` y `/products/{id}/supplier-comparison`, y CI no reporta contrato desactualizado

## 3. Web

- [x] 3.1 `lib/comparador.ts` y `lib/comparador-formato.ts` con test (D5). Listo cuando: el test de los textos pasa sin variables de entorno, como en CI
- [x] 3.2 `ComparadorPage` en `/proveedores/comparador` con totales, filtro, buscador, estado vacío y aviso de plan; botón "Comparar precios" en `ProveedoresPage`. Listo cuando: CP-12.6b se ve en la web y la página no desborda a 360, 768 y 1280 px en los dos temas
- [x] 3.3 `ComparacionProductoPage` en `/proveedores/comparador/:productoId` con barras de puntaje, "Cómo se calcula" y "Usar como principal"; enlace en `ProductoFormPage`. Listo cuando: CP-12.6 se ve en la web

## 4. Documentación y cierre

- [x] 4.1 ADR 0017, README, `docs/arquitectura.html`, `openspec/config.yaml` (RN-13) y `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D7
- [x] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [x] 4.3 Producción: el comercio de la demo en plan PREMIUM (con aprobación de Franco); Franco carga el mismo producto en las listas de dos proveedores, abre el comparador y marca al recomendado como principal. Listo cuando: CP-12.1, CP-12.3 y CP-12.6 se cumplen en `https://inventariosmart0.vercel.app` y el producto tiene el principal nuevo en la base de producción
- [ ] 4.4 (manual, Franco) Mover HU-12 a Hecho y sumar RN-13 al backlog, a la Propuesta y al Gantt, y mover la tarjeta en Trello. Listo cuando: Trello, backlog y Gantt coinciden
