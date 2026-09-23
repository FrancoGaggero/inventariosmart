## 1. Lector común y contrato

- [x] 1.1 Extraer `apps/api/src/common/planillas.ts` (`leerMatriz`, `normalizarEncabezado`, `parsearMonto`, `resolverColumnas`, tope) desde `price-list.parser.ts`, que pasa a usarlo; mover y ampliar los unit tests (alias de columnas). Listo cuando: `price-list.parser.spec.ts` y `planillas.spec.ts` pasan y `suppliers.e2e-spec.ts` sigue en verde
- [x] 1.2 Agregar en `packages/shared` `importacion.ts` (D6) con tests unitarios de `filasAplicablesProductos` y de la confirmación (sin repetidos, sólo NUEVO/ACTUALIZA). Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa

## 2. API · módulo import

- [x] 2.1 `ImportService.vistaPrevia()` (D2, D3): alias, normalización, validación con `ProductoCreateSchema`, repetidos, clasificación contra el catálogo y resumen con límite del plan; `POST /import/preview` multipart. Listo cuando: CP-05.1, CP-05.2, CP-05.2b, CP-05.2c y CP-05.3 pasan
- [x] 2.2 `ImportService.confirmar()` (D4): transacción con bloqueo del comercio, relectura, 402 por plan, `createMany` de productos y de movimientos `STOCK_INICIAL`, actualización en lote, omitidos con detalle; `POST /import/commit`; `bloquearComercio`/`verificarLimite` públicos en `ProductsService`. Listo cuando: CP-05.4, CP-05.4b, CP-05.4c y CP-05.4d pasan
- [x] 2.3 Roles y aislamiento (CP-05.6); `ImportModule` registrado. Listo cuando: `import.e2e-spec.ts` pasa completo junto con las suites existentes
- [x] 2.4 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene las dos rutas de D5 y CI no reporta contrato desactualizado

## 3. Web · asistente y onboarding

- [ ] 3.1 `lib/importacion.ts`: `useVistaPreviaProductos()` (multipart) y `useConfirmarImportacionProductos()` con invalidación de productos, movimientos y dashboard; plantilla `public/plantillas/productos.csv`. Listo cuando: al confirmar, Inventario muestra los productos nuevos sin recargar
- [ ] 3.2 `ImportarProductosPage` en `/importar` (D7): tres pasos, filtros por estado, resumen con conteos, aviso de límite del plan, cancelar en cualquier paso, resultado con detalles y enlaces. Listo cuando: CP-05.5 y CP-05.5b se cumplen en la web con la plantilla de ejemplo
- [ ] 3.3 `OnboardingPage` con el paso "¿Cómo querés empezar?" (Importar desde Excel / Cargar a mano) y `ProductosPage` con "Importar desde Excel" en la cabecera y en el estado vacío; `RequireRole(['DUENIO'])`. Listo cuando: un comercio recién creado llega al asistente desde el onboarding y un DUENIO existente llega desde Inventario; EMPLEADO no ve el botón

## 4. Documentación y cierre

- [x] 4.1 README (rutas y columnas admitidas), `docs/arquitectura.html` (§6 `import`), `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D7
- [ ] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 4.3 Verificar en producción: importar la plantilla de ejemplo desde la web publicada y ver los productos en Inventario con su stock inicial y su movimiento. Listo cuando: los productos importados figuran en `https://inventariosmart0.vercel.app/productos`
- [ ] 4.4 (manual, Franco) Mover HU-05 a Hecho en Trello, actualizar `Backlog_InventarioSmart_v2.xlsx` y la tarea correspondiente del Gantt. Listo cuando: Trello, backlog y Gantt coinciden
