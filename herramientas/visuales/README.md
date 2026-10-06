# Taller de animaciones

Produce las animaciones de la app (ADR 0025): imágenes WebP animadas con transparencia, en tema claro y oscuro, más un PNG fijo para movimiento reducido. La app sólo muestra imágenes; ningún framework de animación llega a su runtime (ADR 0012).

Está fuera del workspace de pnpm (`pnpm-workspace.yaml` incluye `apps/*` y `packages/*`), así que no suma dependencias a CI. Lo generado se commitea en `apps/web/public/animaciones/` y `apps/mobile/assets/animaciones/`.

| Pieza                | Framework                                               | Dónde se usa                                    |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `vacio-<nombre>` (6) | HyperFrames 0.8.137 (HTML + SVG + GSAP), `hyperframes/` | `EstadoVacio` en la web y `Vacio` en el celular |
| `bienvenida`         | Remotion 4.0.533 (React), `remotion/`                   | Onboarding de la web y del celular              |

## Requisitos

- Node 22 o más y FFmpeg con `libwebp_anim` en el PATH (`winget install Gyan.FFmpeg`). Si no está en el PATH, se puede indicar con la variable `FFMPEG`.
- `npm install` en esta carpeta y en `remotion/`.
- Para trabajar con Claude Code: el plugin `hyperframes@hyperframes` y las skills de Remotion (`npx skills add remotion-dev/skills -g`).

## Regenerar

```bash
node exportar.mjs                         # todas las piezas
node exportar.mjs vacio-cajas bienvenida  # sólo esas
node exportar.mjs --revisar               # sólo el lint de HyperFrames, sin renderizar
```

Para cada pieza y tema: render a secuencia PNG con alfa, WebP animado (`libwebp_anim`, calidad 80, compresión 6), PNG fijo del último cuadro y control de peso: 150 KB por estado vacío y 600 KB para la bienvenida. Si una pieza pasa su tope, no se copia nada. Además actualiza `manifiesto.json` en cada destino.

Los renders intermedios quedan en `out/`, ignorado por git. `out/proyectos/<pieza>/` es el proyecto que arma el exportador para cada composición, porque `hyperframes lint`, `check` y `render` piden un `index.html` en la raíz.

## Reglas para editar

- **Colores:** salen de `tokens.json`, que copia `apps/web/src/index.css` (brand-3 para el trazo y brand al 18 % para el relleno). Si cambia la paleta de la web, se cambia acá y se regenera.
- **Dibujos:** las composiciones de los estados vacíos usan los mismos `path` que `apps/web/src/ui/EstadoVacio.tsx`, que sigue siendo el respaldo si la imagen no carga. Si cambia uno, se cambia el otro.
- **Loops:** cada animación termina igual que empieza, para que el WebP haga loop sin salto.
- **HyperFrames:**
  - las rutas son relativas a la raíz del proyecto (`vendor/gsap.min.js`, `comun.css`);
  - en SVG, los giros y escalas usan `svgOrigin` en coordenadas del dibujo, no `transformOrigin` en px.
- **Remotion:** se anima con `useCurrentFrame()` e `interpolate()`. Las animaciones CSS y de Tailwind no se renderizan bien (skill `remotion-markup`). Revisar con `npm run dev` (Studio) y `npx remotion still Bienvenida out.png --frame=90`.
- **Peso:** las pausas quietas abaratan el WebP (libwebp junta los cuadros idénticos). Mover la pieza entera en todos los cuadros lo encarece.

## Licencias

- HyperFrames: Apache-2.0.
- Remotion: Free License (individuos y equipos de hasta 3 personas, también con uso comercial). No se usa su Player.
- GSAP: licencia estándar sin costo; sólo se usa al renderizar.
