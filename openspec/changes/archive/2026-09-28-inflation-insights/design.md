## Context

Ver proposal.md – Why. Lo que ya existe y esta change reutiliza: `movimiento.precio_unitario` (precio con IVA de cada venta) y `precio_proveedor` (historial de costos netos por proveedor, sólo inserción, HU-02); `ProductsService.crear/actualizar` e `ImportService` como únicos lugares donde cambia `producto.precio_venta`; funciones de RN-01 en `packages/shared/src/rentabilidad.ts`; `PlanGuard`, roles, `TenantContext`, `comoSistema`; patrón de cron por `@nestjs/schedule` 6 y de doble de servicio externo (`Mailer` / `LogMailer`); tokens de tema y componentes `ui/` de ADR 0012. Node 22 trae `fetch` y `AbortSignal.timeout`.

Fuentes verificadas el 28/09/2026:
- INDEC por la API de Series de Tiempo: `GET https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26,147.3_IBIENESNAL_DICI_T_19&start_date=AAAA-MM-01&format=json&metadata=none` → `{ data: [["2026-08-01", 12276.766, 12025.8226], …] }`. Mensual, base diciembre 2016, con un mes de rezago.
- BCRA: `GET https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/{id}?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` → `{ results: [{ idVariable, detalle: [{ fecha, valor }] }] }`; 27 inflación mensual, 28 interanual, 4 tipo de cambio minorista. La v3 responde 410.

Restricciones: Render Free duerme (el cron no corre dormido); las fuentes son de terceros y pueden caerse; los e2e no dependen de la red; toda tabla de negocio lleva `comercio_id` y RLS.

## Goals / Non-Goals

**Goals:**
- Indicadores oficiales siempre disponibles aunque la fuente falle, con la fecha y la fuente a la vista.
- Una comparación reproducible y explicable: mismas fórmulas en shared, con tests.
- Historial de precios correcto de acá en adelante y razonable hacia atrás.
- Gráfico propio, accesible y coherente con los dos temas.

**Non-Goals:**
- Precios Claros / SEPA, dólar paralelo, proyecciones, inflación por rubro, remarcación en lote, WhatsApp, mobile.

## Decisions

### D1 · Contrato y reglas en `packages/shared/src/inflacion.ts`
`SERIES_INDICADOR = ['IPC_GENERAL','IPC_BIENES','INFLACION_MENSUAL','INFLACION_INTERANUAL','USD_MINORISTA']`, `UMBRAL_ALINEADO_PCT = 2`, `MESES_MAX = 24`, `MESES_DEFAULT = 6`. Funciones puras con tests: `variacionPct(inicial, final)` (ya existe en `dashboard.ts`, se reutiliza), `variacionReal(nominalPct, referenciaPct)` (RN-11, 2 decimales), `indiceBase100(valores)` (serie → base 100 al primer valor no nulo), `valorCanasta(items, valorDe)` (Σ unidades × valor), `estadoPrecio(variacionRealPct)`, `precioSugeridoInflacion(precioInicial, ipcPct)`, `precioSugeridoMargen(precioInicial, costoInicial, costoFinal)` (precio inicial × costo final ÷ costo inicial; sin costo inicial mayor a cero devuelve el precio inicial), `listaMeses(desde, hasta)` (`mesesEntre` ya existía en `gastos.ts` como diferencia en meses y se reutiliza), `variacionSerie`, `compararProducto`, `ordenarPorAtraso` e `inicioDeMes` / `cierreDeMes` / `mesDe` en Buenos Aires. Esquemas zod: `IndicadoresSchema`, `InflacionQuerySchema` (`desde`, `hasta` `AAAA-MM` opcionales; `desde ≤ hasta`; hasta 24 meses), `ComparacionInflacionSchema` (`desde`, `hasta`, `recortado`, `meses[]`, `series { misPrecios, misCostos, ipc, ipcBienes }` como arreglos de strings o null alineados con `meses`, `variaciones`, `brechas`, `motivo` (`SIN_VENTAS`, o `SIN_IPC` si todavía no se pudo traer el índice), `productos[]` con `datosDesde`), `PrecioHistorialSchema`. Alternativa descartada: calcular en SQL; las reglas quedarían sin tests unitarios.

