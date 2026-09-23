## Context

`suppliers/price-list.parser.ts` ya lee `.xlsx` (exceljs diferido) y `.csv` (parser propio), normaliza encabezados y montos (`parsearMonto`) y aplica el tope de 5.000 filas; `PriceListService` clasifica filas y confirma con `registrarEnTransaccion`. `ProductsService.crear()` valida código único, aplica el IVA por defecto, controla el límite FREE con `bloquearComercio` + `verificarLimite` y registra el `STOCK_INICIAL` vía `MovementsService.registrarEnTransaccion`. `ProductoCreateSchema` y `ProductoPatchSchema` son la fuente de validación. La web tiene `OnboardingPage` (nombre del comercio → inicio), `ImportarListaPage` (asistente de tres pasos) y `ProductosPage` con estado vacío. Comportamiento en `specs/excel-import`; motivación en proposal.md.

## Goals / Non-Goals

**Goals:**
- Reutilizar lector, clasificación y transacción: cero lógica de validación nueva (se usa `ProductoCreateSchema` por fila).
- Confirmación en una sola transacción con inserciones en lote: 5.000 productos en segundos.
- Asistente web reutilizable desde onboarding e inventario.

**Non-Goals:**
- Mapeo manual de columnas, importación de otras entidades, deshacer una importación.

## Decisions

**D1 · Lector común `common/planillas.ts`.**
Se extraen de `price-list.parser.ts`: `leerMatriz(buffer, nombre): Promise<string[][]>` (xlsx/csv, BOM, separadores), `normalizarEncabezado()`, `parsearMonto()`, `resolverColumnas(encabezados, definicion)` que recibe un mapa `{ campo: [alias...] }` y devuelve índices o error, y el tope `LIMITE_FILAS_IMPORTACION`. `price-list.parser.ts` pasa a usarlos (sin cambio de comportamiento; sus tests siguen igual).

**D2 · Columnas y alias.**
`codigo` (`codigo`, `código`, `sku`, `cod`), `nombre` (`nombre`, `descripcion`, `producto`, `articulo`), `precioVenta` (`precio`, `precio de venta`, `precio venta`, `pvp`), `costoReposicion` (`costo`, `costo neto`, `costo de reposicion`), `stockInicial` (`stock`, `stock inicial`, `cantidad`, `existencia`), `stockSeguridad` (`stock minimo`, `stock mínimo`, `stock de seguridad`, `minimo`), `categoria` (`categoria`, `rubro`, `familia`), `alicuotaIva` (`iva`, `iva %`, `alicuota`, `alícuota`). Sin encabezados reconocibles para los tres obligatorios → 400. Sin detección posicional: a diferencia de la lista de precios (dos columnas), acá la ambigüedad es alta.

**D3 · Vista previa (`ImportService.vistaPrevia(archivo)`).**
Por fila: armar `{ codigo, nombre, precioVenta, costoReposicion?: default "0", stockInicial?: 0, stockSeguridad?: 0, categoria?, alicuotaIva? }` con `parsearMonto` para montos y enteros para stocks, validar con `ProductoCreateSchema.safeParse` (mismos mensajes del formulario), marcar repetidos (última gana), consultar en una sola `findMany` los productos del comercio cuyos `codigo_normalizado` estén en la planilla, y clasificar: existente activo → `ACTUALIZA` (con `productoId` y `stockActual` actual para mostrar), existente inactivo → `INVALIDA` "reactivalo primero", nuevo → `NUEVO`. `alicuotaIva` faltante → la del comercio. Resumen: `total, nuevos, actualizan, invalidas, productosActualesActivos, productosResultantes, superaLimite` (`LIMITES_PLAN[plan].productos`). Respuesta con las filas ya normalizadas (`FilaImportacion`), que la confirmación recibe de vuelta.

**D4 · Confirmación (`ImportService.confirmar(filas)`).**
`transaccionTenant`: `bloquearComercio` (FOR UPDATE, serializa con altas manuales), releer existentes por código (por si cambió algo desde la vista previa), separar en crear / actualizar / omitir (inactivo o inválido ahora), verificar `activos + crear.length <= límite` → 402 antes de escribir; `producto.createMany` con `stockActual = stockInicial` y `codigoNormalizado`; `movimiento.createMany` con un `INGRESO STOCK_INICIAL` por producto con stock > 0 (`efecto = stock_resultante = stockInicial`, `usuario_id` del dueño); actualizaciones con `UPDATE ... FROM (VALUES ...)` en una sola sentencia (o `Promise.all` de `update` si son pocas; se elige `VALUES` por el tope de 5.000). `MovementsService` no se llama fila por fila: el lote replica exactamente lo que `registrarEnTransaccion` haría para un producto recién creado (stock previo 0, sin proveedor). Respuesta `{ creados, actualizados, omitidos, detalles: [{ fila, codigo, motivo }] }`. Alternativa descartada: llamar `ProductsService.crear()` por fila (5 consultas × 5.000 filas en una transacción).

