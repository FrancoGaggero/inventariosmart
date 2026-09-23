## Why

Un comercio que llega con 300 productos en una planilla no va a cargarlos uno por uno: el alta manual de HU-01 es el freno del primer día. La Propuesta compromete un onboarding guiado que importe el inventario desde Excel, valide antes de confirmar y permita cancelar (HU-05, RF-08). Con el patrón de vista previa y confirmación ya probado en las listas de precios (HU-02) y el registro del stock inicial como movimiento (HU-10), esta change cierra la Fase 1 en la web.

Cubre **HU-05** (RF-08) en la **Fase 1 – MVP**, reutilizando RN-05 (código único), RN-03 (alícuota por producto) y el límite de productos del plan FREE (HU-14). Es la novena capacidad del mapa de `openspec/CAPACIDADES.md`.

## What Changes

- **Importación de productos en dos pasos**: `POST /api/v1/import/preview` recibe una planilla `.xlsx` o `.csv` (código, nombre, precio de venta con IVA, costo neto, stock inicial, stock de seguridad, categoría, alícuota) y devuelve cada fila clasificada como producto nuevo, producto existente a actualizar (por código, sin tocar el stock) o fila inválida con el error por campo, más un resumen y el aviso si superaría el límite del plan; `POST /api/v1/import/commit` recibe las filas confirmadas y las aplica en una sola transacción: crea los nuevos con su `INGRESO` de stock inicial, actualiza los existentes y devuelve conteos.
- **Onboarding guiado en la web**: después de confirmar el nombre del comercio, el dueño elige "Importar desde Excel" o "Cargar a mano"; la importación es un asistente de tres pasos (descargar la plantilla y subir el archivo, revisar la vista previa con errores y conteos y poder cancelar, confirmar y ver el resultado). El mismo asistente queda accesible desde Inventario ("Importar desde Excel") para cargas posteriores.
- **Lectura de planillas compartida**: el lector de `.xlsx`/`.csv` de HU-02 se extrae a un módulo común para que ambas importaciones detecten encabezados, decimales y separadores igual.
- **Contrato**: `packages/shared` con esquemas de fila, vista previa, confirmación y resultado; OpenAPI y cliente regenerados.

Supuestos registrados:
- **Columnas**: obligatorias `codigo`, `nombre`, `precio` (con IVA, como en el formulario); opcionales `costo` (neto; default 0), `stock` (inicial; default 0), `stock_minimo` (seguridad; default 0), `categoria`, `iva` (alícuota; default la del comercio). Encabezados reconocidos con variantes en español (por ejemplo "precio de venta", "costo neto", "stock inicial", "stock mínimo").
- **Códigos existentes se actualizan**, no se rechazan: es el caso de quien reimporta su planilla con precios nuevos. Se actualizan nombre, precio, costo, categoría, alícuota y stock de seguridad; **el stock no**, porque sólo cambia por movimientos (RN-07). Un producto dado de baja con ese código se informa como inválido ("reactivalo primero").
- **Códigos repetidos en la planilla**: la última fila gana y las anteriores quedan inválidas, como en HU-02.
- **Límite del plan**: la vista previa informa cuántos productos activos quedarían y marca `superaLimite` en FREE; la confirmación responde 402 `PLAN_REQUERIDO` sin crear nada si se supera.
- **Costo importado sin proveedor**: queda como costo vigente del producto sin fila de historial (igual que el alta manual sin proveedor principal); las listas por proveedor siguen siendo HU-02.
- **Tope**: 5.000 filas y 2 MB, como las listas de precios.

## Capabilities

### New Capabilities

- `excel-import`: importación de productos desde planilla con vista previa clasificada por fila, confirmación transaccional que crea productos con su stock inicial y actualiza existentes sin tocar el stock, respeto del límite del plan y asistente de onboarding.

### Modified Capabilities

Ninguna. `product-catalog` no cambia sus requisitos: la importación crea y edita productos con las mismas reglas (código único, alícuota por defecto, límite FREE); `stock-movements` registra el `STOCK_INICIAL` igual que el alta manual.

## Impact

- **Código:** `apps/api` nuevo módulo `import`; `common/planillas.ts` extraído de `suppliers/price-list.parser.ts`; `ProductsService` expone la creación en lote dentro de una transacción; `packages/shared` esquemas; `packages/api-client` regenerado; `apps/web` asistente `/importar`, paso nuevo en onboarding, acceso desde Inventario, plantilla `plantillas/productos.csv`.
- **Base de datos:** sin migración.
- **Trazabilidad:** CU-05, casos de prueba CP-05.1 a CP-05.5, más plan y aislamiento.
- **Fuera de alcance:** importación de movimientos o gastos, importación de proveedores, mapeo manual de columnas, importación programada, Google Sheets, pantalla mobile (la Propuesta asigna el onboarding a la web).
