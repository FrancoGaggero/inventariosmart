## Context

- **Herramientas de la máquina** (instaladas y probadas el 06/10/2026):
  - el plugin `hyperframes@hyperframes` 0.8.137 de Claude Code, con las skills `hyperframes`, `hyperframes-core`, `hyperframes-animation`, `hyperframes-cli`, `motion-graphics` y otras;
  - las 12 skills de Remotion en `~/.claude/skills`, entre ellas `remotion-markup` y `remotion-render`;
  - FFmpeg 9.0.2 con `libwebp_anim`, instalado con winget, y Node 22.19.
- **`npx hyperframes doctor`** pasa todo lo obligatorio (FFmpeg, Chrome headless, disco); lo que falla es opcional (whisper, TTS, Docker). En Windows captura por screenshot, no por BeginFrame: 90 cuadros de 240×176 tardan unos 17 s.
- **La web:**
  - `apps/web/src/ui/EstadoVacio.tsx` dibuja 6 SVG de 120×88 con `var(--color-brand-3)` y `color-mix(brand 18%)`. Los usan unas 20 páginas: `cajas` ×5, `camion` ×3, `flechas` ×3, `recibo` ×3, `carrito` ×2 y `campana` ×1.
  - **`useTema` no sirve para leer el tema:** guarda su propio estado y **aplica** el tema en un efecto. Usarlo en `EstadoVacio` podría pisar el tema elegido.
  - El onboarding web es `features/auth/OnboardingPage.tsx`, con un recuadro de ícono antes del título.
- **El celular:**
  - `Vacio` (`lib/ui/analisis_ui.dart`) muestra un ícono de 40 px. Lo usan alertas, falta de stock, stock parado y conversaciones.
  - `onboarding_screen.dart` muestra `Logo(icono: storefront)`.
  - Los colores están en `Tokens` (`lib/app/theme.dart`), que un test compara con `index.css`.
- **Lint y formato:** `eslint.config.*` y `.prettierignore` no excluyen una carpeta nueva en la raíz, así que el taller cae en `pnpm lint` y en `pnpm format:check`.

## Goals / Non-Goals

**Goals:**
- Que Claude produzca y regenere las animaciones con las skills de cada framework, con un solo comando reproducible.
- Cero bytes de runtime de animación en la app con sesión (ADR 0012): sólo imágenes.
- Las mismas ilustraciones y colores de hoy, con movimiento. El SVG actual queda como respaldo.

**Non-Goals:**
- Ni Lottie ni video en la app.
- No se reemplaza el SVG como fuente de la web: el SVG sigue siendo el respaldo y el dibujo de referencia.

## Decisions

### D1. Formato: WebP animado con transparencia, por tema, más un PNG fijo

- **Por qué WebP animado:**
  - tiene canal alfa;
  - lo reproducen Chrome, Firefox, Edge, Safari 14+ y Flutter (`Image.asset` decodifica WebP animado sin paquetes);
  - libwebp junta los cuadros idénticos: el loop de prueba de 90 cuadros quedó en 43 y en 85 KB.
- **Archivos:** dos variantes, `<pieza>-claro.webp` y `<pieza>-oscuro.webp`. El trazo cambia según el fondo: en claro es `#8a5a12` (brand-3 claro) y en oscuro `#f0c07a`. Un único archivo transparente no se lee en los dos fondos, como mostró la prueba de humo.
- **PNG fijo:** `<pieza>-<tema>.png`, con el cuadro final del loop, para movimiento reducido.
- **Alternativas descartadas:**
  - un `<video>` WebM con alfa, porque Safari no lo reproduce y en Flutter necesita `video_player`;
  - GIF, porque tiene alfa de 1 bit y bordes serruchados;
  - APNG, que pesa más y Flutter no lo anima.

### D2. Rol de cada framework

