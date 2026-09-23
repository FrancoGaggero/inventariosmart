## Context

Insumos ya existentes: `producto` (`precio_venta` con IVA, `alicuota_iva`, `costo_reposicion` neto vigente, `activo`), `movimiento` (`tipo`, `cantidad`, `precio_unitario` con IVA congelado en la venta, `fecha`, `anulado_por_id`) y `ExpensesService.resumen(periodo)` (total de gastos, unidades vendidas, gasto por unidad o `null` con motivo, límites de mes en Buenos Aires). Convenciones: cursor `{ items, siguienteCursor }`, montos como string con dos decimales, `@Roles`, RLS. La web tiene selector de mes en Gastos (`<input type="month">` con flechas) y `formatearPesos`. El documento de arquitectura previó una vista SQL `v_rentabilidad_producto`; esta change resuelve lo mismo con SQL en el servicio y funciones puras compartidas. Comportamiento en `specs/profitability`; motivación en proposal.md.

## Goals / Non-Goals

**Goals:**
- Reglas RN-01, RN-02 y RN-03 como funciones puras en `packages/shared`, con tests unitarios, reutilizables por la web (por ejemplo, para mostrar el margen mientras se edita un producto) y por HU-04.
- Una sola consulta SQL por endpoint: `producto` con agregación de ventas del mes por `LEFT JOIN LATERAL`, sin N+1.
- Definición de "ventas del mes" idéntica a `operating-expenses` (misma función de límites de mes).

**Non-Goals:**
- Almacenar márgenes, vistas materializadas, costo histórico por venta, rentabilidad por categoría o proveedor, dashboard.

## Decisions

**D1 · Funciones puras (`packages/shared/src/rentabilidad.ts`).**
`precioNeto(precioConIva, alicuota) = round2(precio / (1 + alicuota/100))`; `margenBruto(precioNeto, costo) = round2(precioNeto − costo)`; `porcentaje(parte, base) = base > 0 ? round2(parte / base × 100) : null`; `margenNeto(bruto, gastoPorUnidad | null)`. Se calcula en número de coma flotante y se redondea a dos decimales al final de cada magnitud; para los montos del MVP (hasta 14 dígitos con 2 decimales) el error es inferior al centavo. `MotivoResumen` de `operating-expenses` se reutiliza para `motivoNeto`. Alternativa descartada: librería de decimales (`decimal.js`); innecesaria para el rango y sumaría dependencia a la web.

**D2 · Listado por producto (`GET /profitability/products`).**
SQL: `SELECT p.*, v.unidades, v.ventas_netas FROM producto p LEFT JOIN LATERAL (SELECT COALESCE(SUM(m.cantidad),0) AS unidades, COALESCE(SUM(m.cantidad * m.precio_unitario / (1 + p.alicuota_iva/100)),0) AS ventas_netas FROM movimiento m WHERE m.producto_id = p.id AND m.tipo = 'VENTA' AND m.anulado_por_id IS NULL AND m.fecha >= $desde AND m.fecha < $hasta) v ON true WHERE p.comercio_id = $1 AND p.activo AND (búsqueda) AND (cursor) ORDER BY p.nombre, p.id LIMIT n+1`. Por fila se aplican las funciones de D1; `gastoPorUnidad` y `motivoNeto` salen de una única llamada a `ExpensesService.resumen(periodo)` para toda la página; `margenBrutoMes = round2(margenBruto × unidades)`. Búsqueda y cursor como en `products`. Alternativa descartada: reutilizar `ProductsService.listar()` y calcular en memoria; requeriría una segunda consulta por producto para las ventas.

**D3 · Consolidado (`GET /profitability/summary`).**
Una consulta sobre `movimiento JOIN producto`: `SUM(cantidad)`, `SUM(cantidad × precio_unitario / (1 + alicuota_iva/100))` (ventas netas) y `SUM(cantidad × costo_reposicion)` (costo de lo vendido, costo vigente, RN-08), filtrada por comercio, `VENTA`, no anulada y mes. `margenBruto = ventasNetas − costoVendido`; `margenBrutoPct = porcentaje(margenBruto, ventasNetas)`; `gastos = resumen.total`; `margenNeto = resumen.gastoPorUnidad === null ? null : margenBruto − gastos`; `margenNetoPct = porcentaje(margenNeto, ventasNetas)`; `motivo = resumen.motivo`. Alternativa descartada: costo histórico por venta (`precio_proveedor` a la fecha); queda como refinamiento en el ADR.

