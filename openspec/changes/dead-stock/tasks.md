## 1. Shared

- [x] 1.1 `packages/shared/src/stock-parado.ts` con `diasSinVender`, `capitalParado`, `ordenarStockParado` y `totalizarStockParado` (D3) y sus esquemas; exportado desde `index.ts`. Listo cuando: los unitarios de RN-15 cubren los días desde la última venta y desde el alta (CP-19.1, CP-19.1b), el capital de CP-19.1 (`21000.00`), el orden y los totales de CP-19.2 (`34000.00`, `34.00`), el porcentaje `null` con stock valorizado 0 y la validación de `dias` (CP-19.2c)
- [x] 1.2 Funcionalidad `stockParado` "Stock parado" en `FUNCIONALIDADES` con plan PRO, y el bloque `stockParado` (nullable) en `DashboardSchema`. Listo cuando: el test de `planes.ts` cuenta 14 funcionalidades y `pnpm --filter @inventariosmart/shared build` compila

## 2. API

- [x] 2.1 `common/reloj.ts` con el token `RELOJ`; `StockoutsService` y su e2e pasan a usarlo (D5). Listo cuando: `stockouts.e2e-spec.ts` sigue pasando sin cambios en sus expectativas
- [x] 2.2 `DeadStockService` con las tres consultas (D1, D2), orden, totales y cursor de posición (D4). Listo cuando: los e2e de CP-19.1 a CP-19.1d, CP-19.2, CP-19.2b y CP-19.2d pasan
- [x] 2.3 `DeadStockController` (`GET /dead-stock`) con `@RequierePlan('PRO')`, `@Roles('DUENIO', 'CONTADOR')`, validación de `dias` y DTOs Swagger; `DeadStockModule` en `AppModule`. Listo cuando: CP-19.2c, CP-19.3, CP-19.3b y CP-19.3c pasan
- [x] 2.4 Bloque `stockParado` en `DashboardService` (D6). Listo cuando: CP-19.6 pasa (igual a `/dead-stock?dias=90`, `null` en FREE, independiente de `periodo`) y el resto de `dashboard.e2e-spec.ts` sigue pasando
- [x] 2.5 Ruta `stockParado: '/api/v1/dead-stock'` en el mapa `RUTA` de `plans.e2e-spec.ts` y conteos actualizados. Listo cuando: CP-14.2 y CP-14.3 pasan con la funcionalidad nueva
- [ ] 2.6 Prueba de carga CP-19.4 (5.000 productos, 50.000 movimientos, 1.000 parados). Listo cuando: pasa en CI en menos de 3 s
- [x] 2.7 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene `/dead-stock` y el bloque `stockParado`, `pnpm typecheck` pasa y CI no reporta contrato desactualizado

## 3. Web

- [x] 3.1 `lib/stock-parado-formato.ts` con test y `lib/stock-parado.ts` (D7); `plan-formato.test.ts` con la funcionalidad nueva. Listo cuando: los tests de la web pasan sin variables de entorno, como en CI
- [x] 3.2 `StockParadoPage` en `/stock-parado` con tarjetas, selector, tabla, ideas para liberar la plata y aviso de plan. Listo cuando: CP-19.5 y CP-19.5b se ven en el arnés de vista previa y la página no desborda a 360, 768 y 1280 px en los dos temas
- [x] 3.3 Tarjeta "Plata parada en stock" en el panel junto a la de falta de stock, y enlaces cruzados entre las dos páginas. Listo cuando: las tarjetas aparecen sólo con monto mayor a cero, llevan a su página y la grilla no desborda a 360 px

## 4. Documentación y cierre

- [x] 4.1 ADR 0021, README (ruta de HU-19), `docs/arquitectura.html`, `openspec/CAPACIDADES.md` y RN-15, HU-19 y RF-20 en el contexto de `openspec/config.yaml`. Listo cuando: los documentos reflejan D1 a D7
- [ ] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 4.3 Producción: Franco abre "Stock parado" con 30 días en el comercio de la demo. Listo cuando: los productos y el capital que muestra coinciden con una consulta de las ventas de la base de producción
- [ ] 4.4 (manual, Franco) Sumar HU-19, RF-20 y RN-15 a la Propuesta, el backlog y el Gantt, y crear la tarjeta en Trello. Listo cuando: los cuatro documentos coinciden
