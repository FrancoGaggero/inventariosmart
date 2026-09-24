## Context

Ver proposal.md – Why. Estado actual de `apps/web`: React 19 + Vite + Tailwind v4 (`@theme` con tokens `--color-bg`, `--color-brand`, `--color-t1…t3`, etc. en `index.css`), `lucide-react` para iconos, TanStack Query, react-router 7. Clases utilitarias `.card`, `.btn`, `.btn-primary`, `.btn-ghost` en `index.css`. Muchas pantallas usan colores fijos (`border-white/8`, `bg-white/5`, `bg-[#070C16]`, `text-white`) que no responden a un tema claro. `AppShell` tiene `header > nav.flex` sin colapso y `main.max-w-5xl`. Las cabeceras de página ya usan `flex-wrap`; las tablas anchas van en `.card.overflow-x-auto` con `min-w-[640px]`. No hay tests en la web; CI corre lint, typecheck, tests recursivos y build. `index.html` fija `color-scheme: dark`.

Restricciones: sin librerías de animación ni gráficos; respetar `prefers-reduced-motion`; nada de lo nuevo puede tapar datos ni cambiar textos que los e2e de la API o la app mobile no dependen (no dependen); CI sin navegador.

## Goals / Non-Goals

**Goals:**
- Cero desborde horizontal del documento en cualquier ancho ≥ 360 px, con toda la navegación accesible.
- Un sistema de tokens que sirva a los dos temas y elimine colores fijos en las páginas.
- Componentes visuales reutilizables (skeleton, estado vacío, anillo, barra, contador, entrada escalonada) usados de forma consistente.
- Verificable: unit tests para lo puro, checklist con capturas para lo visual.

**Non-Goals:**
- Cambiar rutas, hooks de datos o el contrato; gráficos de series; PWA; rediseño de formularios más allá de tokens y foco.

## Decisions

### D1 · Navegación: enlaces a partir de `lg`, panel lateral por debajo
`AppShell` mantiene la cabecera pegajosa. A partir de `lg` (1024 px) muestra los enlaces con icono y etiqueta (`hidden lg:flex`), con un subrayado animado como indicador de sección activa. Por debajo, un botón "Menú" (icono `Menu`, `aria-expanded`, `aria-controls`) abre un panel lateral (`<aside role="dialog" aria-modal>`, 288 px, desde la izquierda, con velo) que lista todos los enlaces con icono, muestra comercio, rol y plan, el conmutador de tema y "Cerrar sesión"; se cierra al navegar, con Escape, con el velo y con el botón de cerrar; el foco pasa al primer enlace al abrir y vuelve al botón al cerrar; `body` no scrollea mientras está abierto. El badge de alertas activas se muestra en el enlace (lg) y sobre el botón "Menú". El contenedor pasa a `max-w-6xl` y `html, body { overflow-x: clip }` como red de seguridad. Alternativa descartada: barra con scroll horizontal propio; esconde enlaces y no resuelve el celular.

### D2 · Tokens de tema y modo claro
Los tokens de `@theme` se mantienen como los del tema oscuro y se agregan tokens semánticos nuevos: `--color-line` (bordes), `--color-fill` (relleno suave), `--color-field` (fondo de inputs), `--color-card` y `--color-card-2` (degradado de tarjeta), `--color-glow` (brillo del primario), `--shadow-card`. `:root[data-theme='light']` redefine `--color-bg`, `--color-bg-2`, `--color-navy*`, `--color-t1…t3`, `--color-line`, `--color-fill`, `--color-field`, `--color-card*` con una paleta clara (fondo `#f5f7fb`, texto `#0f172a`, línea `rgba(15,23,42,.08)`). Como Tailwind v4 emite `var(--color-x)` en cada utilidad, las clases `text-t2`, `bg-bg`, `border-line`, `bg-fill`, `bg-field` cambian solas con el atributo. Se reemplazan en todas las páginas `border-white/N` → `border-line`, `bg-white/N` → `bg-fill`, `bg-[#070C16]` → `bg-field`, `text-white` en botones → `text-on-brand`. `lib/tema.ts`: `leerTema()` (localStorage `tema` | `matchMedia('(prefers-color-scheme: light)')`), `aplicarTema(t)` (atributo `data-theme` en `<html>` y `color-scheme`), `useTema()` (estado + persistencia); `main.tsx` aplica el tema antes de renderizar para evitar el destello; `index.html` pasa a `color-scheme: dark light`. Alternativa descartada: duplicar clases `dark:`/`light:` en cada elemento; multiplica el markup y se olvida.

### D3 · Fondo, tarjetas, botones y movimiento (CSS)
`body`: dos gradientes radiales (brand y violet al 12 % arriba a la izquierda y derecha) sobre `--color-bg` más una capa de grano (SVG `feTurbulence` en data URI, opacidad 0.035) fija. `.card`: fondo degradado `--color-card` → `--color-card-2`, borde `--color-line`, `box-shadow: var(--shadow-card)`, y un pseudo-elemento con borde degradado (brand → transparente) visible al hover; `.card-hover` suma `translateY(-2px)` y sombra mayor. `.btn` suma `active:scale-[.98]`; `.btn-primary` degradado brand → brand-2 con sombra de color (`--color-glow`); `.chip` unifica el estilo de los filtros por estado. Animaciones: `@keyframes entrar` (opacidad 0 → 1, `translateY(8px)` → 0, 360 ms) aplicada por `.entra` con `animation-delay: calc(var(--i) * 40ms)`; `@keyframes pulso` para el badge crítico; `@keyframes brillo` para el skeleton. `@media (prefers-reduced-motion: reduce)` anula transiciones y animaciones. Sin librerías. Alternativa descartada: Framer Motion; 40 KB y una dependencia para cuatro efectos.

