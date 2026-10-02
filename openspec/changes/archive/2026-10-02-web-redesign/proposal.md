## Why

Franco quiere una identidad visual más cálida y profesional para la web, y una navegación que escale. Mandó dos capturas de referencia con estas características:
- fondos crema en tema claro y marrón casi negro en oscuro, con acento ámbar dorado;
- una tarjeta destacada invertida y un nombre en serif cursiva en el saludo;
- la navegación en una **barra lateral** agrupada por secciones, con la tarjeta del plan y el usuario al pie.

Hoy la barra superior tiene hasta 15 enlaces que no entran en una fila. Un `ResizeObserver` tiene que esconder las etiquetas y dejar sólo íconos, y "Falta de stock" y "Stock parado" ni siquiera están en el menú. Franco también pidió sumar criterios de Material Design y de UX.

Es un rediseño visual y de navegación de `apps/web` (RNF-01 usabilidad, RNF-08 mensajes claros). No cambia la API, el contrato OpenAPI, las reglas de negocio ni los criterios de las HU, por eso se declara `skip_specs: true`, como `web-visual-polish`. Corresponde a la **Fase 2**, porque mejora a la vez todas las pantallas de la demo.

## What Changes

- **Paleta nueva con los mismos tokens.** Los nombres semánticos de ADR 0012 se mantienen y sólo cambian sus valores en los dos temas, así las unas 900 clases que los usan se repintan solas.
  - Claro: crema y tinta. Oscuro: marrón casi negro y crema. Acento ámbar dorado con texto oscuro encima.
  - `warn` pasa a terracota para no confundirse con el ámbar. `violet` pasa a ciruela y queda sólo como cuarta serie de los gráficos.
  - Se suman tokens para la tarjeta invertida, la tipografía serif de acento (Instrument Serif itálica), la escala de radios y las elevaciones.
  - Desaparecen el azul, el violeta y los degradados de fondo.
- **Componentes con criterios de Material:**
  - botón principal ámbar lleno y botón tonal nuevo;
  - capas de estado (8 % al pasar el mouse, 12 % con foco o al apretar);
  - tarjetas sólidas con elevación y sin el borde degradé, que además causaba barras de scroll fantasma;
  - tarjeta invertida y píldoras de estado;
  - foco visible ámbar en todo elemento interactivo y áreas táctiles de 44 a 48 px en móvil.
- **Navegación nueva:**
  - **Escritorio:** barra lateral fija con los grupos General, Análisis, Compras, Asistente y Cuenta. Se colapsa a un riel de íconos y guarda la preferencia. Al pie tiene la tarjeta del plan ("Mejorar plan", oculta en PREMIUM), el usuario, el cambio de tema y "Cerrar sesión".
  - **Tablet:** el riel colapsado por defecto.
  - **Móvil:** barra inferior con cuatro accesos según el rol y "Más", que abre el menú completo como panel modal con el foco atrapado.
  - **Barra superior del contenido:** la fecha, la campana de alertas y "Registrar movimiento".
  - "Falta de stock" y "Stock parado" entran al menú.
  - La visibilidad por rol y plan sale de un módulo puro con tests.
- **Accesibilidad de la navegación:** enlace "Ir al contenido", `aria-current`, el conteo de alertas en el nombre accesible y atrapado de foco en el panel.
- **Inicio:**
  - saludo según la hora de Buenos Aires con el nombre del comercio en serif cursiva, y píldoras de estado;
  - el primer KPI pasa a tarjeta invertida;
  - se quitan los datos repetidos con la barra lateral.
- **Portada, login, registro y onboarding:** la paleta nueva, el panel ilustrativo en tarjeta invertida, el logo en ámbar y sin blancos fijos. Favicon nuevo y `theme-color` por tema.
- **Gráficos:** series en ámbar, terracota, ciruela y gris; sin colores fijos en los SVG.
- **Calidad:** un test de contraste lee los tokens de `index.css` y exige WCAG AA en los dos temas.

### Fuera de alcance

- La app Flutter.
- Un componente de encabezado de página compartido: las páginas mantienen su patrón actual.
- Cambios de contenido o de flujo dentro de las pantallas, salvo Inicio.
- Componentes nuevos de Material que hoy no existen en la app, como *snackbar*, botón flotante o pestañas.

## Capabilities

### New Capabilities

Ninguna. Es un rediseño visual y de navegación sin comportamiento nuevo del producto (`skip_specs: true`).

### Modified Capabilities

Ninguna.

## Impact

- **Web:**
  - `apps/web/src/index.css`: tokens, componentes y estados.
  - `apps/web/index.html` y `public/favicon.svg`.
  - `app/AppShell.tsx`, reescrito con barra lateral, barra superior, barra inferior y panel.
  - Módulos puros nuevos: `lib/navegacion.ts` y `lib/inicio-formato.ts`.
  - Pantallas: Inicio y panel, portada, login, registro y onboarding.
  - `ui/GraficaBarras`, `ui/IconoCanal` y `ui/Campo`, y las series de la inflación.
- **Docs:** ADR 0022, que reemplaza los valores y la navegación de ADR 0012 y mantiene su mecanismo de tokens; `docs/arquitectura.html`; `openspec/CAPACIDADES.md`.
- **Sin cambios:** API, base de datos, contrato OpenAPI, clientes TS y Dart, y la app móvil.
