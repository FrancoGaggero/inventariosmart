## Context

- **Paleta actual:** `apps/mobile/lib/app/theme.dart` define una clase `AppColors` con constantes estáticas de la paleta azul y un único `ThemeData.dark`. Unas 40 referencias a `AppColors.*` repartidas en siete archivos usan esas constantes de forma directa. Además hay dos colores fijos: el degradé violeta y el ícono blanco del logo del login.
- **Por qué hay que cambiar el mecanismo:** con constantes estáticas, un segundo tema no es posible. El color tiene que salir del `BuildContext`.
- **Navegación actual:**
  - es un `StatefulShellRoute.indexedStack` con tres ramas (inicio, inventario y movimiento);
  - `pestaniasDe(me)` filtra las pestañas por rol, y con menos de dos no hay barra, que es lo que le pasa hoy al CONTADOR;
  - "Cerrar sesión" vive en `MenuSesion`, un `PopupMenuButton` que se repite en la barra superior de las tres pantallas.
- **La referencia de la web:** sus tokens están en `apps/web/src/index.css` (ADR 0022) y su test de contraste en `apps/web/src/lib/contraste.test.ts`. El tema web es binario, oscuro o claro, con la preferencia guardada y el del sistema como valor por defecto.
- **API, base y contrato:** no se tocan. No hay tablas, endpoints, módulos de NestJS ni cambios en `packages/shared`.

## Goals / Non-Goals

**Goals:**
- Que una pantalla nueva tome sus colores del tema y nunca de una constante, así las próximas changes del celular nacen con los dos temas.
- Que los valores de la paleta sean los de la web, sin una segunda fuente de verdad que se desvíe en silencio.
- Que "Más" se arme con datos, como `lib/navegacion.ts` en la web, para que sumar una pantalla sea agregar una entrada.

**Non-Goals:**
- No se generan los colores desde `index.css` en el build. Se copian a mano con un comentario que apunta al archivo de la web, y el test de contraste los vigila.
- No se rediseña el contenido de las pantallas. Cambian los colores, los radios y los componentes; el texto, el orden y el comportamiento quedan igual.

## Decisions

### D1. Tokens como `ThemeExtension`, no como constantes

- **Qué se define:** `class Tokens extends ThemeExtension<Tokens>`, con los mismos nombres semánticos de la web: `bg`, `bg2`, `card`, `card2`, `field`, `t1`, `t2`, `t3`, `line`, `line2`, `fill`, `brand`, `brand2`, `brand3`, `onBrand`, `ok`, `warn`, `crit`, `violet`, `whatsapp`, `onWhatsapp`, `inverso`, `onInverso` y `acentoInverso`. `violet` y `whatsapp` todavía no se usan, pero se copian para que la comparación con la web (D6) sea completa.
- **Las dos instancias:** `Tokens.oscuro` y `Tokens.claro`, con los valores hexadecimales de `index.css`.
- **Cómo se usan:** con el *getter* `context.tokens`, en una extensión de `BuildContext`. `estadoStock(estado)` pasa a ser un método de `Tokens`.
- **Material:** `buildTheme(Brightness)` arma el `ColorScheme` a mano desde los tokens, con `primary: brand`, `onPrimary: onBrand`, `surface: card`, `error: crit`, `outline: t3`, `outlineVariant: line2` y demás. También arma `cardTheme`, `filledButtonTheme`, `navigationBarTheme` e `inputDecorationTheme`, y registra la extensión.
- **Alternativas descartadas:**
  - `ColorScheme.fromSeed(brand)` genera tonos propios de Material, que no coinciden con la web y cambian entre versiones de Flutter.
  - Mantener `AppColors` y sumar `AppColorsClaro` obligaría a decidir el tema en cada pantalla.
  - Usar sólo `Theme.of(context).colorScheme` no alcanza: Material no tiene `ok`, `warn`, `t3`, `line` ni `fill`.

### D2. Preferencia de tema con `shared_preferences`

