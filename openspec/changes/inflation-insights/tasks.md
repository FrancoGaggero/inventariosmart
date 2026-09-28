## 1. Contrato compartido

- [x] 1.1 `packages/shared/src/inflacion.ts` (D1): constantes, `variacionReal` (RN-11), `indiceBase100`, `valorCanasta`, `estadoPrecio`, `precioSugeridoInflacion`, `precioSugeridoMargen`, `listaMeses` (con `mesesEntre` de gastos) y esquemas de indicadores, query, comparación e historial; exportado en `index.ts` y `dist` reconstruido. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con los números de CP-15.3 (118,00; 122,00; −1,67; −3,28) y CP-15.4 (−8,33; 8,33; 1200; 2400; 2500), el borde de ±2 %, base 100 con nulos y período inválido

## 2. API · datos y fuentes

- [x] 2.1 Migración `20260929_inflation_insights` (D2): enums, `indicador_economico`, `indicador_actualizacion`, `precio_venta_historial`, RLS, privilegios y relleno inicial del historial; `schema.prisma`, `TENANT_MODELS` (sólo el historial) y limpieza en `test/helpers.ts`. Listo cuando: `prisma migrate deploy` corre en Neon dev, cada producto existente tiene al menos una fila de historial, y `rls.e2e-spec.ts` cubre las dos tablas (historial sin UPDATE ni DELETE; indicadores legibles sin contexto y no escribibles por `app_api`)
- [x] 2.2 `FuenteIndec`, `FuenteBcra` y `FuenteFalsa` (D3) con timeout, validación de forma y variables `INDEC_API_URL` / `BCRA_API_URL` en `env.ts` y `.env.example`. Listo cuando: los tests unitarios cubren respuesta válida, forma inesperada, error 410 y timeout con `fetch` simulado
- [x] 2.3 `IndicatorsService` y `IndicatorsCron` (D4): actualización si vence con advisory lock, `upsert`, registro del último error y del último intento por fuente, `desactualizado`; `GET /indicators`. Listo cuando: CP-15.1, CP-15.1b, CP-15.1c y CP-15.1d pasan con `FuenteFalsa`
- [x] 2.4 Historial de precios (D5): `registrarPrecioVenta` en alta, edición e importación dentro de la transacción; `GET /products/:id/price-history`. Listo cuando: CP-15.2, CP-15.2b, CP-15.2c y CP-15.2d pasan y `products.e2e-spec.ts` e `import.e2e-spec.ts` siguen en verde

## 3. API · comparación

- [x] 3.1 `InsightsService.inflacion` (D6) y `InsightsController` (D7): período con recorte al último IPC, canasta fija, índices, variaciones, brechas y productos con estado y sugeridos; `@RequierePlan('PRO')`, roles; módulos registrados en `AppModule`. Listo cuando: CP-15.3, CP-15.3b, CP-15.3c, CP-15.3d, CP-15.4, CP-15.4b, CP-15.5, CP-15.5b y CP-15.5c pasan
- [ ] 3.2 Rendimiento: carga sintética de 5.000 productos con historial y 50.000 movimientos. Listo cuando: la comparación de 12 meses responde en menos de 3 segundos en CI, serializada con las otras pruebas de carga
- [x] 3.3 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene `/indicators`, `/insights/inflation` y `/products/{id}/price-history`, y CI no reporta contrato desactualizado

## 4. Web

- [x] 4.1 `ui/GraficoLineas.tsx` (D8) con test de Vitest. Listo cuando: el test verifica un punto por mes y serie, la tabla alternativa con los mismos valores y el caso de serie vacía, y el gráfico se ve bien en tema claro y oscuro a 360 y 1280 px
- [x] 4.2 `lib/inflacion.ts` e `InflacionPage` en `/inflacion`: frase, selector de período, gráfico, KPI, avisos de recorte y de datos desactualizados, tabla de productos con estado y precios sugeridos, estado vacío, aviso de plan; ruta y enlace "Inflación" en `AppShell`. Listo cuando: CP-15.6 se ve en la web sin desborde a 360, 768, 1024 y 1280 px
- [x] 4.3 Tarjeta "Contexto" en Inicio con indicadores, fuentes, fechas y stock en dólares para DUENIO y CONTADOR. Listo cuando: CP-15.6b se ve en la web y con la fuente caída aparece el aviso de dato desactualizado

## 5. Documentación y cierre

- [x] 5.1 ADR 0014, README, `docs/arquitectura.html` (módulos, RN-11, servicios externos), `docs/runbooks/rls.md` (tabla de referencia sin tenant), `openspec/config.yaml` (HU-15, RF-16, RN-11), `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D10
- [ ] 5.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 5.3 Producción: migración aplicada por Render, indicadores reales del INDEC y del BCRA cargados, y Franco revisa `/inflacion` e Inicio con los datos de su comercio. Listo cuando: CP-15.1, CP-15.3 y CP-15.6 se cumplen en `https://inventariosmart0.vercel.app`
- [ ] 5.4 (manual, Franco) Sumar HU-15, RF-16 y RN-11 al backlog, a la Propuesta y al Gantt, y mover la tarjeta en Trello. Listo cuando: Trello, backlog y Gantt coinciden