- **HyperFrames, para los estados vacíos.** Ya son SVG: el HTML los toma tal cual y GSAP los anima.
  - El agente sigue el ciclo de la skill: `lint` → `check` → `snapshot` → `render --format png-sequence`.
  - Cada pieza es `herramientas/visuales/hyperframes/vacio-<nombre>.html`. **Ajuste de la implementación:** HyperFrames no acepta rutas con `../` y `lint`, `check` y `render` piden un `index.html` en la raíz del proyecto, así que el exportador arma un proyecto por pieza en `out/proyectos/<pieza>/`, con su `index.html`, `comun.css` y `vendor/gsap.min.js`:
    - canvas de 240×176, es decir 2× los 120×88 de la web, con un margen interno de 12 px para que nada se corte (hallazgo de la prueba de humo);
    - `data-duration="3"` y un timeline que termina igual que empieza, para que el loop no salte;
    - GSAP en una copia local (`vendor/gsap.min.js`), sin CDN, para que el render no dependa de la red.
    - **Ajuste de la implementación:** el tema se elige con dos variables de color, `trazo` y `suave`, que HyperFrames aplica como `--trazo` y `--suave` y `comun.css` usa en las clases `.t` y `.s`. El exportador las pasa con `--variables-file`, desde `tokens.json`. Los giros y escalas usan `svgOrigin` en coordenadas del dibujo: con `transformOrigin` en px, las ruedas giraban alrededor de un punto lejano.
- **Remotion, para la bienvenida del onboarding.** Es una escena compuesta, con tarjetas, barras y una alerta, que se escribe mejor en React con `useCurrentFrame()`, `interpolate()` y `spring()`, como pide `remotion-markup`.
  - Vive en `herramientas/visuales/remotion/`, creado con `create-video --blank`: Remotion 4.0.533 y React 19.
  - La composición `Bienvenida` tiene 360×240, 30 fps y 6 s, y recibe `inputProps={ tema }`.
  - **No importa componentes de `apps/web`:** usan Tailwind y animaciones CSS, que Remotion no renderiza bien. Replica las formas de `GraficaBarras` y del logo con estilos en línea, y recibe los colores en `inputProps.colores`, que el exportador toma de `tokens.json`. Ese archivo es la única fuente de colores del taller.
- **Alternativa descartada:** hacer todo con un solo framework. Franco eligió los dos con roles separados. HyperFrames encaja con los SVG existentes y Remotion con una escena React compuesta.

### D3. El exportador

`herramientas/visuales/exportar.mjs` (Node 22, sin dependencias) hace, para cada pieza y tema:

1. **Renderiza:**
   - con `npx hyperframes render <dir> --format png-sequence --fps 30 --variables …`;
   - o con `npx remotion render Bienvenida <dir> --sequence --image-format=png --props '{"tema":…}'`.
   - Lo corre con `HYPERFRAMES_NO_TELEMETRY=1` y `REMOTION_DISABLE_TELEMETRY=1`.
2. **Convierte a WebP:** `ffmpeg -framerate 30 -i %06d.png -c:v libwebp_anim -quality 80 -loop 0 -pix_fmt yuva420p`.
3. **Saca el PNG fijo:** el último cuadro de la secuencia.
4. **Controla el peso:** si un WebP pasa su tope, termina con error y no copia nada.
5. **Copia** a `apps/web/public/animaciones/` y a `apps/mobile/assets/animaciones/`, y escribe un `manifiesto.json` con el nombre, el tema, los bytes y la fecha.

Se puede elegir qué regenerar: `node exportar.mjs vacio-cajas bienvenida`. Sin argumentos, regenera todo.

### D4. La web

- **`lib/tema-actual.ts`, nuevo:** `useTemaActual()`, hecho con `useSyncExternalStore`.
  - Lee `document.documentElement.getAttribute('data-theme')` (`light` es claro y la ausencia es oscuro) y se suscribe con un `MutationObserver` sobre ese atributo.
  - No aplica nada: lo sigue haciendo `useTema`.
- **`EstadoVacio`:**
  - con `animada` en `true`, que es el valor por defecto, dibuja:
    ```
    <picture>
      <source srcSet="/animaciones/vacio-<n>-<tema>.png" media="(prefers-reduced-motion: reduce)">
      <img src="/animaciones/vacio-<n>-<tema>.webp" width=120 height=88 alt="" loading="lazy" decoding="async" onError={usarSvg}>
    </picture>
    ```
  - con `onError` vuelve al `<Dibujo>` de hoy, que queda como respaldo;
  - el `alt` vacío y `aria-hidden` se mantienen: es decorativo, y el título ya dice lo que importa.
