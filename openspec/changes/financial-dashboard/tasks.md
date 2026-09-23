## 1. Contrato compartido

- [x] 1.1 Agregar en `packages/shared` `dashboard.ts`: `DashboardSchema` (stock, ventas, mesAnterior, topRentables, alertas) y `variacionPct()`, con tests unitarios. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con la variación de CP-04.1 (200 %) y el `null` de CP-04.1c

## 2. API · módulo dashboard

- [x] 2.1 `ProfitabilityService.topDelMes(periodo, n)` (D1 d): productos con ventas ordenados por margen generado en SQL. Listo cuando: CP-04.1b pasa
- [x] 2.2 `DashboardService.obtener(periodo)` (D1): resumen actual y del mes anterior, agregación de stock, top rentables y alertas en paralelo; `DashboardController` con `@Roles('DUENIO', 'CONTADOR')` y DTOs Swagger; `DashboardModule` registrado en `AppModule`. Listo cuando: CP-04.1, CP-04.1c, CP-04.1d, CP-04.2, CP-04.5 y CP-04.5b pasan
- [x] 2.3 Test de rendimiento CP-04.3: 5.000 productos y 50.000 movimientos como sistema, calentamiento y medición < 3 s; limpieza con la propietaria. Listo cuando: `dashboard.e2e-spec.ts` pasa completo junto con las suites existentes
- [x] 2.4 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene `GET /dashboard` y CI no reporta contrato desactualizado

## 3. Web · dashboard en el inicio

- [ ] 3.1 `lib/dashboard.ts`: `useDashboard(periodo)` con `refetchInterval` 60 s, `refetchOnWindowFocus` y `staleTime`; `DASHBOARD_KEY` invalidada desde las mutaciones de movimientos, gastos y precios. Listo cuando: registrar una venta desde Movimientos y volver al inicio muestra las unidades nuevas sin recargar
- [ ] 3.2 Componente `Dashboard` (D5): frase de cabecera en lenguaje claro, cuatro tarjetas, top 5 rentables con enlace a Rentabilidad, alertas de stock con enlaces a Inventario y a registrar ingreso, aviso de gastos faltantes con enlace a Gastos, selector de mes. Listo cuando: CP-04.4 se ve en la web (frase con unidades y ventas netas, aviso con enlace) y con gastos el margen neto se muestra en pesos y porcentaje
- [ ] 3.3 `HomePage`: muestra `Dashboard` para DUENIO y CONTADOR y el inicio operativo actual para EMPLEADO; accesos rápidos y estado del servicio reubicados debajo. Listo cuando: EMPLEADO ve su inicio sin panel y DUENIO ve el panel arriba

## 4. Documentación y cierre

- [x] 4.1 README (ruta de HU-04), `docs/arquitectura.html` (§6 `dashboard`; §7 mobile con el mismo endpoint), `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D5
- [x] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 4.3 Verificar en producción: el inicio muestra el panel de septiembre con el stock de la batería, las ventas, el margen neto con el alquiler cargado, el top rentables y las alertas de stock. Listo cuando: `https://inventariosmart0.vercel.app/` muestra el panel con los números reales del comercio
- [ ] 4.4 (manual, Franco) Mover HU-04 a Hecho en Trello, actualizar `Backlog_InventarioSmart_v2.xlsx` y la tarea correspondiente del Gantt. Listo cuando: Trello, backlog y Gantt coinciden
