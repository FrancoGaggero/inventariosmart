# ADR 0008 · Rentabilidad derivada en cada consulta, con costo vigente

**Estado:** aceptada · 24/09/2026

## Contexto

HU-03 (RF-04) exige margen bruto y neto por producto y consolidado, sobre importes netos de IVA (RN-03), con el margen recalculado automáticamente al cambiar precio o costo (HU-03 criterio 4) y el neto "no calculable" cuando faltan gastos (HU-13 criterio 5). El documento de arquitectura preveía una vista SQL `v_rentabilidad_producto`. Los insumos ya existen: precio con IVA y alícuota por producto (HU-01), costo de reposición vigente que siguen las listas de proveedores (HU-02, RN-08), ventas con precio unitario congelado (HU-10) y prorrateo de gastos por unidad vendida (HU-13).

## Decisión

1. **Nada se almacena.** Los márgenes se calculan en cada consulta con funciones puras de `packages/shared` (`precioNeto`, `margenBruto`, `porcentaje`, `margenNeto`) aplicadas sobre una consulta SQL por endpoint (`LEFT JOIN LATERAL` con las ventas del mes para el listado; agregación de `movimiento JOIN producto` para el consolidado). No hay vista ni tabla nueva: las mismas funciones sirven a la web y a HU-04, y los tests unitarios de RN-01 a RN-03 son evidencia directa.
2. **Precio neto derivado del precio con IVA** con la alícuota actual del producto (`precio ÷ (1 + alícuota/100)`), tanto para el precio de lista como para el precio unitario congelado en cada venta.
3. **Costo de lo vendido con el costo de reposición vigente**, no con el costo a la fecha de cada venta. Es lo que fija RN-08 ("al cambiar el costo, los márgenes se recalculan") y evita depender del historial de HU-02 en el MVP.
4. **Margen neto = bruto − gasto por unidad del mes** (`ExpensesService.resumen`), heredando su motivo (`SIN_GASTOS`, `SIN_VENTAS`) como `null` explícito, nunca igual al bruto.

## Alternativas consideradas

- **Vista SQL o vista materializada:** oculta la regla en la base y complica los tests unitarios; una vista materializada además necesitaría refresco.
- **Columnas `margen_bruto` / `margen_neto` en producto:** obligan a recalcular en cada cambio de precio, costo, venta o gasto; propensas a quedar desactualizadas.
- **Costo histórico por venta (`precio_proveedor` a la fecha):** más exacto para meses cerrados, pero contradice la lectura literal de RN-08 y agrega complejidad; queda como refinamiento posible cuando HU-09 congele períodos.

## Consecuencias

- Cambiar precio, alícuota, costo o gastos cambia el margen en la siguiente consulta, sin jobs.
- Los meses pasados se recalculan con el costo actual: la pantalla lo aclara.
- Redondeo a dos decimales por magnitud; el consolidado suma en SQL antes de redondear, así que puede diferir en centavos de la suma de las filas.
