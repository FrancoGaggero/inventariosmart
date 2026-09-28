# ADR 0014 · Indicadores oficiales con caché y tolerancia a fallos, historial de precios de venta e índice propio de canasta fija

**Estado:** aceptada · 28/09/2026

## Contexto

La Propuesta presenta a InventarioSmart como pensado para el contexto inflacionario argentino (RNF-08), pero hasta HU-09 nada del producto usaba la inflación. HU-15 (RF-16) responde una pregunta que los sistemas de gestión no contestan: si los precios y los costos del comercio le ganan o le pierden a la inflación. Hacen falta tres cosas que no existían: indicadores oficiales, el historial de precios de venta (sólo se guardaba el precio vigente) y una forma explicable de comparar.

Fuentes verificadas el 28/09/2026, públicas y sin credenciales: la API de Series de Tiempo de datos.gob.ar (IPC nacional del INDEC, nivel general y bienes, mensual, con un mes de rezago) y la API de estadísticas del BCRA v4.0 (inflación mensual e interanual, tipo de cambio minorista). La v3 del BCRA ya responde 410: las fuentes cambian. Precios Claros se descartó: el servicio de consulta respondió con error y los datos abiertos sólo cubren grandes supermercados.

## Decisión

1. **Tabla de referencia sin `comercio_id`**: `indicador_economico` (serie, fecha, valor, fuente; única por serie y fecha) es dato público, igual para todos los comercios. Es la única excepción a ADR 0002: tiene RLS activa y forzada con una política de lectura abierta y otra de escritura sólo para el contexto de sistema; `app_api` no puede borrar. No entra en `TENANT_MODELS`.
2. **Las fuentes nunca se consultan en el camino del usuario más de una vez por día**: `indicador_actualizacion` guarda por fuente la última consulta exitosa, el último intento y el último error. `IndicatorsService.actualizarSiVence()` consulta sólo las fuentes cuyo dato tiene más de 24 horas; tras una falla espera 15 minutos antes de reintentar. Un job diario a las 09:00 las actualiza igual, y la consulta bajo demanda cubre a Render dormido.
3. **Tolerancia a fallos**: cada fuente tiene corte a los 10 segundos y valida la forma de la respuesta con zod. Si falla, se registra el error, se conserva lo guardado y la API responde 200 con `desactualizado: true` y la fecha de la última actualización. Si una fuente responde y otra no, se guarda lo que llegó.
4. **Fuentes intercambiables**: `FuenteIndicadores` con `FuenteIndec` y `FuenteBcra` (`fetch` nativo de Node 22, sin dependencias nuevas) y `FuenteFalsa` en tests, igual que `Mailer`. Las URL son configurables (`INDEC_API_URL`, `BCRA_API_URL`).
5. **Historial de precios de venta de sólo inserción**: `precio_venta_historial` por comercio, con los mismos privilegios que `precio_proveedor` (ADR 0007). Una única función (`registrarPrecioVenta`) lo alimenta dentro de la transacción del alta, la edición y la importación, y sólo cuando el precio o la alícuota cambian. La migración reconstruye el pasado con cada cambio de precio observado en las ventas ya registradas (origen `INICIAL`).
6. **Índice propio de canasta fija**: mis precios y mis costos se llevan a índice base 100 valuando, al cierre de cada mes, la canasta de productos con ventas en el período ponderada por las unidades vendidas en todo el período. Es el mismo criterio que usa un índice de precios: la canasta no cambia dentro del período, así el índice mide precios y no cambios en lo que se vendió.
7. **RN-11, variación real**: ((1 + variación nominal) ÷ (1 + variación de referencia) − 1) × 100. Un precio está atrasado si su variación real contra el IPC general es menor a −2 %, adelantado si supera +2 % y alineado en el medio. Las fórmulas viven en `packages/shared/src/inflacion.ts` con tests.
8. **Precios sugeridos informativos**: uno acompaña a la inflación y otro sostiene el margen bruto porcentual del inicio con el costo final (RN-01). Consultar no cambia ningún precio.
9. **Gráfico propio en SVG** (`ui/GraficoLineas`), sin librería, coherente con ADR 0012: se dibuja al ancho real del contenedor, usa los tokens del tema y ofrece una tabla con los mismos datos.

## Alternativas consideradas

- **Consultar la fuente en cada pedido**: ata la latencia y la disponibilidad del panel a un tercero.
- **Promedio simple de variaciones por producto**: un producto que casi no se vende pesaría igual que el más vendido.
- **Canasta que cambia cada mes** (ponderar por las ventas de cada mes): mezcla variación de precios con variación de lo vendido.
- **Restar porcentajes** (18 % − 20 % = −2 %): es una aproximación que se aleja con inflación alta; RN-11 usa el cociente.
- **Reconstruir precios sólo desde las ventas al consultar**: deja sin historia a los productos que no se vendieron y no registra quién cambió el precio.
- **Precios Claros / SEPA**: servicio inestable, archivos de millones de filas y alcance limitado a supermercados.
- **Librería de gráficos**: decenas de kilobytes para un solo gráfico de líneas.

## Consecuencias

- El IPC se publica con un mes de rezago: la comparación llega hasta el último mes publicado y lo informa.
- El IPC del mes es un promedio del mes y los precios propios se toman al cierre: la comparación es una aproximación mensual, suficiente para decidir una remarcación.
- El historial anterior a esta change es aproximado: los productos que nunca se vendieron sólo conocen su precio actual. La respuesta informa desde cuándo hay datos de cada producto.
- Los costos salen del historial del proveedor principal; sin historial, el costo vigente se toma como constante.
- La comparación devuelve todos los productos activos en una respuesta; la web los muestra de a 25. Con 5.000 productos y 12 meses responde en menos de 3 segundos.
- Si una fuente cambia de versión, el arreglo queda acotado a su clase y los usuarios siguen viendo el último dato.
