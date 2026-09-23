## 1. Contrato compartido

- [x] 1.1 Agregar en `packages/shared` `rentabilidad.ts`: `precioNeto()`, `margenBruto()`, `porcentaje()`, `margenNeto()`, `RentabilidadProductoSchema`, `ListaRentabilidadSchema`, `ResumenRentabilidadSchema`, `RentabilidadQuerySchema`, con tests unitarios de RN-01, RN-02 y RN-03. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con los números de CP-03.1, CP-03.3, CP-03.1b y CP-03.2

## 2. API · módulo profitability

- [x] 2.1 `ProfitabilityService.listar(query)` (D2): SQL con `LEFT JOIN LATERAL` de ventas del mes, funciones de D1 por fila, `gastoPorUnidad` y `motivoNeto` de `ExpensesService.resumen`, búsqueda y cursor. Listo cuando: CP-03.1, CP-03.1b, CP-03.2, CP-03.2b, CP-03.2c, CP-03.3, CP-03.4 y CP-03.6 pasan
- [x] 2.2 `ProfitabilityService.resumen(periodo)` (D3): agregación de ventas netas, costo vendido y unidades; márgenes y porcentajes; motivo. Listo cuando: CP-03.5, CP-03.5b y CP-03.5c pasan
- [x] 2.3 `ProfitabilityController` con `@Roles('DUENIO', 'CONTADOR')`, DTOs Swagger, `ProfitabilityModule` que importa `ExpensesModule`, registro en `AppModule`. Listo cuando: CP-03.7 y CP-03.7b pasan y `profitability.e2e-spec.ts` pasa completo junto con las suites existentes
- [x] 2.4 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene las dos rutas de D4 y CI no reporta contrato desactualizado

## 3. Web · rentabilidad

- [ ] 3.1 Cliente de datos `lib/rentabilidad.ts`: `useRentabilidad(periodo, q)` con `useInfiniteQuery` y `useResumenRentabilidad(periodo)`; `ui/SelectorMes` extraído de Gastos y reutilizado allí. Listo cuando: Gastos sigue funcionando con el selector extraído y la página nueva carga páginas sucesivas con "Ver más"
- [ ] 3.2 Página `/rentabilidad` (D6): tarjetas consolidadas con el aviso y enlace a Gastos cuando el neto no es calculable, buscador y tabla por producto con colores por signo. Listo cuando: con gastos y ventas del mes muestra margen neto en $ y %; sin gastos muestra el aviso "cargá los gastos del mes" con enlace
- [ ] 3.3 Enlace "Rentabilidad" en `AppShell` y tarjeta en el inicio para DUENIO y CONTADOR; `RequireRole(['DUENIO', 'CONTADOR'])`. Listo cuando: EMPLEADO no ve el enlace y, si escribe `/rentabilidad`, ve "No tenés permiso"

## 4. Documentación y cierre

- [x] 4.1 ADR `docs/adr/0008-rentabilidad-derivada-costo-vigente.md` (D8); README (rutas de HU-03), `docs/arquitectura.html` (§6 endpoints de `profitability`; RN-01/RN-03 con la implementación real en lugar de la vista SQL prevista), `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D4
- [ ] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 4.3 Verificar en producción: la página Rentabilidad muestra el margen bruto de la batería y, con el alquiler cargado y las ventas de septiembre, el margen neto del mes. Listo cuando: `https://inventariosmart0.vercel.app/rentabilidad` muestra el consolidado y la fila del producto con sus márgenes
- [ ] 4.4 (manual, Franco) Mover HU-03 a Hecho en Trello, actualizar `Backlog_InventarioSmart_v2.xlsx` y la tarea correspondiente del Gantt. Listo cuando: Trello, backlog y Gantt coinciden
