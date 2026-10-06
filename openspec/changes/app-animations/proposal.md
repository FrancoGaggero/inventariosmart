## Why

Los estados vacíos de la web usan 6 ilustraciones SVG quietas (`apps/web/src/ui/EstadoVacio.tsx`), y los del celular muestran sólo un ícono (`Vacio`, en `apps/mobile/lib/ui/analisis_ui.dart`). El onboarding de las dos apps no tiene ninguna imagen. Franco quiere elementos visuales de mejor calidad, producidos con Claude Code y frameworks de video:
- **HyperFrames** (HeyGen, Apache-2.0): HTML y SVG con GSAP;
- **Remotion** (React, Free License para un desarrollador individual).

Los dos ya están instalados y probados en la máquina, con sus plugins o skills de Claude Code y FFmpeg 9.0.2:
- **HyperFrames:** renderizó una secuencia PNG con transparencia en 17 s, y el WebP animado de prueba pesa 85 KB;
- **Remotion:** renderizó cuadros RGBA.

El límite lo ponen ADR 0012, que deja la app con sesión sin librerías de animación, y ADR 0023, que limita Motion a las pantallas públicas. Por eso los frameworks **no entran en el runtime**: sólo producen imágenes animadas que la app muestra como cualquier imagen.

Es presentación de la web y la app (RNF-01 usabilidad, RNF-08), sin cambios en reglas, permisos ni API. Por eso va con `skip_specs: true`, como `web-redesign`. Es de la **Fase 2**.

## What Changes

- **Taller de visuales en `herramientas/visuales/`**, fuera del workspace pnpm (que incluye sólo `apps/*` y `packages/*`), así que no suma dependencias a CI:
  - **`hyperframes/`:** una composición por ilustración de estado vacío (`cajas`, `campana`, `carrito`, `camion`, `recibo` y `flechas`). Usan los mismos trazos SVG de la web, animados en un loop de 3 s, con margen para el movimiento y una variable de tema.
  - **`remotion/`:** la animación de bienvenida del onboarding, de unos 6 s y en tres escenas: el stock baja, aparece la alerta y sale la orden. Se arma con piezas React y con los colores de la web.
  - **`exportar.mjs`:**
    - renderiza cada pieza en tema claro y oscuro como PNG con transparencia;
    - la convierte a **WebP animado** y saca un **PNG fijo** para movimiento reducido;
    - controla los topes de peso: 150 KB por estado vacío y 600 KB para el onboarding;
    - copia los archivos a la web y al celular.
  - Los archivos generados se commitean; el taller sólo se usa para regenerarlos.
- **Web:**
  - **`EstadoVacio`:** muestra la animación del tema actual. Con `prefers-reduced-motion`, muestra el PNG fijo. Si la imagen no carga, vuelve al SVG de hoy.
  - **El onboarding:** suma la animación de bienvenida.
  - **El hook `useTemaActual`, nuevo:** lee el tema aplicado al documento sin cambiarlo.
- **Celular:**
  - **`Vacio`:** acepta una ilustración opcional y muestra su animación según el tema. Con `MediaQuery.disableAnimations`, muestra el PNG.
  - **Las pantallas:** alertas, falta de stock, stock parado y conversaciones la usan.
  - **El onboarding:** suma la animación de bienvenida.
  - **`pubspec.yaml`:** declara `assets/animaciones/`.
- **ADR 0025 "Animaciones de la app como imágenes generadas"**, el README del taller, `docs/arquitectura.html` y `openspec/CAPACIDADES.md`.

### Fuera de alcance

- **Animaciones en la portada, el login o el registro:** ya tienen Motion, por ADR 0023.
- **Videos de marketing o de la defensa:** el mismo taller sirve para hacerlos después.
- **El Player de Remotion o el de HyperFrames dentro de la app:** sumarían un runtime de animación a la app con sesión.
- **Animaciones con datos reales del comercio:** las imágenes son fijas y genéricas.
- **Cambios en la API, las reglas y los permisos.**

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna: es presentación, por eso `skip_specs: true`. Los textos y el comportamiento de los estados vacíos y del onboarding no cambian; sólo se suma la imagen animada.

## Impact

- **Taller, nuevo:** `herramientas/visuales/`, con `hyperframes/`, `remotion/` (con su propio `package.json`, `package-lock.json` y `remotion.config.ts`), `exportar.mjs` y su README.
  - Se suma a los `ignores` de `eslint.config.*` y a `.prettierignore` sólo lo generado: los `node_modules`, `renders/` y `out/`.
- **Web:**
  - **Nuevos:** `apps/web/public/animaciones/*.webp` y `*.png`, y `lib/tema-actual.ts`.
  - **Modificados:** `ui/EstadoVacio.tsx` y `features/auth/OnboardingPage.tsx`, con sus tests.
- **Celular:**
  - **Nuevos:** `apps/mobile/assets/animaciones/*`.
  - **Modificados:** `pubspec.yaml`, `lib/ui/analisis_ui.dart` (`Vacio`), `features/auth/onboarding_screen.dart` y las 4 pantallas con `Vacio`, con sus tests.
- **Peso:** unos 6 × 2 × ≤150 KB para los estados vacíos, más dos variantes del onboarding de ≤600 KB. Se cargan sólo cuando se muestran:
  - **en la web,** de `public/` y con `loading="lazy"`;
  - **en el celular,** el APK crece unos 3 MB como máximo.
- **Herramientas de la máquina** (ya instaladas): el plugin `hyperframes@hyperframes`, las skills de Remotion en `~/.claude/skills` y FFmpeg 9.0.2.
  - El plugin de Remotion no se pudo instalar porque clona por SSH. Sus mismas skills se instalaron con `npx skills add`.
