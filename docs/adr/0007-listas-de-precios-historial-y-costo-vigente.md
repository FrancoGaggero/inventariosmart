# ADR 0007 · Listas de precios como historial de sólo inserción y costo vigente por proveedor principal

**Estado:** aceptada · 23/09/2026

## Contexto

HU-02 (RF-03) incorpora proveedores y sus listas de precios. RN-08 fija que el costo de reposición vigente de un producto es el de la última lista importada del proveedor asociado y que, al cambiar, los márgenes se recalculan. RN-04 necesita el lead time del proveedor. Hasta ahora `producto.costo_reposicion` se editaba a mano (HU-01) y HU-03 va a calcular márgenes sobre ese campo.

## Decisión

1. **Historial de sólo inserción.** Cada costo informado por un proveedor para un producto es una fila nueva en `precio_proveedor` (costo neto, vigencia, origen `MANUAL` o `IMPORT`, lote y usuario). El rol de la API sólo tiene `SELECT` e `INSERT` sobre la tabla, como en `movimiento` (ADR 0006). La "lista vigente" de un proveedor es la última fila por producto.
2. **Proveedor principal por producto y regla RN-08 en un solo servicio.** `producto.proveedor_principal_id` indica de quién sale el costo vigente. `PricesService.registrar()` es el único camino que escribe `costo_reposicion`: bloquea los productos afectados, inserta las filas y actualiza el costo sólo si el proveedor es el principal (o el producto no tenía ninguno, en cuyo caso lo adopta). Cambiar el proveedor principal copia el último costo de ese proveedor; editar el costo a mano desde el producto registra una fila `MANUAL` a nombre del principal.
3. **Importación en dos pasos sin persistir el archivo.** `POST /suppliers/:id/price-list/preview` lee la planilla en memoria y devuelve cada fila clasificada (`NUEVO`, `CAMBIA`, `IGUAL`, `SIN_PRODUCTO`, `INVALIDA`); `POST /suppliers/:id/price-list` recibe las filas que el dueño confirma y descarta las que ya son el costo vigente, así reenviar una vista previa no duplica nada. HU-05 reutilizará el mismo patrón para productos.
4. **`exceljs` para `.xlsx` y un parser propio para `.csv`.** Se carga de forma diferida, con topes de 2 MB y 5.000 filas. Encabezados reconocidos por nombre (`código`, `sku`, `costo`, `precio`…) o, en su defecto, las dos primeras columnas; decimales con coma o punto y separador de miles.

## Alternativas consideradas

- **Un costo por (producto, proveedor) con `UPDATE`:** más simple, pero pierde el historial que RN-08 supone y que HU-03 necesita para el costo vigente a una fecha.
- **Trigger en PostgreSQL que actualice `costo_reposicion`:** invisible desde el código y difícil de testear; el servicio deja la regla explícita y bloquea filas para evitar carreras entre una importación y una edición manual.
- **SheetJS (`xlsx` de npm):** la versión publicada en npm (0.18.5) arrastra avisos de seguridad y las nuevas no se publican allí.
- **Procesar la planilla en el navegador:** no sirve para mobile ni para HU-05, y dejaría la validación fuera de la API.

## Consecuencias

- Los productos creados antes de HU-02 quedan sin proveedor principal y conservan su costo; el primer proveedor que les informe un costo pasa a ser el principal.
- Un proveedor dado de baja sigue siendo principal de sus productos hasta que el dueño lo cambie: el costo vigente no cambia solo.
- Nueva dependencia en la API: `exceljs`. Los tests generan planillas `.xlsx` con la misma librería.
- Runbook `docs/runbooks/rls.md`: `precio_proveedor` es la segunda tabla de sólo inserción.
