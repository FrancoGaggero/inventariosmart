## 1. Base visual y tema

- [x] 1.1 `index.css` (D2, D3): tokens semánticos nuevos, paleta clara en `:root[data-theme='light']`, fondo con gradientes y grano, `.card`/`.card-hover`, `.btn` con respuesta al clic y primario degradado, `.chip`, keyframes `entrar`, `pulso`, `brillo` y bloque `prefers-reduced-motion`; `index.html` con `color-scheme: dark light`. Listo cuando: la app compila y, cambiando `data-theme` a mano en el `<html>`, fondo y tarjetas cambian de tema
- [x] 1.2 `lib/tema.ts` (`leerTema`, `aplicarTema`, `useTema`) aplicado en `main.tsx` antes del render; `vitest` + `jsdom` en `apps/web` con `lib/tema.test.ts`. Listo cuando: `pnpm --filter @inventariosmart/web test` pasa (preferencia guardada, preferencia del sistema, atributo aplicado) y `pnpm test` en la raíz lo incluye
- [x] 1.3 Reemplazo de colores fijos por tokens en todas las páginas y componentes (`border-white/N` → `border-line`, `bg-white/N` → `bg-fill`, `bg-[#070C16]` → `bg-field`, `text-white` en botones → `text-on-brand`). Listo cuando: `grep -rn "white/\|#070C16\|text-white" apps/web/src` sólo devuelve usos intencionales documentados y el tema claro no muestra restos oscuros en ninguna pantalla

## 2. Navegación responsive

- [ ] 2.1 `AppShell` (D1): enlaces con icono y etiqueta a partir de `lg`, indicador de sección activa, panel lateral por debajo con todos los enlaces, comercio, rol, plan, conmutador de tema y "Cerrar sesión"; cierre por navegación, Escape, velo y botón; foco gestionado; badge de alertas en el enlace y en el botón "Menú", con pulso si hay críticas; `max-w-6xl` y `overflow-x: clip`. Listo cuando: en el navegador integrado, a 360, 768, 1024 y 1280 px, `document.documentElement.scrollWidth === document.documentElement.clientWidth` en Inicio, Inventario, Alertas, Órdenes y Nueva orden, y todos los enlaces son alcanzables con teclado

## 3. Componentes y pantallas

- [x] 3.1 `ui/Skeleton`, `ui/EstadoVacio` (seis ilustraciones SVG), `ui/Anillo`, `ui/Barra`, `ui/Entrada` y `ui/useContador` con `ui/useContador.test.ts` (D4). Listo cuando: los tests de la web pasan (llega al valor final; con `reduced-motion` devuelve el final de inmediato) y los componentes tienen `aria-label`/`role` según D4
- [x] 3.2 `Dashboard` (D5): KPI con icono en burbuja, contador animado, anillos de margen, barras de cobertura en Reposición, skeletons y entrada escalonada. Listo cuando: al cargar Inicio se ven skeletons y luego los números suben hasta su valor; con `prefers-reduced-motion` aparecen directos
- [x] 3.3 Listados `ProductosPage`, `AlertasPage`, `OrdenesPage` (D5): cabecera pegajosa, hover de filas, tarjetas apiladas por debajo de `sm`, `EstadoVacio`. Listo cuando: a 360 px las tres pantallas muestran tarjetas sin scroll horizontal y todas las acciones de la tabla están en la tarjeta
- [x] 3.4 `EstadoVacio` en `MovimientosPage`, `ProveedoresPage`, `GastosPage`, `SugerenciaPage`; `.chip` en todos los filtros por estado. Listo cuando: cada listado vacío muestra ilustración, texto y acción (cuando el rol puede crear)
- [x] 3.5 `LoginPage` con panel lateral ilustrativo a partir de `lg` (D5). Listo cuando: a 1280 px se ve el panel con frase, tres beneficios y la gráfica; a 360 px sólo el formulario, sin desborde

## 4. Documentación y cierre

- [x] 4.1 ADR 0012 (sistema visual y tema), README (conmutador de tema, tests de la web), `docs/arquitectura.html` §7 (nota de UI responsive y tema), `openspec/CAPACIDADES.md` (fila "(sin spec, web UI)"). Listo cuando: los documentos reflejan D1 a D7
- [ ] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 4.3 Verificación visual (D6): capturas a 360, 768, 1024 y 1280 px de Inicio, Inventario, Alertas, Órdenes y Nueva orden, y en tema claro de Inicio y Alertas, guardadas en `openspec/changes/web-visual-polish/capturas/`; verificación en producción por Franco (`https://inventariosmart0.vercel.app`). Listo cuando: ninguna captura muestra desborde ni elementos superpuestos y Franco confirma
- [ ] 4.4 (manual, Franco) Registrar la mejora en Trello como tarjeta técnica de Fase 2 y en el backlog. Listo cuando: Trello y backlog coinciden
