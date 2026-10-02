## Context

- **La API ya expone todo** (sin cambios). Las tres consultas tienen `@Roles('DUENIO','CONTADOR')` y `@RequierePlan('PRO')`:
  - `GET /alerts?estado&cursor&limit` → `{items, siguienteCursor}`;
  - `GET /alerts/summary` → `{activas, criticas, pospuestas, calculadasEn}`;
  - `PATCH /alerts/:id {accion: ATENDER|POSPONER}`, sólo DUENIO; responde 409 si la alerta ya está cerrada;
  - `GET /stockouts?dias=30|60|90&cursor&limit` → `{dias, desde, hasta, totales, items, siguienteCursor}`;
  - `GET /dead-stock?dias=30|60|90|180&cursor&limit` → la misma forma con sus totales.
- **El orden de los *guards*:** primero el rol y después el plan. El EMPLEADO recibe 403 antes que un 402.
- **El panel:** `GET /dashboard` ya trae `alertas.reposicion`, `quiebres` y `stockParado`. Los tres vienen en `null` por debajo de PRO.
- **La app hoy:**
  - `lib/core/modelos/dashboard.dart` ignora esos tres bloques, y `test/fixtures.dart` no los incluye;
  - `ApiException` no distingue el 402;
  - `Me` no tiene ayudas de plan;
  - `lib/core/lista_paginada.dart` lee sólo `items` y `siguienteCursor`;
  - el patrón de lista con "Cargar más" está en `features/inventario/inventario_provider.dart`, un `AsyncNotifier` con `cargarMas()` que acumula páginas y guarda `errorMas`;
  - `features/mas/secciones.dart` devuelve hoy una lista vacía, y "Más" navega con `context.push(e.ruta)`;
  - un 401 o un 403 cierra la sesión sólo cuando viene de `/me` (`core/auth/sesion.dart`). Un 403 de estas pantallas se muestra como error común.
- **La web:** los textos están en `apps/web/src/lib/alertas.ts`, `quiebres-formato.ts` y `stock-parado-formato.ts`, que la app va a replicar.

## Goals / Non-Goals

**Goals:**
- Mismos números y mismos textos que la web, con las frases portadas como funciones puras de Dart y con tests.
- Que una pantalla del plan PRO no haga pedidos inútiles en FREE, igual que la web.
- Sumar las tres pantallas como entradas de "Más", sin tocar la barra inferior.

**Non-Goals:**
- No hay caché local ni uso sin conexión: cada pantalla consulta al abrirse y con "Reintentar", como el resto de la app.
- No se generan los modelos desde OpenAPI. Se siguen escribiendo a mano (ADR 0009).

## Decisions

### D1. Textos como funciones puras, copiados de la web

`lib/core/analisis_formato.dart` porta las frases y los formatos que usa la web:
- `fraseAlertas(resumen)` y `formatearCobertura(dias)` ("sin ventas", "se agota hoy", "1 día", "N días");
- `etiquetaSeveridad`: CRITICA es "Crítica" y PROXIMA es "Próxima al quiebre";
- `fraseQuiebres(resultado)`, `diasLegibles(dias)` ("5,0 días", "menos de un día") y `textoGanancia(item)`, que devuelve "Sin historial suficiente" con `SIN_HISTORIAL`;
- `fraseStockParado(resultado)` y `textoUltimaVenta(item)`, que devuelve "Nunca se vendió" con `null`;
- las constantes `explicacionQuiebres` e `ideasStockParado`.

`formato.dart` suma `formatoPesosEntero`, para las pérdidas sin centavos ("$ 4.000") como `formatearPerdida` en la web.

`test/core/analisis_formato_test.dart` toma los casos de los tests de la web (`quiebres-formato.test.ts` y `stock-parado-formato.test.ts`), para que las dos frases no se desvíen. Las frases de alertas no tienen test en la web y se prueban con casos propios.

**Alternativa descartada:** escribir el texto dentro de cada widget. Repetiría la lógica de plurales y no se podría probar sin levantar la pantalla.

### D2. Ayudas de plan y de rol en `Me`

- **Plan:** `planCumple(String plan, String minimo)` usa el orden FREE < PRO < PREMIUM, como `planCumple` de `packages/shared`.
- **Rol:** `Me.veAnalisis` es DUENIO o CONTADOR.
- **Las dos juntas:** `Me.tienePro` es `planCumple(plan, 'PRO')`.
- **Errores:** `ApiException.esPlanRequerido` es verdadero con `status == 402` o `code == 'PLAN_REQUERIDO'`.

**Alternativa descartada:** comparar `plan == 'PRO'` en cada pantalla. Dejaría afuera a PREMIUM.

