## 1. Contrato compartido

- [x] 1.1 `packages/shared/src/planes.ts` (D1, D2): catálogo `FUNCIONALIDADES`, `evaluarCambioDePlan`, esquemas de la consulta, del cambio y del historial; exportado en `index.ts` y `dist` reconstruido. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con subir, bajar, mismo plan y excesos de productos, de usuarios y de los dos

## 2. Base de datos

- [x] 2.1 Migración `20261003_subscription_plans` con `cambio_plan`, índice, RLS y permisos (D5); modelo en `TENANT_MODELS`. Listo cuando: `rls.e2e-spec.ts` cubre la tabla y pasa, y `app_api` no puede actualizar ni borrar registros

## 3. API

- [x] 3.1 `PlansService.obtener` con uso y funcionalidades (D1, D3). Listo cuando: CP-14.1, CP-14.2, CP-14.2b y CP-14.2c pasan
- [x] 3.2 Test del catálogo contra las rutas reales (D1). Listo cuando: CP-14.3 y CP-14.4 pasan recorriendo cada funcionalidad de PRO y PREMIUM
- [x] 3.3 `PlansService.cambiar` atómico con historial (D2, D4). Listo cuando: CP-14.5, CP-14.5b, CP-14.5c y CP-14.5d pasan
- [x] 3.4 `PlansService.historial` paginado. Listo cuando: CP-14.5e y CP-14.5f pasan
- [x] 3.5 `PlansController` y DTOs Swagger (D6); módulo en `AppModule`. Listo cuando: las tres rutas responden según roles y `GET /plan` funciona en los tres planes
- [x] 3.6 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene `/plan`, `/plan/change` y `/plan/history`, y CI no reporta contrato desactualizado

## 4. Web

- [x] 4.1 `lib/plan.ts` y `lib/plan-formato.ts` con test (D7). Listo cuando: el test de los textos pasa sin variables de entorno, como en CI
- [x] 4.2 `PlanPage` en `/configuracion/plan` con plan vigente, uso, comparación, cambio con confirmación e historial; enlace en la navegación. Listo cuando: CP-14.6, CP-14.6b y CP-14.6c se ven en la web y la página no desborda a 360, 768 y 1280 px en los dos temas
- [x] 4.3 Enlace "Ver planes" en los avisos de plan, resuelto en `ui/Aviso` para el tono `plan`. Listo cuando: ninguna pantalla conserva un aviso de plan sin enlace y `pnpm typecheck` pasa
- [x] 4.4 Portada con el catálogo compartido. Listo cuando: las tres tarjetas de la portada salen de `FUNCIONALIDADES` y muestran lo mismo que la página "Plan"

## 5. Documentación y cierre

- [x] 5.1 ADR 0019, README, `docs/arquitectura.html`, `docs/runbooks/deploy.md` y `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D9
- [x] 5.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [x] 5.3 Producción: Franco baja el comercio de la demo a PRO, comprueba que el asistente pide PREMIUM, y vuelve a PREMIUM. Listo cuando: CP-14.5, CP-14.5b y CP-14.6 se cumplen en `https://inventariosmart0.vercel.app` y los dos cambios figuran en `cambio_plan` en la base de producción
- [ ] 5.4 (manual, Franco) Mover HU-14 a Hecho en Trello y actualizar el backlog y el Gantt. Listo cuando: Trello, backlog y Gantt coinciden