### D2 · Modelo de datos
- `indicador_economico`: `id`, `serie` (enum `SerieIndicador`), `fecha DATE`, `valor DECIMAL(18,4)`, `fuente VARCHAR(40)`, `actualizado_en`; único `(serie, fecha)`; índice `(serie, fecha DESC)`. **Sin `comercio_id` ni RLS de tenant**: es dato público de referencia, igual para todos los comercios. RLS activa y forzada con una política de lectura abierta (`FOR SELECT USING (true)`) y otra de escritura sólo de sistema; `app_api` tiene `SELECT`, `INSERT` y `UPDATE` (el servicio escribe con `comoSistema`, que usa ese mismo rol) y no tiene `DELETE`. Fuera del contexto de sistema, la política rechaza toda escritura. No entra en `TENANT_MODELS`. Se documenta en el runbook como la única excepción a la regla.
- `indicador_actualizacion`: una fila por fuente (`fuente` como clave) con `actualizado_en` (última consulta exitosa), `intentado_en` (último intento) y `ultimo_error`. Por fuente y no una sola fila, porque una puede responder y la otra no. Mismas políticas y privilegios que `indicador_economico`.
- `precio_venta_historial`: `id`, `comercio_id`, `producto_id`, `precio_venta DECIMAL(14,2)`, `alicuota_iva DECIMAL(5,2)`, `vigente_desde TIMESTAMPTZ`, `origen` (enum `OrigenPrecioVenta`: ALTA, EDICION, IMPORT, INICIAL), `usuario_id NULL`, `creado_en`; índice `(comercio_id, producto_id, vigente_desde DESC)`; RLS de tenant y sistema; `app_api` con SELECT e INSERT, sin UPDATE ni DELETE (como `precio_proveedor`). Entra en `TENANT_MODELS`.
- **Relleno inicial** en la migración: por producto, una fila `INICIAL` por cada cambio de `precio_unitario` observado en sus ventas en orden de fecha (`lag()`; así un precio que sube y vuelve a bajar queda registrado las dos veces), con `vigente_desde` igual a la fecha de esa venta; más una fila con el precio actual y `vigente_desde = actualizado_en` si difiere del último observado; productos sin ventas, una fila con el precio actual y `vigente_desde = creado_en`.
Queda en **ADR 0014**.

### D3 · Fuentes con doble para tests
`abstract class FuenteIndicadores { abstract leer(desde: Date): Promise<LecturaIndicador[]> }` con dos implementaciones: `FuenteIndec` (una llamada con las dos series) y `FuenteBcra` (tres llamadas en paralelo). Ambas con `fetch`, `AbortSignal.timeout(10_000)`, validación de la forma de la respuesta con zod y error tipado si no coincide. `FuenteFalsa` en tests (datos fijos, contador de llamadas, modo falla). Proveedor por `NODE_ENV`, igual que `mailerProvider`. URLs por `INDEC_API_URL` y `BCRA_API_URL` opcionales en `env.ts`. Alternativa descartada: un paquete SDK de terceros; son dos GET.

### D4 · Actualización: cron, bajo demanda y tolerancia
`IndicatorsService.actualizarSiVence()`: lee `indicador_actualizacion`; para cada fuente con `actualizado_en` nulo, de más de 24 h o con error, consulta desde 25 meses atrás (fuera de la transacción), toma `pg_try_advisory_xact_lock` al escribir (el lock de sesión no sirve detrás del pooler de Neon), hace `upsert` por `(serie, fecha)` y registra el resultado; si una fuente falla, guarda el error, actualiza lo que sí respondió y no propaga la excepción. Tras una falla espera 15 minutos antes de reintentar, para no pagar el tiempo de corte en cada pedido. Las lecturas van en contexto de sistema (`comoSistema`): las tablas no son de ningún comercio y el job corre sin request. `IndicatorsCron` diario a las 09:00 de Buenos Aires (no corre en tests). `GET /indicators` y `GET /insights/inflation` llaman a `actualizarSiVence()` antes de responder. `desactualizado` = alguna fuente con el último intento en error, sin ninguna consulta exitosa o con `actualizado_en` de más de 48 h; `actualizadoEn` es la consulta exitosa más antigua entre las fuentes. Alternativa descartada: consultar la fuente en cada pedido; ata la latencia y la disponibilidad del panel a un tercero.

