# ADR 0017 · Comparador de proveedores calculado al consultar, con puntaje ponderado

**Estado:** aceptada · 28/09/2026

## Contexto

HU-02 guarda el historial de costos de cada proveedor por producto y HU-07 arma órdenes eligiendo un proveedor, pero el dueño no tenía dónde ver, insumo por insumo, a quién le conviene comprarle. El precio solo no alcanza: un proveedor más barato que tarda una semana o que falla entregas puede salir más caro que otro que cobra un poco más. HU-12 (RF-12) pide comparar a los proveedores de un mismo insumo y recomendar uno, en el plan PREMIUM.

## Decisión

1. **RN-13, puntaje ponderado**: puntaje = 0,60 × precio + 0,25 × plazo + 0,15 × confiabilidad, de 0 a 100 con dos decimales. Precio = 100 × costo mínimo ÷ costo; plazo = 100 × (plazo mínimo + 1) ÷ (plazo + 1), para que la entrega en el día no divida por cero; confiabilidad = 100 × estrellas ÷ 5. Los mínimos se toman entre los proveedores que se comparan, así el puntaje es relativo al insumo. El recomendado es el de mayor puntaje; ante un empate, el de menor costo, menor plazo, mayor confiabilidad y, por último, el primero por nombre.
2. **La regla vive en `packages/shared`** (`comparador.ts`): la API la aplica y la web usa los mismos pesos para explicar el cálculo.
3. **Nada se guarda**: la comparación se calcula en cada consulta con el último costo de cada proveedor activo. Importar una lista, cambiar el plazo o la confiabilidad, o dar de baja a un proveedor se refleja en la consulta siguiente, sin jobs ni invalidaciones. Por eso el change no tiene migración.
4. **Consultas de una sola tabla y cruce en memoria**: un `DISTINCT ON (proveedor, producto)` sobre `precio_proveedor` en el orden de su índice, más los proveedores activos, los productos activos y las unidades vendidas en 30 días, cada uno en su consulta. El cruce se hace con `Map`. Así el plan no depende de las estadísticas de la base, que fue lo que hizo lentos al panel y a la comparación con la inflación cuando las tablas estaban recién cargadas.
5. **Resumen ordenado por ahorro estimado**: ahorro = (costo del principal − costo del recomendado) × unidades vendidas en 30 días, sólo cuando es positivo. El orden sale de un cálculo en memoria, así que la paginación usa un cursor de posición en lugar de uno de clave. Los totales se calculan sobre todos los insumos comparables, sin los filtros.
6. **"Usar como principal" reutiliza `PATCH /products/:id`**: cambiar el proveedor principal ya actualiza el costo de reposición (RN-08). No hay una ruta nueva que duplique esa regla. La web pide confirmación porque el cambio mueve el costo y, con él, los márgenes.
7. **Plan PREMIUM y sólo el dueño**: `@RequierePlan('PREMIUM')` y `@Roles('DUENIO')`, igual que proveedores y costos (CP-02.7).

## Alternativas consideradas

- **Recomendar siempre al más barato**: es lo que hace la sugerencia de órdenes (HU-07), y alcanza para armar un pedido, pero no explica por qué conviene un proveedor ni tiene en cuenta el plazo y la confiabilidad que el dueño ya carga.
- **Guardar los puntajes** (tabla o vista materializada): obliga a recalcular en cada importación, edición y baja; con 15.000 costos el cálculo al consultar entra en el presupuesto de 3 segundos.
- **Pesos configurables por comercio**: suma una pantalla y una decisión que el dueño no pidió; los pesos quedan en una constante y se pueden abrir después.
- **Puntaje absoluto** (por ejemplo, plazo contra un máximo fijo): no distingue entre proveedores parecidos; el relativo responde a la pregunta real, que es cuál de estos conviene.
- **Ordenar y paginar en SQL**: exige calcular el puntaje en la base y duplicar la regla de `packages/shared`.

## Consecuencias

- El comparador puede recomendar a un proveedor que no es el más barato; la web muestra los tres componentes, quién es el más barato y desde cuándo rige cada costo, para que se vea por qué.
- La sugerencia de órdenes (HU-07) sigue eligiendo al más barato: el comparador y las órdenes pueden no coincidir. Si el dueño marca al recomendado como principal, las órdenes de los productos sin costos cargados ya lo usan. Unificar las dos reglas queda como decisión de producto.
- La confiabilidad es la que carga el dueño; el sistema no la mide con las entregas.
- El resumen se calcula entero en cada consulta. Con catálogos mucho mayores a 5.000 productos habría que paginar en la base o guardar el resultado.
- Un cursor de posición puede saltear o repetir un insumo si los costos cambian entre una página y la siguiente; para una lista de consulta es aceptable.
- Mientras no exista la gestión de planes (HU-14), pasar un comercio a PREMIUM se hace en la base.