- **El estado:** `enum PreferenciaTema { sistema, claro, oscuro }` en un `Notifier` de Riverpod (`temaProvider`). Al arrancar lee la clave `tema` y, cuando cambia, la guarda.
- **El arranque:** `main.dart` hace `SharedPreferences.getInstance()` antes de `runApp` y lo inyecta con un *override* de `preferenciasProvider`. Así el primer cuadro ya sale con el tema correcto, sin parpadeo.
- **La app:** `MaterialApp.router` recibe `theme: buildTheme(Brightness.light)`, `darkTheme: buildTheme(Brightness.dark)` y `themeMode`, que sale de la preferencia (sistema, claro u oscuro).
- **Tests:** usan `SharedPreferences.setMockInitialValues`.
- **Diferencia con la web:** la web tiene dos opciones y no tres. En Android "Sistema" es lo habitual, y sin esa opción, quien eligió una vez no podría volver a seguir al sistema. Se registra como diferencia deliberada en ADR 0024.
- **Alternativas descartadas:** `flutter_secure_storage`, que es para secretos y no hace falta acá, y guardar la preferencia en la API, que suma un endpoint para algo que es del dispositivo.

### D3. Barras del sistema

- Se usa `AnnotatedRegion<SystemUiOverlayStyle>` en el *builder* de `MaterialApp`: íconos oscuros sobre la barra de estado transparente en tema claro, íconos claros en oscuro, y la barra de navegación de Android con el color `bg`.
- **Alternativa descartada:** `SystemChrome.setSystemUIOverlayStyle` imperativo, que no sigue a un cambio de tema del sistema mientras la app está abierta.

### D4. "Más" como cuarta rama y como lista de datos

- **La ruta:** `Rutas.mas = '/mas'` es una cuarta `StatefulShellBranch`, y `Pestania` suma `mas('Más', Icons.menu_outlined, Icons.menu)`. `pestaniasDe(me)` siempre termina con `mas`, así que con cualquier rol hay al menos dos pestañas y la barra siempre se ve. `rutaPermitida` deja pasar `/mas` para todos.
- **El contenido:** `lib/features/mas/mas_screen.dart` dibuja lo que devuelve `seccionesMas(me)`, una función pura en `lib/features/mas/secciones.dart`. Hoy devuelve una lista vacía de secciones de pantallas. Las changes que vienen le agregan, por ejemplo, la sección "Análisis" con Falta de stock y Stock parado, filtradas por rol y plan.
- **Lo que va fijo debajo de esas secciones:**
  - la tarjeta de la cuenta: comercio, email, rol con `nombreRol` y plan con un `nombrePlan` nuevo (`FREE → Free`, `PRO → Pro`, `PREMIUM → Premium`), todo tomado de `meProvider`;
  - "Apariencia", con un `SegmentedButton<PreferenciaTema>`;
  - "En la web", con la lista de tareas de gestión y la dirección `inventariosmart0.vercel.app` como texto que se puede seleccionar;
  - el botón "Cerrar sesión", de borde en `crit`.
- **`MenuSesion` se borra.** Las barras superiores quedan sólo con su título.
- **Alternativas descartadas:**
  - Un `Drawer` con hamburguesa: ADR 0022 lo descartó en la web porque esconde los destinos.
  - Un *bottom sheet* modal como el "Más" de la web: en Flutter, una rama propia conserva su estado y su scroll con `indexedStack`, y deja crecer la lista sin límite de alto.
  - Dejar `MenuSesion` además de "Más": duplica la salida.

### D5. Contraste como test de Dart

- **Qué mide:** `test/app/contraste_test.dart` calcula la luminancia relativa y la razón WCAG con las fórmulas de la web.
- **Los colores con transparencia** (`line` y `fill`) se componen sobre su fondo antes de medir.
- **Los pares que verifica en los dos temas:**
  - `t1`, `t2` y `t3` sobre `bg` y `card`;
  - `onBrand` sobre `brand`;
  - `brand3`, `ok`, `warn` y `crit` sobre `card` como texto;
  - `t3` sobre `field` como borde de los campos, con un mínimo de 3:1. **Ajuste de la implementación:** el design proponía `line2`, que es un velo del 14 % y queda en 1,5:1; el borde de campos y botones con borde pasa a `t3`, como el `outline` de Material;
  - el texto `t1` sobre la barra inferior y sobre su indicador ámbar tonal;
  - `onInverso` y `acentoInverso` sobre `inverso`.
- **Diferencia con la web:** no lee `index.css`. Si alguien cambia un valor en la web y no en el celular, el test no lo detecta. Se mitiga en D6.

### D6. Una sola fuente de verdad para los valores