### D3. Modelos

En `lib/core/modelos/analisis.dart`:
- **Alertas:** `Alerta` (sólo los campos que se muestran) y `ResumenAlertas`.
- **Quiebres:** `ResultadoQuiebres {dias, desde, hasta, totales: TotalesQuiebres, items: List<ProductoConQuiebres>, siguienteCursor}`.
- **Stock parado:** `ResultadoStockParado`, con la misma forma.

`ListaPaginada` no alcanza para quiebres y stock parado, porque esas respuestas traen totales. `ResultadoQuiebres` y `ResultadoStockParado` tienen su propio `fromJson` y su `copyWith(items, siguienteCursor)` para acumular páginas.

En `dashboard.dart`:
- `AlertasDashboard.reposicion: ReposicionPanel?`, con `total`, `criticas` e `items`;
- `Dashboard.quiebres: QuiebresPanel?` y `Dashboard.stockParado: StockParadoPanel?`;
- todos opcionales y en `null` si faltan, así un panel viejo o FREE no rompe.

### D4. Providers

Siguen el patrón del inventario:
- **Alertas:**
  - `filtroAlertasProvider` (Notifier) guarda el filtro: `ACTIVA`, `POSPUESTA` o `TODAS`;
  - `alertasProvider` (`AsyncNotifier`) tiene `cargarMas()` y `actuar(id, accion)`;
  - `resumenAlertasProvider` (`FutureProvider.autoDispose`) trae el resumen.
  - `actuar` hace el PATCH y, si sale bien, invalida la lista, el resumen y `dashboardProvider`. Si falla, devuelve la `ApiException` para que la pantalla muestre el mensaje y vuelva a cargar (CP-M.9g).
- **Quiebres y stock parado:**
  - `periodoQuiebresProvider` y `periodoStockParadoProvider` (Notifier) guardan el período, con 30 y 90 días por defecto;
  - `quiebresProvider` y `stockParadoProvider` (`AsyncNotifier`) tienen `cargarMas()`;
  - un cambio de período reinicia la lista.
- **Plan FREE:** ninguno pide nada sin plan. El `build` devuelve un estado "sin plan" si `!me.tienePro`, y la pantalla dibuja el aviso (D6) sin consultar.
- **Tamaño de página:** 25, como el inventario.

### D5. Rutas dentro de la rama "Más"

- **Las rutas:** `/mas/alertas`, `/mas/quiebres` y `/mas/stock-parado` son subrutas de `/mas`. Así la barra inferior sigue visible y "atrás" vuelve a "Más".
- **Desde el inicio:** las tarjetas y "Ver alertas" usan `context.go('/mas/...')`, que cambia a la rama "Más". Es el mismo mecanismo que hoy usa "Ver" para ir al inventario filtrado.
- **Permisos:** `rutaPermitida` exige `me.veAnalisis` para las tres. El EMPLEADO vuelve a su inicio aunque escriba la ruta (CP-M.8f).
  - El plan no se controla en el router: la pantalla muestra el aviso del plan PRO (CP-M.10g). Así un dueño FREE que llega desde un enlace entiende por qué no ve nada.
- **Registrar el ingreso:** "Registrar ingreso" va a `/movimientos/nuevo?productoId=…&tipo=INGRESO`. `MovimientoScreen` suma `tipoInicial`, que se aplica una vez al abrir, igual que hoy `productoId`.

### D6. Aviso de plan

`ui/aviso_plan.dart` es un `Aviso` con tono informativo que lleva:
- el texto propio de cada pantalla, el mismo de la web;
- la línea "Podés cambiar de plan desde la web: inventariosmart0.vercel.app".

No hay botón "Ver planes", porque los planes se manejan en la web (ADR 0024).

Si a pesar del control la API responde 402, por ejemplo porque el plan bajó con la app abierta, la pantalla muestra el `message` de la API sin "Reintentar".

### D7. Diseño de las pantallas

Son tarjetas apiladas, como la vista de celular de la web, con los tokens de ADR 0024.

- **Alertas:**
  - **Arriba:** la frase, la línea "Último cálculo: dd/mm, hh:mm" y los chips Activas · N, Pospuestas y Todas.
  - **Cada tarjeta lleva:**
    - el nombre y el código del producto;
    - una píldora de severidad, con el punto de color y el texto `t1`;
    - "Stock N · mín. M";
    - "Vende X por día · cobertura Y";
    - el proveedor con su lead time, o "Sin proveedor · lead time N d por defecto";
    - "Pedir N";
    - el estado, si no está activa ("Pospuesta hasta dd/mm", "Atendida", "Resuelta").
  - **Acciones del DUENIO:** botón tonal "Registrar ingreso" y botones de texto "Atendida" y "Posponer 7 días". Sólo se ofrece lo que corresponde al estado de la alerta.