### D5 · Captura del historial de precios
Función única `registrarPrecioVenta(tx, { comercioId, productoId, precioVenta, alicuotaIva, origen, usuarioId })` en `products/price-history.ts`, llamada dentro de la misma transacción por `ProductsService.crear` (ALTA), `ProductsService.actualizar` cuando `precioVenta` o `alicuotaIva` cambian (EDICION) e `ImportService` en altas y actualizaciones con precio distinto (IMPORT, en lote con `createMany`). Compara contra la última fila del producto para no duplicar. `GET /products/:id/price-history` (DUENIO, CONTADOR; plan PRO) por cursor.

### D6 · Cálculo de la comparación en `InsightsService.inflacion(q)`
(1) Resuelve el período: `hasta` = min(pedido, último mes con `IPC_GENERAL`), `desde` por defecto `hasta − 5 meses`; marca `recortado`. (2) Una consulta trae por producto activo: unidades vendidas en el período (VENTA no anuladas entre el inicio de `desde` y el fin de `hasta`, límites de mes en Buenos Aires) y, por subconsultas correlacionadas sobre los cierres de mes (agregadas con `array_agg` en una fila por producto), el precio vigente (`precio_venta_historial` con `vigente_desde ≤ cierre`, el más reciente; si no hay, el primero conocido) y el costo vigente (`precio_proveedor` del proveedor principal con el mismo criterio; si no hay, `costo_reposicion`). (3) En memoria: canasta con los productos con unidades > 0, `valorCanasta` por mes para precios y costos, `indiceBase100`, IPC del mismo mes en base 100, variaciones, `variacionReal` para las brechas, y por producto las cifras de D1. Presupuesto: 5.000 productos × 12 meses = 60.000 filas de una consulta; menos de 3 s en CI, con prueba de carga como en HU-04 y HU-06.

### D7 · Endpoints y permisos

| Método y ruta | Roles | Plan | Descripción |
| --- | --- | --- | --- |
| `GET /indicators` | todos | todos | Últimos indicadores con fuente, fecha y `desactualizado` |
| `GET /insights/inflation?desde&hasta` | DUENIO, CONTADOR | PRO | Series, variaciones, brechas y productos |
| `GET /products/:id/price-history?cursor&limit` | DUENIO, CONTADOR | PRO | Historial de precios de venta |

`IndicatorsModule` exporta `IndicatorsService`; `InsightsModule` lo importa. OpenAPI y cliente regenerados con `pnpm openapi`.

