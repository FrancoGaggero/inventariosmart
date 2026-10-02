## 1. Tokens y componentes

- [x] 1.1 Nuevos valores de los tokens en los dos temas (D1): `inverso`/`on-inverso`, `--font-serif`, escala de radios y elevaciones (D2); borrar `navy*` y los radiales azul y violeta del fondo. Listo cuando: `index.css` define todos los tokens en los dos temas y `pnpm --filter @inventariosmart/web typecheck` pasa
- [x] 1.2 `lib/contraste.test.ts` (D8). Listo cuando: el test pasa en los dos temas con los umbrales de D8 y, si algún valor de D1 se ajustó, quedó anotado en el design
- [x] 1.3 Componentes de D2: botones (primario lleno, `.btn-tonal`, `.btn-texto`), capas de estado, `.card` sin `::after` con elevación, `.card-inversa`, `.etiqueta`, `.acento-serif` y `:focus-visible` global; `ui/Campo.tsx` usa `.campo`. Listo cuando: el arnés de vista previa muestra botones, tarjetas, chips y campos en los dos temas con foco visible al navegar con Tab
- [x] 1.4 `index.html` con Instrument Serif y `theme-color` por tema, `lib/tema.ts` actualiza `theme-color`, nuevo `public/favicon.svg` (D6). Listo cuando: `tema.test.ts` cubre el `theme-color` y el favicon se ve en ámbar

## 2. Navegación

- [x] 2.1 `lib/navegacion.ts` con `seccionesDeNavegacion` y `accesosInferiores` (D3), con test. Listo cuando: `navegacion.test.ts` cubre la matriz de 3 roles por 3 planes, los grupos sin vacíos y los 4 accesos por rol, sin variables de entorno
- [x] 2.2 `BarraLateral` con el colapso a riel guardado en `localStorage`, la tarjeta del comercio, las secciones, la tarjeta del plan y el pie con usuario, tema y salir (D4). Listo cuando: en el arnés, a 1280 px expandida y colapsada, y a 1024 px, se ven todos los ítems del rol con el activo marcado y sin desborde
- [x] 2.3 `BarraSuperior` con la fecha, la campana y "Registrar movimiento" (D4). Listo cuando: la campana muestra el conteo y "Registrar movimiento" aparece sólo para dueño y empleado
- [x] 2.4 `BarraInferior` y `PanelNavegacion` con atrapado de foco, Escape, cierre por fondo y por cambio de ruta, y retorno del foco (D4). Listo cuando: a 360 px se ven los 4 accesos y "Más"; el panel atrapa Tab y Shift+Tab, se cierra con Escape y devuelve el foco; y ningún contenido queda tapado por la barra
- [x] 2.5 `AppShell` como orquestador, "Ir al contenido", `<main id="contenido">`, nombre accesible con las alertas, y sin el `ResizeObserver` (D4). Listo cuando: Tab desde el inicio de la página muestra "Ir al contenido" y lleva al `main`, y `pnpm lint` y `pnpm typecheck` pasan

## 3. Pantallas

- [x] 3.1 `lib/inicio-formato.ts` con test y el nuevo saludo de `HomePage`: serif en el nombre, píldoras y "Accesos" reducido (D5). Listo cuando: `inicio-formato.test.ts` pasa y el arnés muestra el saludo con el nombre en cursiva en los dos temas
- [x] 3.2 `Dashboard` con el primer KPI en `card-inversa` y los tonos nuevos de los íconos (D5). Listo cuando: el panel se ve en los dos temas sin texto con bajo contraste en la tarjeta invertida
- [x] 3.3 Portada, login, registro y onboarding con la paleta nueva, el panel en `card-inversa`, el logo ámbar y el acento serif; `GraficaBarras`, `IconoCanal` y los overlays sin colores fijos (D6). Listo cuando: los greps de D6 dan vacío salvo el logo de Google, y las cuatro pantallas se ven en los dos temas a 360 y 1280 px
- [x] 3.4 Series de `InflacionPage` (D7) y recorrido general de colores fijos. Listo cuando: el grep de `blue|indigo|sky-|violet-` de Tailwind en `apps/web/src` da vacío y el gráfico de inflación distingue las cuatro series en los dos temas

## 4. Verificación y cierre

- [x] 4.1 Recorrido visual en el arnés: panel, Inventario, Alertas, Falta de stock, Plan, portada y login; dueño, contador y empleado; 360, 768, 1024 y 1280 px; dos temas. Listo cuando: no hay desborde horizontal en ningún caso, hay capturas de cada pantalla y los tres archivos del arnés quedan borrados
- [x] 4.2 ADR 0022, `docs/arquitectura.html` (la sección de la web) y `openspec/CAPACIDADES.md` (fila 24, `skip_specs`). Listo cuando: los documentos reflejan D1 a D8
- [x] 4.3 `pnpm lint`, `pnpm format:check`, `pnpm typecheck` y `pnpm test` (la web también sin `.env`, como en CI); push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [x] 4.4 Producción: Franco recorre https://inventariosmart0.vercel.app en la compu y en el celular, en los dos temas. Listo cuando: Franco confirma que la barra lateral, la barra inferior y la paleta se ven bien
- [ ] 4.5 (manual, Franco) Anotar el rediseño en Trello y en el backlog. Listo cuando: Trello y backlog lo reflejan