- **Falta de stock:**
  - **Arriba:** chips "30 días", "60 días" y "90 días", la frase y tres tarjetas de indicador en una grilla de dos columnas.
  - **Cada producto lleva:**
    - el nombre, y "N veces" si tuvo más de un quiebre;
    - "Sin stock: 5,0 días";
    - "Vendía 2,0 por día · 10 unidades";
    - la ganancia perdida a la derecha, o "Sin historial suficiente";
    - la píldora "Sin stock ahora".
  - **Al pie:** la explicación de cómo se estima.
- **Stock parado:**
  - **Arriba:** los mismos chips con "180 días", la frase y los indicadores.
  - **Cada producto lleva:**
    - "Stock N · costo $ X";
    - "Última venta: dd/mm/aaaa · hace N días", o "Nunca se vendió · N días desde el alta";
    - la plata parada a la derecha.
  - **Al pie:** las ideas para liberar esa plata.
- **En las tres:**
  - `RefreshIndicator` para refrescar;
  - "Cargar más" al final;
  - estados vacíos con los textos de la web.

### D8. Inicio

En `_Panel`, después de los cuatro indicadores:

1. **Tarjetas de análisis:** "Perdiste por falta de stock" y "Plata parada en stock", en una fila de dos, cada una sólo si su monto es mayor a cero. Llevan el detalle de la web: "de ganancia en los últimos 30 días · N productos" y "en N productos sin ventas en 90 días".
2. **El bloque "Reposición":**
   - si `reposicion == null` (FREE), el aviso de que las alertas predictivas son del plan PRO;
   - si el total es 0, la frase "Ningún producto se va a quedar sin stock antes de que llegue la reposición.";
   - si hay alertas, hasta cinco filas con "cobertura de stock · pedir N", el total con los críticos y "Ver alertas".
3. **"Más rentables del mes" y "Alertas"** (sin stock y stock bajo) siguen como están.

El empleado no tiene inicio, así que no ve nada de esto.

**Alternativa descartada:** pedir `/alerts` aparte para el inicio. El panel ya trae los cinco primeros y evita un pedido más.

### D9. Tests

- **Formatos y frases:** `analisis_formato_test.dart`, unitario.
- **Modelos:** en `modelos_test.dart`, `fromJson` de los tres resultados y del panel con y sin bloques.
- **Las pantallas:** `alertas_test.dart`, `quiebres_test.dart` y `stock_parado_test.dart`, con `ServidorFalso`.
  - Cubren datos, cambio de filtro o de período, "Cargar más", vacío y FREE sin pedidos.
  - **Alertas:** además, acciones del dueño (verificando el PATCH y su cuerpo), contador sin acciones, y 409 con su mensaje.
  - **Quiebres:** además, el caso `SIN_HISTORIAL`.
  - **Stock parado:** además, "Nunca se vendió".
- **Inicio:** `inicio_test.dart` suma las tarjetas, sus montos en cero, el bloque de reposición y el bloque en FREE.
- **"Más" y router:** `mas_test.dart` suma la matriz de rol por plan de CP-M.8f, y `shell_test.dart` o un test del router verifica que el EMPLEADO no entra a `/mas/alertas`.
- **Movimiento:** `movimiento_test.dart` verifica `?tipo=INGRESO`.
- **Fixtures:** `dashboardJson` suma los parámetros opcionales `reposicion`, `quiebres` y `stockParado`. Hay fixtures nuevas `alertaJson`, `quiebresJson` y `stockParadoJson`.

## Risks / Trade-offs

- [Las frases de Dart se desvían de las de la web con el tiempo] → Los tests de Dart copian los casos de los tests de la web. Un cambio de texto en la web tiene que repetirse en la app, y se anota en el README de la app.
- [El plan cambia con la app abierta y la pantalla muestra datos de un plan que ya no tiene] → `meProvider` se refresca al reabrir. Si la API responde 402, se muestra su mensaje (D6).
- [Tres pantallas más alargan la suite de widget tests] → Usan el mismo servidor falso, sin red, y siguen dentro del tiempo del job de CI.
- [`context.go` desde el inicio cambia de pestaña y el dueño puede no notarlo] → La barra inferior marca "Más" activa y "atrás" vuelve a "Más". En la web pasa lo mismo, porque esas pantallas viven en la sección "Análisis".

## Migration Plan

No hay datos ni API que migrar. La versión nueva de la app funciona con la API ya desplegada. Para volver atrás, se revierte el commit.