- **`OnboardingPage`:**
  - reemplaza el recuadro con ícono por la bienvenida de 180×120, con el mismo `<picture>`;
  - el texto, los campos y el flujo no cambian.
- **Tests:**
  - `EstadoVacio.test.tsx`: la ruta según el tema, la fuente de movimiento reducido y el respaldo con `onError`;
  - `tema-actual.test.ts`: el cambio de `data-theme` actualiza el valor.

### D5. El celular

- **`Vacio`:** suma el campo `ilustracion` (un `String?`, uno de los seis nombres).
  - Elige `assets/animaciones/vacio-$ilustracion-${claro|oscuro}.webp` según `context.tokens.brightness`.
  - Con `MediaQuery.of(context).disableAnimations`, usa el `.png`.
  - Tamaño de 120×88, con `errorBuilder`, que vuelve al ícono. Sin `ilustracion`, sigue el ícono de hoy.
- **Qué ilustración usa cada pantalla:**

  | Pantalla | Ilustración |
  |---|---|
  | Alertas | `campana` |
  | Falta de stock | `cajas` |
  | Stock parado | `recibo` |
  | Conversaciones | `flechas` |

- **El onboarding:** reemplaza el `Logo` del encabezado por la bienvenida de 180×120, con la misma regla de tema y de movimiento reducido.
- **`pubspec.yaml`:** suma `flutter: assets: - assets/animaciones/`.
- **Tests:** `analisis_ui_test.dart`, nuevo, verifica la ruta según el tema, el PNG con `disableAnimations` y el respaldo al ícono. Los tests de las pantallas buscan la imagen en su estado vacío.

### D6. Lint, formato y CI

- **Lo que se ignora:**
  - `eslint.config.*`: `herramientas/**/node_modules/**`, `herramientas/visuales/**/vendor/**` y `herramientas/visuales/**/out/**`;
  - `.prettierignore`: `herramientas/visuales/**/vendor`, `out` y `renders`.
- **Lo que se revisa:** el código del taller sí pasa por formato. `exportar.mjs` lleva `/* global console, process */`, como `scripts/verificar-chunks.mjs`.
- **CI:** no renderiza, porque sólo usa los archivos commiteados. El taller no tiene tests de CI: su verificación es el ciclo de las skills y el control de peso.

### D7. ADR 0025

Registra el rol de cada framework y por qué no van al runtime, que es coherente con ADR 0012 y ADR 0023. También documenta:
- el formato, los topes de peso y el respaldo al SVG o al ícono;
- **las licencias:**
  - HyperFrames es Apache-2.0;
  - Remotion está bajo su Free License, para un individuo y equipos de hasta 3 personas; no se usa su Player;
  - GSAP tiene licencia estándar sin costo y sólo se usa al renderizar;
- **cómo se instalaron las herramientas:** el plugin de HyperFrames y las skills de Remotion con `npx skills add`, porque su plugin clona por SSH.

## Risks / Trade-offs

- [HyperFrames está en 0.x y saca releases diarias] → El README fija la versión probada (`hyperframes@0.8.137`) en los comandos del exportador. Lo generado queda commiteado, así que una versión nueva no rompe la app.
- [Issues de Windows: Smart App Control bloquea `sharp` en `snapshot` y FFmpeg da EBUSY] → El exportador reintenta una vez cada render. Si `snapshot` falla, la revisión de cuadros se hace sobre la secuencia PNG con el script de tiras de la prueba de humo.
- [Peso del APK] → Hay topes de peso, y las 14 imágenes suman 3 MB como máximo.
- [Un WebP animado gasta CPU en celulares viejos] → Son loops de 3 s a 240×176 y se respetan `disableAnimations` y `prefers-reduced-motion`.
- [Dos fuentes del dibujo: el SVG de la web y la composición] → La composición copia los mismos `path`, y el README dice que si cambia uno se regenera el otro.

## Migration Plan

Sin migraciones. La API no cambia. Si las imágenes no cargan, la web vuelve al SVG y el celular al ícono, que son los de hoy.
