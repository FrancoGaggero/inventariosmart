## Context

Existen `ProfitabilityService.resumen(periodo)` (unidades, ventas netas, costo vendido, márgenes, gastos, motivo), `ProfitabilityService.listar()` (por producto con unidades y margen del mes, cursor), `ExpensesService.resumen()`, `calcularEstadoStock`, `inicioMesBuenosAires`, `sumarMeses` y el patrón de módulo, roles y RLS. La web tiene `HomePage` con tarjetas de acceso, `useProductos`, `SelectorMes`, `formatearPesos`, `formatearPct`, `Aviso`. TanStack Query permite `refetchInterval` y `refetchOnWindowFocus`. Comportamiento en `specs/financial-dashboard`; motivación en proposal.md.

## Goals / Non-Goals

**Goals:**
- Un endpoint, pocas consultas: cuatro agregaciones en paralelo (`Promise.all`) y ninguna por producto.
- Reutilizar los cálculos existentes en lugar de duplicarlos (`profitability`, `operating-expenses`).
- Mismo contrato para web y mobile (`mobile-mvp` mostrará un subconjunto).

**Non-Goals:**
- Alertas predictivas, gráficos históricos, WebSocket, personalización, exportación.

## Decisions

**D1 · Composición del panel (`DashboardService.obtener(periodo)`).**
En paralelo: (a) `ProfitabilityService.resumen(periodo)`; (b) `ProfitabilityService.resumen(sumarMeses(periodo, -1))` sólo para unidades y ventas netas; (c) agregación de stock: `SELECT count(*) FILTER (WHERE activo), COALESCE(SUM(stock_actual) FILTER (WHERE activo),0), COALESCE(SUM(stock_actual * costo_reposicion) FILTER (WHERE activo),0), count(*) FILTER (WHERE activo AND stock_actual <= 0), count(*) FILTER (WHERE activo AND stock_actual > 0 AND stock_actual <= stock_seguridad) FROM producto WHERE comercio_id = $1`; (d) top rentables: la misma consulta de `ProfitabilityService.listar()` restringida a productos con ventas en el mes, ordenada por `margen_bruto × unidades DESC` y limitada a 5 (se agrega a `ProfitabilityService` un método `topDelMes(periodo, n)` que reutiliza el `LEFT JOIN LATERAL` con `HAVING unidades > 0`; el margen unitario se calcula en SQL como `precio_venta/(1+alicuota_iva/100) − costo_reposicion` para poder ordenar); (e) alertas: productos activos sin stock y con stock bajo, hasta 5 de cada uno ordenados por nombre, más el total; `faltanGastos = resumen.motivo === 'SIN_GASTOS'`. Alternativa descartada: una vista materializada por comercio; los datos deben reflejar cambios de inmediato (CP-04.2).

**D2 · Contrato (`DashboardSchema` en `packages/shared`).**
`{ periodo, stock: { productosActivos, unidades, valorizacion, sinStock, stockBajo }, ventas: ResumenRentabilidad (sin `periodo`), mesAnterior: { periodo, unidadesVendidas, ventasNetas, variacionVentasPct | null }, topRentables: [{ producto, unidadesVendidas, margenBruto, margenBrutoPct, margenBrutoMes }], alertas: { sinStock: { total, items: [{ id, codigo, nombre, stockActual, stockSeguridad }] }, stockBajo: { total, items }, faltanGastos } }`. `variacionVentasPct = porcentaje(actual − anterior, anterior)` con `null` si el anterior es 0.

**D3 · Endpoint.** `GET /dashboard?periodo=` (`@Roles('DUENIO', 'CONTADOR')`, plan FREE, `GastosQuerySchema` para validar el mes). Módulo `dashboard` importa `ProfitabilityModule` (que exporta el servicio) y `ExpensesModule`. Se toca `packages/shared` y el contrato OpenAPI. Sin migración ni cambios en `TENANT_MODELS`.

**D4 · Rendimiento (RNF-04).**
Las cuatro agregaciones usan índices existentes (`producto(comercio_id, activo, nombre)`, `movimiento(comercio_id, producto_id, fecha desc)`); el stock está almacenado (ADR 0006), así que no se recorre el histórico. Test e2e CP-04.3 con 5.000 productos y 50.000 movimientos insertados con `createMany` como sistema (en dos lotes), una consulta de calentamiento y una medición con umbral de 3.000 ms (desde local a Neon; en Render↔Neon es muy inferior). El test se marca lento y corre igual en CI (Postgres local).

**D5 · Web.**
`HomePage` renderiza `<Dashboard />` para DUENIO y CONTADOR y mantiene el inicio actual para EMPLEADO. `Dashboard`: `useDashboard(periodo)` con `refetchInterval: 60_000`, `refetchOnWindowFocus: true`, `staleTime: 30_000`; `DASHBOARD_KEY` se invalida en las mutaciones de movimientos, gastos y precios (se agrega a los `useInvalidar*` existentes). Layout: frase de cabecera ("Este mes vendiste N unidades por $X netos, un 20 % más que el mes pasado"), fila de cuatro tarjetas (stock valorizado con unidades, ventas netas con variación, margen bruto con %, margen neto con % o aviso con enlace a Gastos), dos columnas: top 5 rentables (tabla corta con enlace a Rentabilidad) y alertas (sin stock y stock bajo con enlaces a registrar ingreso, y "faltan gastos"). Selector de mes reutilizado. Tarjetas de acceso rápido y estado del servicio debajo, más chicas. Alternativa descartada: ruta `/dashboard` separada; el panel es lo primero que debe verse.

**D6 · Tests.**
e2e `dashboard.e2e-spec.ts`: CP-04.1 (los números del escenario), CP-04.1b, CP-04.1c, CP-04.1d, CP-04.2, CP-04.3 (carga sintética), CP-04.5 y CP-04.5b. Unit test de `variacionVentasPct` en `shared`.

**D7 · Documentación.** README, `docs/arquitectura.html` (§6 `dashboard`, §7 alcance mobile con el mismo endpoint), `openspec/CAPACIDADES.md`. Sin ADR: aplica ADR 0006 (stock almacenado) y ADR 0008 (rentabilidad derivada).

## Risks / Trade-offs

- [El test de carga tarda en Neon desde local] → Se inserta con `createMany` en lotes de 5.000 y se limpia con la propietaria; ~1 minuto. En CI, segundos.
- [Sondeo cada 60 s agrega carga en Render Free] → Sólo mientras el inicio está visible; TanStack pausa el sondeo en pestañas ocultas por defecto.
- [Top rentables ordena por margen bruto y no por neto] → El neto unitario resta la misma constante a todos, así que el orden por margen generado no cambia; se muestra el bruto para no depender de los gastos.
- [Comparación con el mes anterior con el costo vigente] → Misma limitación documentada en ADR 0008.

## Migration Plan

Sin migración. Despliegue normal de `main`. Rollback: revertir el commit.

## Open Questions

- Si el CONTADOR debería ver también las tarjetas de acceso rápido a Inventario (hoy no accede al catálogo). No cambia specs ni tareas: se mantiene sin acceso.