**D4 · Endpoints (bajo `/api/v1`, Bearer, plan FREE, `@Roles('DUENIO', 'CONTADOR')`).**

| Método y ruta | Notas |
| --- | --- |
| `GET /profitability/products` | `periodo` (default mes actual en Buenos Aires), `q`, `cursor`, `limit`; `{ periodo, gastoPorUnidad, motivoNeto, items, siguienteCursor }` |
| `GET /profitability/summary` | `periodo`; `{ periodo, unidadesVendidas, ventasNetas, costoVendido, margenBruto, margenBrutoPct, gastos, margenNeto, margenNetoPct, motivo }` |

EMPLEADO recibe 403 por el decorador. Módulos NestJS: nuevo `profitability` (importa `ExpensesModule`); sin cambios en otros módulos ni en `TENANT_MODELS` (no hay tabla nueva). Se toca `packages/shared` y el contrato OpenAPI. Las consultas usan `transaccionTenant` para que RLS respalde el filtro por comercio.

**D5 · Esquemas compartidos.**
`RentabilidadProductoSchema` (`producto { id, codigo, nombre }`, `precioVenta`, `alicuotaIva`, `precioNeto`, `costoReposicion`, `margenBruto`, `margenBrutoPct | null`, `unidadesVendidas`, `margenBrutoMes`, `margenNeto | null`, `margenNetoPct | null`), `ListaRentabilidadSchema` (con `periodo`, `gastoPorUnidad`, `motivoNeto`), `ResumenRentabilidadSchema`, `RentabilidadQuerySchema` (`periodo` `MesSchema` opcional, `q`, `cursor`, `limit`).

**D6 · Web.**
Ruta `/rentabilidad` (DUENIO y CONTADOR): selector de mes (mismo componente que Gastos, extraído a `ui/SelectorMes`), cuatro tarjetas (ventas netas, margen bruto con %, gastos del mes, margen neto con % o aviso con el motivo y enlace a Gastos), buscador y tabla por producto (producto, precio neto, costo, margen bruto $ y %, vendidas en el mes, margen bruto del mes, margen neto $ y %), con "Ver más". Colores: margen positivo en verde, negativo en rojo. Enlace "Rentabilidad" en `AppShell` y tarjeta en el inicio para DUENIO y CONTADOR; `RequireRole`.

**D7 · Tests.**
Unit tests en `shared` de RN-01 a RN-03 (los números de CP-03.1, CP-03.3, CP-03.1b, redondeos) y de `margenNeto`. e2e `profitability.e2e-spec.ts` con dos comercios y tres roles: CP-03.1 a CP-03.7 con ventas con fecha explícita en un mes fijo y gastos cargados vía `POST /expenses`. No hay migración, así que `rls.e2e-spec.ts` no cambia.

**D8 · ADR.**
`docs/adr/0008-rentabilidad-derivada-costo-vigente.md`: márgenes derivados en cada consulta (no almacenados, no vista materializada), costo de lo vendido con el costo vigente (RN-08) y precio neto derivado del precio con IVA; refinamiento futuro: costo histórico por venta.

## Risks / Trade-offs

- [Costo vigente en vez de histórico distorsiona meses pasados si el costo cambió mucho] → Es lo que fija RN-08 para el MVP; documentado en el ADR y en la ayuda de la pantalla ("calculado con el costo actual").
- [Precio neto derivado con la alícuota actual, no la de la venta] → La alícuota cambia rara vez; se acepta y se anota.
- [Agregaciones sobre `movimiento` crecen con el historial] → Índice existente `(comercio_id, producto_id, fecha desc)`; el mes acota el rango. Con 50.000 movimientos (RNF-04) sigue siendo una consulta por índice.
- [Redondeo por fila vs. total] → El consolidado se suma en SQL antes de redondear; el listado redondea por producto. Diferencias de centavos aceptadas.

## Migration Plan

Sin migración. Despliegue normal de `main`. Rollback: revertir el commit.

## Open Questions

- Si HU-04 va a mostrar "top 5 por margen" ordenando en el servidor; en ese caso el listado sumaría un `orden`. No cambia specs ni tareas de esta change.
