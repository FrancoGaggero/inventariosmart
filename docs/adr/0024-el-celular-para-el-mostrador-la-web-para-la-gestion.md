# ADR 0024 · El celular para el mostrador, la web para la gestión

**Estado:** aceptada · 02/10/2026. Lleva la paleta de ADR 0022 a la app Flutter y fija qué funcionalidades se portan al celular.

## Contexto

La web creció hasta 19 historias de usuario: importación de planillas, proveedores, comparador, remarcación, inflación, reportes, falta de stock, stock parado, asistente y más. La app Android se quedó en las cuatro pantallas del MVP (`mobile-mvp`): login, inicio, inventario y registrar movimiento. Además conservaba la paleta azul de los wireframes v3, con un solo tema oscuro, mientras la web pasó a la paleta ámbar con tema claro y oscuro (ADR 0022).

Franco preguntó si la app debía tener todo lo que tiene la web. Copiar todo duplica cada pantalla con sus modelos, que acá se escriben a mano (ADR 0009), sus tests y su mantenimiento, con la entrega del 18/12/2026 cerca. Además, varias tareas no tienen sentido en una pantalla de 6 pulgadas.

## Decisión

1. **Criterio de alcance.** Van al celular las tareas que se hacen paradas en el local o fuera de él, que entran en una pantalla chica y duran menos de un minuto. Lo que pide comparar tablas, cargar planillas o revisar muchos productos a la vez queda en la web.

   | En la app                                                 | Sólo en la web                              |
   | --------------------------------------------------------- | ------------------------------------------- |
   | Login, onboarding, inicio, inventario y movimientos (MVP) | Importar planillas de productos             |
   | Alertas de reposición (`mobile-stock-insights`)           | Proveedores, listas de precios y comparador |
   | Falta de stock y stock parado (`mobile-stock-insights`)   | Remarcación en lote                         |
   | Asistente con IA (`mobile-assistant`)                     | Gastos operativos                           |
   | Órdenes: ver y enviar por WhatsApp (`mobile-orders`)      | Precios e inflación completo, reportes      |
   | Editar un producto puntual (`mobile-orders`)              | Usuarios, roles y planes                    |

   La pestaña "Más" de la app lista lo que se hace desde la web y muestra su dirección. Así nadie busca en el celular algo que no está.

2. **Paleta como `ThemeExtension`.** `Tokens` tiene los mismos nombres semánticos que la web y dos instancias, `Tokens.oscuro` y `Tokens.claro`, con los valores de `apps/web/src/index.css`. Las pantallas leen el color con `context.tokens` y nunca de una constante. `buildTheme(Brightness)` arma el `ColorScheme` de Material 3 a mano desde los tokens y define el tema de botones, tarjetas, campos, barra inferior, chips y botón flotante.

3. **Una sola fuente de verdad, vigilada por tests.**
   - `test/app/tokens_web_test.dart` lee `index.css` y compara cada color con el de `Tokens`. Si la web cambia un valor y la app no, el CI de Flutter falla.
   - `test/app/contraste_test.dart` exige WCAG AA en los dos temas con los mismos pares que la web, y además mide el borde de los campos y el texto de la barra inferior.

4. **Tema con tres opciones.** El tema sigue al del sistema y desde "Más" se elige Sistema, Claro u Oscuro. La elección se guarda con `shared_preferences`, que se carga antes de `runApp` para que el primer cuadro ya salga con el tema guardado. En esto la app difiere a propósito de la web, que tiene dos opciones: en Android "Sistema" es lo habitual, y sin esa opción quien eligió una vez no podría volver a seguir al sistema. Las barras de estado y de navegación de Android acompañan al tema con un `AnnotatedRegion`.

5. **Navegación con "Más".** La barra inferior suma una pestaña "Más" al final para todos los roles. Tiene:
   - la cuenta: comercio, email, rol y plan;
   - la elección de tema;
   - lo que se hace desde la web;
   - "Cerrar sesión", que deja el menú de la barra superior.

   Las pantallas futuras se agregan como entradas de `seccionesMas(me)`, una función pura que filtra por rol y plan, como `lib/navegacion.ts` en la web.

## Alternativas consideradas

- **Paridad completa con la web:** duplica el trabajo hasta la entrega y deja en el celular pantallas que nadie usaría ahí.
- **`ColorScheme.fromSeed` con el ámbar:** genera tonos propios de Material que no coinciden con la web y cambian entre versiones de Flutter.
- **Generar los colores de Dart desde el CSS con un script:** suma un paso de build en un proyecto que no está en el workspace de Node (ADR 0005), para unos 25 valores. El test de paridad da la misma garantía sin generar código.
- **Cajón con hamburguesa:** esconde los destinos frecuentes. ADR 0022 lo descartó por la misma razón en la web.
- **Tipografías de la web (Plus Jakarta Sans e Instrument Serif):** hay que empaquetar archivos de fuente, y el color pesa más en la identidad. La app sigue con la fuente del sistema.

## Consecuencias

- Toda pantalla nueva de la app nace con los dos temas y con los colores de la web.
- Un cambio de color en `index.css` obliga a copiarlo en `theme.dart`, porque si no el test de paridad falla.
- El contador pasa a tener barra inferior, con Inicio y Más.
- Los widget tests que buscaban el menú "Cuenta" ahora cierran sesión desde "Más".
- El borde de los campos usa `t3` y no `line2`, que no llega a 3:1.
- La app suma la dependencia `shared_preferences`.

## Notas posteriores

- **06/10/2026** (change `mobile-orders`): las órdenes llegan al celular con su listado, el detalle, la edición de cantidades del borrador, la confirmación por canal, "Abrir WhatsApp" y "Ya la envié". Por decisión de Franco, **editar un producto puntual queda en la web**, igual que agregar productos o cambiar el proveedor de un borrador. La app suma `url_launcher`.
