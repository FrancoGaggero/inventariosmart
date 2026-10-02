## Why

La web cambió a la paleta ámbar cálida con tema claro y oscuro (ADR 0022), pero la app Android sigue con la paleta azul de los wireframes v3. Sólo tiene tema oscuro y un degradé azul y violeta en el login. Parecen dos productos distintos, y ADR 0022 dejó anotada la app como evolución pendiente.

Además, las próximas changes del celular (`mobile-stock-insights`, `mobile-assistant` y `mobile-orders`) suman pantallas que no entran en una barra inferior de tres pestañas. Hace falta un lugar donde alojarlas. Antes de construirlas conviene fijar dos cosas:
- los colores sobre los que se van a dibujar;
- qué se lleva al celular y qué queda sólo en la web.

Es presentación y navegación de `apps/mobile` (RNF-01 usabilidad, RNF-08 mensajes claros), sin funcionalidades de negocio nuevas. Corresponde a la **Fase 2**, como `web-redesign`. Cambia lo que se ve: el tema sigue al sistema, aparece la pestaña "Más" y "Cerrar sesión" cambia de lugar. Por eso modifica el spec `mobile-app` y no usa `skip_specs`.

## What Changes

- **Paleta ámbar con los valores de la web.**
  - Los mismos colores de `apps/web/src/index.css` en los dos temas: crema y tinta en claro, marrón casi negro y crema en oscuro, y el ámbar de marca con texto oscuro encima.
  - Los estados también son los de la web: `ok` verde, `warn` terracota y `crit` rojo.
  - Desaparecen el azul, los `navy` y el degradé azul y violeta del login.
- **Tema claro y oscuro.** Por defecto sigue al del sistema. Desde "Más" se puede elegir Sistema, Claro u Oscuro, y la elección se recuerda entre aperturas. La barra de estado y la de navegación de Android acompañan al tema.
- **Contraste como test**, como en la web: los pares de texto y fondo de los dos temas tienen que cumplir WCAG AA. Si no, falla `flutter test`.
- **Criterios de Material 3** con los componentes de Flutter:
  - botón principal ámbar lleno con texto oscuro, más botones tonal y con borde;
  - tarjetas con radio de 20 px;
  - barra inferior con indicador tonal;
  - campos con foco ámbar;
  - estado de stock con su color y su etiqueta escrita.
- **Pestaña "Más"** al final de la barra inferior, para todos los roles:
  - **Contenido:** la cuenta (comercio, email, rol y plan), la elección de tema y "Cerrar sesión". También aclara qué se hace desde la web: importar planillas, proveedores y listas de precios, gastos, remarcación, usuarios y planes.
  - **Menú de la barra superior:** se quita. "Cerrar sesión" pasa a "Más".
  - **CONTADOR:** ahora tiene barra inferior con Inicio y Más.
  - **Pantallas futuras:** "Más" queda armada como lista por secciones, calculada desde los datos según rol y plan, para que las próximas changes sumen sus pantallas sin tocar la navegación.
- **Logo en ámbar** en el login y el onboarding, en lugar del ícono blanco sobre degradé.
- **ADR 0024 "El celular para el mostrador, la web para la gestión":**
  - qué funcionalidades se llevan a la app y cuáles quedan sólo en la web, con su criterio;
  - cómo se implementa la paleta en Flutter.
  - ADR 0022 suma una nota que cierra su consecuencia pendiente.

### Fuera de alcance

- Pantallas nuevas de negocio: alertas, falta de stock, stock parado, asistente, órdenes y edición de productos. Llegan en `mobile-stock-insights`, `mobile-assistant` y `mobile-orders`.
- Tipografías propias (Plus Jakarta Sans e Instrument Serif). La app sigue con la fuente del sistema: incluirlas obliga a empaquetar archivos de fuente y no cambia la identidad tanto como el color.
- Abrir la web desde la app con un enlace: necesita un paquete nuevo y se evalúa con `mobile-orders`, que lo va a necesitar para WhatsApp.
- Animaciones y la serif de acento del saludo de la web.
- iOS y tablets: la app sigue siendo Android y de teléfono.
- Cambios en la API, el contrato OpenAPI y la web.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `mobile-app`:
  - **Requisito nuevo "Apariencia de la app":** paleta ámbar, tema según el sistema o elegido, y contraste AA.
  - **Requisito nuevo "Pestaña Más":** cuenta, tema, cierre de sesión y las funcionalidades que quedan en la web, para todos los roles.
  - **Se modifica "Acceso desde el celular con la misma identidad que la web":** "Cerrar sesión" pasa a la pestaña "Más" (CP-M.1h).

## Impact

- **Mobile (`apps/mobile`):**
  - **Tema:** `lib/app/theme.dart` se reescribe con tokens claros y oscuros, y en `lib/app/tema_provider.dart`, nuevo, va la preferencia de tema.
  - **Navegación:** `lib/app/shell.dart` suma la pestaña "Más" y pierde `MenuSesion`; `lib/app/router.dart` suma la rama `/mas`, y `lib/features/mas/` es nuevo.
  - **Pantallas existentes:** pasan de `AppColors` a los tokens del tema, sin cambios de comportamiento. Son el login, el onboarding, el inicio, el inventario, el movimiento, `ui/aviso.dart` y `ui/estado_carga.dart`.
  - **Dependencia nueva:** `shared_preferences` (paquete oficial de flutter.dev), para recordar el tema.
- **Tests:**
  - `test/features/shell_test.dart`: pestañas por rol con "Más".
  - `test/features/login_test.dart`: CP-M.1h desde "Más".
  - `test/app/contraste_test.dart`, nuevo.
  - Tests nuevos de la preferencia de tema y de la pantalla "Más".
- **Docs:** ADR 0024, una nota en ADR 0022, `apps/mobile/README.md` (estructura actualizada), `docs/arquitectura.html` y `openspec/CAPACIDADES.md`.
- Sin cambios en la API, la base, el contrato OpenAPI ni la web.