### D4 · Componentes `ui/`
- `Skeleton` (`ui/Skeleton.tsx`): bloque con brillo, `aria-hidden`; variantes `linea`, `numero`, `fila`.
- `EstadoVacio` (`ui/EstadoVacio.tsx`): ilustración SVG inline (variantes `cajas`, `campana`, `carrito`, `camion`, `recibo`, `flechas`), título, texto y acción opcional; `role="status"`.
- `Anillo` (`ui/Anillo.tsx`): SVG circular con `stroke-dasharray` animado desde 0 al porcentaje, color por signo, valor al centro; `aria-label` con el valor final.
- `Barra` (`ui/Barra.tsx`): barra de progreso horizontal con color por umbral (crit/warn/ok).
- `useContador(valor, duracion = 600)` (`ui/useContador.ts`): `requestAnimationFrame` con easing `easeOutCubic` desde el valor anterior al nuevo; devuelve el valor final de inmediato con `reduced-motion` o en tests; el número visible lleva `aria-live="off"` y el elemento `aria-label` con el valor final para no dictar cifras intermedias.
- `Entrada` (`ui/Entrada.tsx`): envoltorio que aplica `.entra` y `--i` según el índice.
Alternativa descartada: un paquete `packages/ui`; la app Android no lo usa y no hay segunda web.

### D5 · Aplicación en pantallas
- `Dashboard`: KPI en `.card.card-hover` con icono en burbuja (`bg-brand/15` etc.), valor con `useContador` (formato con `Intl` sobre el valor animado), anillo para margen bruto % y neto %, barra de cobertura por ítem de Reposición, skeletons durante la carga, `Entrada` escalonada en tarjetas y filas.
- Listados (`ProductosPage`, `AlertasPage`, `OrdenesPage`): tabla `hidden sm:table` con `thead` pegajoso (`sticky top-0 bg-card backdrop-blur`) y `tr:hover` con `bg-fill`; lista `sm:hidden` de tarjetas con los mismos datos y acciones; `EstadoVacio` cuando no hay items. `MovimientosPage`, `ProveedoresPage`, `GastosPage`: `EstadoVacio` con la ilustración que corresponde.
- `AppShell`: badge de alertas con `.pulso` cuando `criticas > 0`; conmutador de tema (`Sun`/`Moon`) en la cabecera (lg) y en el panel.
- `LoginPage`: grid `lg:grid-cols-2`; columna derecha con degradado brand → violet, frase, tres beneficios con icono y una gráfica de barras SVG decorativa; en móvil sólo el formulario.

### D6 · Tests y verificación
`apps/web` suma `vitest` y `jsdom` (`test: vitest run`, `environment: jsdom`): `lib/tema.test.ts` (lectura con y sin `localStorage`, aplicación del atributo, preferencia del sistema) y `ui/useContador.test.ts` (llega al valor final; con `reduced-motion` devuelve el final de inmediato). `pnpm test` en la raíz ya es recursivo, así que CI los corre sin cambios en el workflow. Verificación visual: en el navegador integrado con la sesión de Franco, para 360, 768, 1024 y 1280 px y para Inicio, Inventario, Alertas, Órdenes y Nueva orden, ejecutar `document.documentElement.scrollWidth === document.documentElement.clientWidth` y guardar capturas en `openspec/changes/web-visual-polish/capturas/` (se archivan con el change). Tema claro: mismas capturas para Inicio y Alertas.

### D7 · Documentación
ADR 0012 (tokens de tema, modo claro por atributo, animaciones en CSS sin librería, tests de la web con Vitest). README: conmutador de tema y `pnpm --filter @inventariosmart/web test`. `docs/arquitectura.html` §7: nota de UI (navegación responsive, tema). `openspec/CAPACIDADES.md`: fila "(sin spec, web UI)".

## Risks / Trade-offs

- [Contraste insuficiente en tema claro] → paleta clara definida en tokens y revisada con capturas antes de cerrar; los colores semánticos (ok/warn/crit) se oscurecen un tono en claro.
- [Animaciones que marean o distraen] → duraciones cortas, una sola entrada por montaje (no en cada refetch), `reduced-motion` respetado.
- [Colores fijos que se escapan al reemplazo] → búsqueda de `white/`, `#0`, `text-white` en `apps/web/src` como tarea explícita y captura del tema claro en cada pantalla.
- [Regresión de layout en formularios] → sólo cambian tokens, no estructura; se revisan en la checklist.
- [Contador animado con lectores de pantalla] → `aria-label` con el valor final y `aria-live="off"`.

## Migration Plan

Sólo `apps/web`: `pnpm add -D vitest jsdom` en la app, deploy automático por Vercel al pushear. Rollback: revertir el commit. Sin migraciones ni variables nuevas.