- **El test de paridad:** `test/app/tokens_web_test.dart` lee `../web/src/index.css`, extrae los `--color-*` de `@theme` y de `:root[data-theme='light']`, y compara cada uno con su par en `Tokens.oscuro` y `Tokens.claro`.
- **Cuándo corre:** el CI de Flutter corre con el repo completo, así que el archivo está. Si falta, porque se ejecuta fuera del monorepo, el test se saltea con un mensaje.
- **Lo que no compara:** sólo los tokens de color que existen en los dos lados. Las sombras y los radios no se comparan.
- **Alternativa descartada:** generar un `tokens.g.dart` desde el CSS con un script. Suma un paso de build en un proyecto que no está en el workspace de Node (ADR 0005), para veinte valores.

### D7. Logo y colores fijos

- `ui/logo.dart` es un cuadrado de 40 px con radio 12, en `brand`, con el ícono `bar_chart_rounded` en `onBrand`. Va en el login y el onboarding.
- **Verificación:** al terminar, `grep -rn "Color(0x\|Colors\." lib` sólo tiene que encontrar coincidencias en `theme.dart` y en `Colors.transparent`.

### D8. Componentes con criterios de Material 3

- **Botones:** `FilledButton`, el principal, en `brand` con texto `onBrand`. `FilledButton.tonal` en `fill` con texto `brand3`. `OutlinedButton` con borde `t3`.
- **Tarjetas:** `Card` con `card`, sin elevación en oscuro y con elevación 1 en claro, y `RoundedRectangleBorder(20)`.
- **Barra inferior:** `NavigationBar` con fondo `bg2`, indicador `brand` al 18 % y etiquetas siempre visibles.
- **Campos:** `InputDecorationTheme` con relleno `field`, borde `t3` (ver D5) y foco `brand` de 2 px, y radio 12.
- **Estado de stock:** el punto del color del estado junto a la etiqueta escrita ("OK", "Stock bajo", "Sin stock") en la misma fila, como ya mostraba la app; los chips de filtro llevan el mismo punto (CP-M.7d). **Ajuste de la implementación:** no se usa una píldora con texto del color del estado, porque `ok`, `warn` y `crit` llegan a 3:1 y no a 4,5:1 como texto chico. Las píldoras de "Más" (rol y plan) llevan texto `t1`.
- **Áreas táctiles:** al menos 48 dp, que es el valor por defecto de Material y no se reduce.

### D9. ADR 0024

**"El celular para el mostrador, la web para la gestión"**:

- **Criterio:** van al celular las tareas que se hacen paradas en el local o fuera de él, que entran en una pantalla chica y duran menos de un minuto.
- **Tabla de funcionalidades:**
  - **En la app:** las que ya están, alertas, falta de stock, stock parado, asistente, órdenes con WhatsApp y edición de un producto.
  - **Sólo web:** importar planillas, proveedores y listas de precios, comparación de proveedores, remarcación en lote, gastos, inflación completa, reportes, usuarios y planes.
- **Implementación de la paleta:** cómo se lleva a Flutter (D1, D5 y D6).
- **Las tres opciones de tema** (D2).
- **Nota en ADR 0022:** cierra su consecuencia "La app Flutter conserva su paleta anterior".

## Risks / Trade-offs

- [Unas 40 referencias a `AppColors` que hay que migrar] → Se borra la clase `AppColors`, y entonces el compilador marca cada uso. `flutter analyze` y los widget tests existentes confirman que no cambia el comportamiento.
- [El test de paridad depende de la ruta relativa a la web] → Se saltea con un mensaje si no encuentra el archivo. En CI el repo está completo y el test corre.
- [En claro, la tarjeta crema sobre el fondo crema tiene poco contraste de superficie] → Se usa el mismo criterio que la web: elevación 1 y borde `line` en las tarjetas del tema claro.
- [Los tests que buscan `MenuSesion` o el *tooltip* "Cuenta" se rompen] → Se actualizan a la pestaña "Más". CP-M.1h cambia en el spec.
- [Para el contador, "Más" es una pestaña para pocas cosas] → Es el lugar de su cuenta y de "Cerrar sesión", que antes estaban en el menú de la barra superior, y lo que se suma en `mobile-stock-insights` puede quedarle visible según el rol.

## Migration Plan

- No hay datos que migrar.
- Quien ya tiene la app instalada abre la versión nueva sin preferencia guardada, así que la app sigue al tema del sistema.
- Para volver atrás, se revierte el commit: la preferencia guardada queda huérfana y no molesta.