**D5 · Endpoints (bajo `/api/v1`, Bearer, `@Roles('DUENIO')`, plan FREE con límite).**

| Método y ruta | Notas |
| --- | --- |
| `POST /import/preview` | multipart `archivo` (2 MB) → 200 `VistaPreviaImportacion` |
| `POST /import/commit` | `{ filas: FilaImportacion[] }` (1–5.000) → 201 `ResultadoImportacionProductos`; 402 si supera el plan |

Módulos NestJS: nuevo `import` (importa `ProductsModule` por `bloquearComercio`/`verificarLimite`, que pasan a ser públicos, y usa `PrismaService`); `suppliers` (usa el lector común). Se toca `packages/shared` y el contrato OpenAPI. Sin migración.

**D6 · Esquemas compartidos (`importacion.ts`).**
`ESTADOS_FILA_PRODUCTO = ['NUEVO', 'ACTUALIZA', 'INVALIDA']`, `FilaImportacionSchema` (fila, estado, datos normalizados opcionales, `productoId`, `stockActual`, `error`), `VistaPreviaImportacionSchema`, `ImportacionProductosConfirmSchema` (`filas` con estado `NUEVO` o `ACTUALIZA`, 1–5.000, sin códigos repetidos), `ResultadoImportacionProductosSchema`, `COLUMNAS_IMPORTACION` (alias, para mostrar la ayuda en la web), `filasAplicablesProductos()`.

**D7 · Web.**
`ImportarProductosPage` en `/importar` (DUENIO): paso 1 (plantilla `public/plantillas/productos.csv` con encabezados y dos filas de ejemplo, lista de columnas admitidas, subir), paso 2 (tabla con fila, código, nombre, precio, costo, stock, estado con badge y error; filtros por estado; resumen "N productos nuevos, M a actualizar, K con errores"; aviso rojo si `superaLimite` con enlace a planes; botones "Importar N productos" y "Cancelar"), paso 3 (resultado con creados/actualizados/omitidos y detalles; enlaces a Inventario y "Importar otra"). `OnboardingPage`: tras guardar el nombre, segundo paso "¿Cómo querés empezar?" con dos tarjetas: "Importar desde Excel" (→ `/importar?onboarding=1`, que al terminar lleva a Inventario) y "Cargar a mano" (→ `/productos/nuevo`). `ProductosPage`: botón "Importar desde Excel" junto a "Nuevo producto" y en el estado vacío. Invalidación de productos, movimientos y dashboard al confirmar.

**D8 · Tests.**
Unit tests del lector común (se mueven los del parser) y de `resolverColumnas` con alias. e2e `import.e2e-spec.ts`: CP-05.1 a CP-05.6 con `.csv` y `.xlsx` generados en el test, límite FREE con 45 productos creados como sistema, reimportación, fila omitida, roles y aislamiento. Las suites de HU-02 siguen en verde tras la extracción del lector.

**D9 · Documentación.** README (rutas, columnas), `docs/arquitectura.html` (§6 `import` con `preview/commit`), `openspec/CAPACIDADES.md`. Sin ADR: aplica ADR 0007 (importación en dos pasos sin persistir el archivo).

## Risks / Trade-offs

- [Vista previa y confirmación con el catálogo cambiado entre medio] → La confirmación relee y omite lo que ya no aplica, informándolo (CP-05.4d).
- [Un `createMany` de 5.000 filas con `movimiento` asociado] → Dos sentencias por lote; en Neon tarda segundos. Los ids se generan en la API para relacionar producto y movimiento sin releer.
- [Costo importado sin proveedor no deja historial] → Igual que el alta manual sin proveedor principal; documentado. Quien quiera historial importa después la lista del proveedor (HU-02).
- [Alias de columnas en español solamente] → Es el público del producto; se documentan en la plantilla y en la pantalla.

## Migration Plan

Sin migración. Despliegue normal de `main`. Rollback: revertir el commit.

## Open Questions

- Si conviene ofrecer también la descarga en `.xlsx` de la plantilla (hoy `.csv`). No cambia specs ni tareas.
