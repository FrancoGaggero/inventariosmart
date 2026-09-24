## Why

La web funciona pero se ve plana y, sobre todo, la barra de navegación no se adapta: son hasta nueve enlaces en una fila fija de unos 1.160 px lógicos, así que en el navegador integrado (489 px), en una notebook con escala 125 % (unos 1.090 px) o en un celular la página entera scrollea en horizontal y los enlaces quedan escondidos. Franco lo reportó y se midió (`document.documentElement.scrollWidth` 1.291 px con `clientWidth` 474 px en Inicio). Además pidió una interfaz más viva: hoy los indicadores son texto plano, no hay transiciones ni estados de carga o vacíos con carácter, y la demo ante la cátedra se apoya en la web.

Este change es pulido visual y responsive de `apps/web` sobre las pantallas ya construidas (RNF-01 usabilidad, RNF-08 mensajes claros): no cambia la API, el contrato OpenAPI, las reglas de negocio ni los criterios de las HU, por eso se declara `skip_specs: true`, como el sprint 0. Va entre HU-07 y HU-09 (Fase 2) porque corrige un defecto visible y mejora todas las pantallas de la demo a la vez.

## What Changes

- **Navegación responsive** (el defecto): cabecera con logo, enlaces con icono y etiqueta a partir de 1024 px, y por debajo un botón de menú que abre un panel lateral con todos los enlaces, el comercio, el rol, el plan, el tema y "Cerrar sesión"; el botón muestra el contador de alertas activas. Ningún ancho entre 360 y 1.920 px produce scroll horizontal del documento.
- **Sistema visual** con Tailwind v4 y CSS, sin librerías nuevas: fondo con gradiente radial suave y grano, tarjetas con borde degradado y sombra, elevación al pasar el mouse, botón primario con degradado y brillo, chips y botones con respuesta al clic, foco visible. Animaciones de entrada escalonadas para tarjetas y filas, contadores que suben hasta el valor, pulso en el badge de alertas cuando hay críticas; todo desactivado con `prefers-reduced-motion`.
- **Panel de Inicio**: tarjetas KPI con icono en burbuja de color, número grande animado, anillo de porcentaje para los márgenes y barra de cobertura en Reposición; skeletons mientras carga en lugar de "…".
- **Listados**: filas con hover y cabecera pegajosa dentro de la tarjeta; en pantallas angostas Inventario, Alertas y Órdenes muestran tarjetas apiladas en lugar de una tabla que scrollea.
- **Estados vacíos** con ilustración SVG inline y llamada a la acción en Inventario, Movimientos, Alertas, Órdenes, Proveedores y Gastos.
- **Tema claro y oscuro** con conmutador en la cabecera, preferencia guardada en el navegador y valor inicial según el sistema; los colores fijos de las pantallas pasan a tokens para que ambos temas queden completos.
- **Login** con panel lateral ilustrativo a partir de 1024 px (frase, tres beneficios y una gráfica decorativa).
- **Tests de la web**: se incorpora Vitest con jsdom para las piezas puras (tema, contador animado) y `pnpm test` pasa a incluir la web.

Supuestos registrados:
- **Sobrio antes que vistoso**: gradientes y sombras de baja intensidad, animaciones de 200 a 600 ms; ninguna decoración tapa un dato.
- **Sin dependencias de animación ni de gráficos** (Framer Motion, Recharts): las micro-gráficas son SVG propios y las transiciones son CSS.
- **Tema claro** es la única parte con riesgo de contraste; se revisa con capturas antes de cerrar.
- **Verificación de desborde**: no se agrega Playwright (necesita sesión autenticada y navegador en CI); se verifica en el navegador integrado con la sesión de Franco a 360, 768, 1024 y 1280 px con un script de comprobación documentado en las tareas, más las capturas en el change.
- **Mobile Flutter** no cambia.

## Capabilities

### New Capabilities

Ninguna. Pulido visual sin comportamiento nuevo del producto (`skip_specs: true`).

### Modified Capabilities

Ninguna.

## Impact

- **Código:** `apps/web` únicamente: `index.css` (tokens de tema, fondo, tarjetas, botones, animaciones), `app/AppShell.tsx` (cabecera y panel lateral), `lib/tema.ts`, componentes nuevos en `ui/` (`Skeleton`, `EstadoVacio`, `Anillo`, `Barra`, `Entrada`, `useContador`), `features/dashboard/Dashboard.tsx`, listados de Inventario, Alertas y Órdenes, estados vacíos en seis páginas, `features/auth/LoginPage.tsx`, reemplazo de colores fijos por tokens en todas las páginas; `package.json` suma `vitest` y `jsdom`.
- **Sin cambios** en `apps/api`, `packages/shared`, `packages/api-client`, `docs/openapi.json` ni `apps/mobile`.
- **Documentación:** ADR 0012 (sistema visual: tokens de tema, modo claro, animaciones sin librería), README (tema, tests de la web), `docs/arquitectura.html` (§7 nota de UI), `openspec/CAPACIDADES.md`.
- **Fuera de alcance:** rediseño de flujos o de la información que muestra cada pantalla, gráficos de series (evolución mensual), PWA, accesibilidad más allá de foco visible, contraste y `reduced-motion`, cambios en la app Android.