### D8 · Web
- `ui/GraficoLineas.tsx`: SVG propio con `viewBox` fijo y ancho fluido; ejes con 4 líneas guía y etiquetas de mes; hasta 4 series con color por token (`--color-brand-3` mis precios, `--color-warn` mis costos, `--color-violet` IPC, `--color-t3` IPC bienes punteada); puntos con `<title>` y panel de valores al pasar el cursor o enfocar con teclado (cada mes es un punto enfocable); animación de trazo con `stroke-dashoffset` que respeta `prefers-reduced-motion`; `role="img"` con `aria-label` que resume las variaciones y una tabla plegable "Ver datos" con los mismos números. Sin librería de gráficos (ADR 0012).
- `lib/inflacion.ts`: `useIndicadores()`, `useComparacionInflacion(meses)`, `fraseInflacion(c)`, `formatearUsd`.
- `features/inflacion/InflacionPage.tsx` (`/inflacion`, `RequireRole(['DUENIO','CONTADOR'])`): frase de cabecera, chips 3 / 6 / 12 meses, gráfico, cuatro KPI (mis precios, mis costos, inflación, brecha real) con `Anillo`/`MontoAnimado` donde aplique, aviso si `recortado` o `desactualizado`, tabla de productos (tarjetas por debajo de `sm`) con estado en chip de color, precios sugeridos y enlace al producto; `EstadoVacio` con motivo `SIN_VENTAS`; aviso de plan en FREE.
- Ajustes de la verificación visual: la tabla de productos pasa a tarjetas por debajo de `md` y oculta la columna Costo por debajo de `lg`; filtro por estado y "Ver más" de a 25; el gráfico se dibuja al ancho real del contenedor para que el texto no se achique en el celular. La barra de navegación muestra las etiquetas sólo si entran todas (mide con `ResizeObserver`); si no, deja los iconos con su tooltip: con el enlace nuevo el dueño en plan PRO tiene 12 secciones y las etiquetas se superponían con los botones de la derecha.
- `features/home/HomePage.tsx`: tarjeta "Contexto" con `useIndicadores()` para todos los roles; el stock en dólares sólo para DUENIO y CONTADOR (usa `stock.valorizacion` del panel ÷ dólar). `AppShell`: enlace "Inflación" (`LineChart`) para DUENIO y CONTADOR con plan PRO.

### D9 · Tests
Shared: `inflacion.test.ts` con los números de CP-15.3 y CP-15.4 (118, 122, −1,67, −3,28, −8,33, 8,33, sugeridos 1200, 2400 y 2500), alineado en el borde de ±2, base 100 con nulos, período inválido. API unit: fuentes con `fetch` simulado (forma válida, forma inesperada, timeout, 410), cron. e2e `inflation.e2e-spec.ts`: CP-15.1 a CP-15.5c con `FuenteFalsa`, historial por alta, edición e importación, precios fechados mediante el relleno con la propietaria, plan FREE, roles, aislamiento y carga sintética; `rls.e2e-spec.ts` cubre `precio_venta_historial` (sin UPDATE ni DELETE) e `indicador_economico` (lectura sin contexto permitida, escritura rechazada). Web: test de `GraficoLineas` (puntos por serie, tabla alternativa, serie vacía).

### D10 · Documentación
ADR 0014; README (rutas de HU-15, fuentes y variables opcionales); `docs/arquitectura.html` (§6 `indicators` e `insights`, RN-11 en la tabla de reglas, servicios externos); `docs/runbooks/rls.md` (tabla de referencia sin tenant); `openspec/config.yaml` (HU-15, RF-16 y RN-11 en el contexto); `openspec/CAPACIDADES.md`.

## Risks / Trade-offs

- [La fuente cambia de versión o de forma, como pasó con la v3 del BCRA] → validación de forma con zod, error registrado, datos guardados servidos con `desactualizado`; URLs configurables.
- [Historial reconstruido impreciso para productos que nunca se vendieron] → se marca `origen: INICIAL` y la tabla muestra desde cuándo hay datos del producto.
- [IPC general poco representativo de un rubro] → se muestra también IPC de bienes; elegir rubro queda como evolución.
- [Canasta fija sesgada por pocos productos con muchas ventas] → es el comportamiento buscado (pesa lo que más se vende); la tabla por producto muestra el detalle.
- [Tabla sin `comercio_id`] → excepción única, documentada, con escritura sólo de sistema y test de privilegios.
- [Precios sugeridos interpretados como obligatorios] → texto "sugerido" y aclaración de que no cambian nada hasta que el dueño edite el precio.

## Migration Plan

1. Migración `20260929_inflation_insights` (enums, tablas, RLS, privilegios, relleno del historial) con `prisma migrate deploy` en Neon dev y en producción por Render. 2. Deploy de API y web (aditivo). 3. Primera consulta en producción llena los indicadores. Rollback: revertir el commit; la migración es aditiva y puede quedar.

## Open Questions

- Si la cátedra pide sumar Precios Claros para rubros de consumo masivo, se hace en una change aparte con ingesta por archivo; no cambia esta.
