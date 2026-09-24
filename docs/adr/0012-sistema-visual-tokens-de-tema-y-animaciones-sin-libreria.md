# ADR 0012 · Sistema visual de la web: tokens de tema, modo claro por atributo y animaciones en CSS

**Estado:** aceptada · 26/09/2026

## Contexto

La web (React + Vite + Tailwind v4) tenía una barra de navegación de nueve enlaces en una fila fija que provocaba scroll horizontal por debajo de unos 1.160 px lógicos, colores fijos (`border-white/8`, `bg-[#070C16]`) repartidos por las pantallas, y ninguna transición ni estado de carga o vacío con carácter. Franco pidió corregir los solapamientos y una interfaz más viva para la demo. No hay tests en la web y CI corre sin navegador.

## Decisión

1. **Navegación en dos modos**: enlaces con icono y etiqueta a partir de `lg` (1024 px) y, por debajo, un botón de menú que abre un panel lateral (`role="dialog"`, cierre por navegación, Escape y velo, foco gestionado) con todos los enlaces, comercio, rol, plan, tema y cierre de sesión. `html, body { overflow-x: clip }` como red de seguridad; el contenedor pasa a `max-w-6xl`.
2. **Tokens semánticos y tema claro por atributo**: además de los tokens de marca, `index.css` define `--color-line`, `--color-fill`, `--color-field`, `--color-card`, `--color-on-brand`, `--color-glow` y sombras. Como Tailwind v4 emite `var(--color-x)` en cada utilidad, `:root[data-theme='light']` redefine las variables y todas las clases (`bg-fill`, `border-line`, `text-t2`) cambian solas. Las páginas dejan de usar colores fijos. `lib/tema.ts` lee la preferencia guardada o la del sistema, la aplica antes del primer render (sin destello) y la persiste en `localStorage`.
3. **Movimiento y decoración en CSS puro**: fondo con dos gradientes radiales y grano (SVG `feTurbulence` en data URI), tarjetas con degradado, sombra y borde degradado al hover, botón primario con degradado y brillo, `@keyframes entrar` escalonado por `--i`, `pulso` para el badge crítico y `brillo` para skeletons; todo anulado con `prefers-reduced-motion`. Sin Framer Motion ni librerías de gráficos: anillos y barras son SVG y CSS propios; el contador animado es un hook con `requestAnimationFrame`.
4. **Componentes `ui/` reutilizables**: `Skeleton`, `EstadoVacio` (seis ilustraciones SVG inline), `Anillo`, `Barra`, `Entrada`, `useContador`. Los listados de Inventario, Alertas y Órdenes muestran tarjetas apiladas por debajo de `sm` y tabla con cabecera pegajosa por encima.
5. **Tests de la web con Vitest + jsdom** para las piezas puras (`tema`, `useContador`); `pnpm test` en la raíz ya los incluye. La verificación de desborde y de tema se hace en el navegador integrado con capturas a 360, 768, 1024 y 1280 px, no con Playwright (necesitaría sesión autenticada y navegador en CI).

## Alternativas consideradas

- **Barra con scroll horizontal propio o iconos sin etiqueta**: esconde secciones y en una notebook con escala 125 % tampoco entran nueve iconos con contador.
- **Clases `dark:` / `light:` en cada elemento**: duplica el markup y se olvida; el atributo en `<html>` cambia todo desde los tokens.
- **Framer Motion / Recharts**: 40 KB y dependencias para cuatro efectos y dos micro-gráficas.
- **Playwright en CI**: navegador y sesión de Firebase en el runner por una comprobación de layout; la checklist con capturas alcanza para el alcance.

## Consecuencias

- Toda pantalla nueva debe usar los tokens (`border-line`, `bg-fill`, `bg-field`, `text-on-brand`, `.campo`, `.chip`) y no colores fijos; `grep -rn "white/\|#070C16" apps/web/src` debería seguir vacío.
- Las animaciones de entrada corren una vez por montaje; un refetch no las repite.
- El tema claro se apoya en `color-mix()`, disponible en los navegadores del alcance (Chrome, Edge y Firefox actuales).
