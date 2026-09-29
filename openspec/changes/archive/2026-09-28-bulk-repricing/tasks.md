## 1. Contrato compartido

- [x] 1.1 `packages/shared/src/remarcacion.ts` (D1): criterios, redondeos, `redondearPrecio`, `precioPorPorcentaje`, `precioPorMargenObjetivo`, `calcularItem` (RN-12), `resumirRemarcacion` y esquemas; origen `REMARCACION` en `inflacion.ts`; exportado en `index.ts` y `dist` reconstruido. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con los números de CP-17.1 a CP-17.2b, el redondeo de 2989,9999… a 2990, costo cero y parámetros inválidos

## 2. API

- [x] 2.1 Migración `20261001_bulk_repricing` (D2): valor `REMARCACION`, enum de criterio, `remarcacion` y `remarcacion_item` con RLS y privilegios; `schema.prisma`, `TENANT_MODELS` y limpieza en `test/helpers.ts`. Listo cuando: `prisma migrate deploy` corre en Neon dev y `rls.e2e-spec.ts` cubre las dos tablas (sin DELETE para `app_api`)
- [x] 2.2 `RepricingService.vistaPrevia` (D3) con `InsightsModule` exportando su servicio. Listo cuando: CP-17.1, CP-17.1b, CP-17.1c, CP-17.1d, CP-17.1e, CP-17.2 y CP-17.2b pasan y ningún caso modifica datos
- [x] 2.3 `RepricingService.aplicar` (D4): verificación, actualización en una sentencia, historial y lote. Listo cuando: CP-17.3, CP-17.3b, CP-17.3c y CP-15.2e pasan, y dos aplicaciones simultáneas sobre los mismos productos dejan un solo lote
- [x] 2.4 Lotes y deshacer (D5): listado, detalle y `revert`. Listo cuando: CP-17.4, CP-17.4b y CP-17.4c pasan
- [x] 2.5 `RepricingController` y DTOs Swagger (D6) con plan y roles; módulo en `AppModule`. Listo cuando: CP-17.5, CP-17.5b y CP-17.5c pasan
- [x] 2.6 Rendimiento: aplicar un lote de 5.000 productos con tablas recién cargadas. Listo cuando: responde en menos de 3 segundos en CI
- [x] 2.7 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene las rutas `/repricing*` y CI no reporta contrato desactualizado

## 3. Web

- [x] 3.1 `lib/remarcacion.ts` y `lib/remarcacion-formato.ts` con test (D7). Listo cuando: el test de los textos pasa sin variables de entorno, como en CI
- [x] 3.2 `RemarcarPage` en `/remarcar` y botón "Remarcar" en `InflacionPage`. Listo cuando: CP-17.6 y CP-17.6b se ven en la web sin desborde a 360, 768 y 1280 px en los dos temas
- [x] 3.3 `RemarcacionesPage` en `/remarcaciones` con "Deshacer" y enlace en `AppShell`. Listo cuando: el lote aplicado aparece en la lista y deshacerlo muestra revertidos y omitidos

## 4. Documentación y cierre

- [x] 4.1 ADR 0016, README, `docs/arquitectura.html`, `docs/runbooks/rls.md`, `openspec/config.yaml` (HU-17, RF-18, RN-12) y `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D9
- [x] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [x] 4.3 Producción: migración aplicada por Render; Franco remarca un producto desde "Precios e inflación" y después deshace la remarcación. Listo cuando: en la base de producción hay un lote aplicado y revertido, y CP-17.3, CP-17.4b y CP-17.6 se cumplen en `https://inventariosmart0.vercel.app`
- [ ] 4.4 (manual, Franco) Sumar HU-17, RF-18 y RN-12 al backlog, a la Propuesta y al Gantt, y mover la tarjeta en Trello. Listo cuando: Trello, backlog y Gantt coinciden
