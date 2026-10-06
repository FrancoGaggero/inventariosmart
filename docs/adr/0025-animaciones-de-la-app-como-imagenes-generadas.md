# ADR 0025 · Animaciones de la app como imágenes generadas

**Estado:** aceptada · 06/10/2026. Completa ADR 0012 (sin librerías de animación en la app con sesión) y ADR 0023 (Motion sólo en las pantallas públicas).

## Contexto

Franco quiso elementos visuales de mejor calidad producidos con Claude Code y frameworks de video, empezando por animaciones dentro de la app: estados vacíos y onboarding, en la web y en el celular. Se evaluaron dos frameworks, leyendo su documentación el 06/10/2026, y se usan los dos, con roles separados:

- **HyperFrames** (HeyGen, Apache-2.0, v0.8.137): composiciones HTML con un timeline GSAP, renderizadas cuadro a cuadro con Chrome headless y FFmpeg. Trae el plugin de Claude Code `hyperframes@hyperframes`, un catálogo de bloques y el ciclo `lint` → `check` → `snapshot` → `render`.
- **Remotion** (v4.0.533): videos escritos como componentes React, animados con `useCurrentFrame()` e `interpolate()`. Sus 12 skills de Claude Code se instalan con `npx skills add remotion-dev/skills`. El plugin de Claude Code no se pudo instalar porque clona por SSH, y su MCP está obsoleto.

Meter cualquiera de los dos en la app (el Player de Remotion o el de HyperFrames) violaría ADR 0012 y sumaría peso a todas las pantallas.

## Decisión

1. **Los frameworks producen imágenes; la app sólo las muestra.**
   - El taller vive en `herramientas/visuales/`, fuera del workspace de pnpm, así que no suma dependencias a CI.
   - `exportar.mjs`:
     - renderiza cada pieza en tema claro y oscuro como secuencia PNG con alfa;
     - la convierte a **WebP animado con transparencia** (`libwebp_anim`, calidad 80, compresión 6);
     - saca un **PNG fijo** del último cuadro;
     - controla el peso y copia a `apps/web/public/animaciones/` y `apps/mobile/assets/animaciones/`.
   - Lo generado se commitea.
2. **Roles:**
   - **HyperFrames anima los 6 estados vacíos** (`cajas`, `campana`, `carrito`, `camion`, `recibo` y `flechas`). Usan los mismos trazos SVG de `apps/web/src/ui/EstadoVacio.tsx`, en loops de 3 s que terminan igual que empiezan.
   - **Remotion hace la bienvenida del onboarding**, una escena React de 6 s: el stock baja, aparece la alerta, sale la orden por WhatsApp y el stock se repone.
   - Los colores salen de `tokens.json`, copia de `apps/web/src/index.css`.
3. **Formato y topes:**
   - **WebP animado**, porque tiene alfa y lo reproducen los navegadores modernos y Flutter (`Image.asset`) sin paquetes.
   - **Dos variantes por tema**, porque el trazo ámbar de un tema no se lee sobre el fondo del otro.
   - **Topes:** 150 KB por estado vacío y 600 KB para la bienvenida. Si una pieza los pasa, el exportador no copia nada.
   - **Pesos al cerrar la change:**
     - estados vacíos, entre 29 y 121 KB;
     - bienvenida, 124 y 134 KB.
     - En total, unos 2,7 MB entre WebP y PNG.
4. **Respaldo y accesibilidad:**
   - **En la web**, `ui/ImagenAnimada.tsx` usa `<picture>`: con `prefers-reduced-motion` muestra el PNG fijo, y si la imagen no carga, el SVG de siempre. El tema se lee con `lib/tema-actual.ts` (`useSyncExternalStore` sobre `data-theme`), que no lo modifica.
   - **En el celular**, `ui/imagen_animada.dart` elige el archivo según `context.tokens.brightness`, usa el PNG con `MediaQuery.disableAnimations` y vuelve al ícono si falla.
   - Las imágenes son decorativas: el texto de la pantalla dice lo que importa.

## Alternativas consideradas

- **Player de Remotion o de HyperFrames en la app:** suma un runtime de animación a la app con sesión, en contra de ADR 0012.
- **Video WebM con alfa:** Safari no lo reproduce, y Flutter necesita `video_player`.
- **GIF:** alfa de 1 bit y bordes serruchados.
- **Lottie:** ninguno de los dos frameworks lo exporta.
- **Un solo framework:** Franco eligió los dos. HyperFrames encaja con los SVG que ya existían; Remotion, con una escena compuesta en React.

## Consecuencias

- **Fuentes del dibujo:** el dibujo de cada estado vacío vive en dos lugares, el SVG de la web y la composición. Si cambia uno, se cambia el otro y se regenera, como dice el README del taller.
- **Paleta:** un cambio de paleta en `index.css` obliga a actualizar `tokens.json` y regenerar.
- **Versiones:** HyperFrames está en 0.x, con releases diarias. El taller fija la versión probada, y lo commiteado no depende de ella.
- **Windows:**
  - HyperFrames captura por screenshot, no por BeginFrame, y tarda unos 17 s por pieza y tema;
  - las issues abiertas de `sharp` y del EBUSY de FFmpeg se mitigan con un reintento por render.
- **Licencias:**
  - HyperFrames: Apache-2.0;
  - Remotion: Free License, para individuos y equipos de hasta 3 personas, también con uso comercial; no se usa su Player;
  - GSAP: licencia estándar sin costo, y sólo se usa al renderizar.
- **Lo aprendido al implementar** (registrado en el README del taller):
  - en SVG, los giros usan `svgOrigin` y no `transformOrigin` en px;
  - las pausas quietas abaratan el WebP;
  - `prefers-reduced-motion` y `disableAnimations` se respetan con el PNG fijo.
