## Context

ADR 0012 definió el mecanismo visual de la web: tokens semánticos en `@theme` de Tailwind v4, tema claro con `:root[data-theme='light']`, tema leído de `localStorage` o del sistema antes del primer render, efectos sólo con CSS y componentes en `ui/`. El mecanismo se mantiene; cambian los valores y la navegación.

Situación actual, según la revisión del código:
- **Tokens (`apps/web/src/index.css`):**
  - Unas 900 utilidades usan `brand*`, `ok`, `warn`, `crit`, `violet`, `t1-3`, `line*`, `fill` y `field`.
  - `card*` se usa sólo a través de `.card`, y `navy*` no se usa.
  - En claro no se redefinen `brand`, `brand-2`, `on-brand` ni `whatsapp`.
- **Colores fijos:**
  - Login y portada usan `text-white` y `bg-white/15` sobre degradés.
  - `GraficaBarras` e `IconoCanal` llevan `#fff`.
  - El favicon tiene el degradé azul y violeta.
  - Los overlays usan `bg-black/50`.
- **Navegación (`app/AppShell.tsx`):**
  - 15 ítems condicionados por rol y plan (`esDuenio`, `veInventario`, `veGastos`, `veAlertas`, `conAlertas`), un badge de alertas y un `ResizeObserver` que esconde etiquetas.
  - Debajo de `lg`, un cajón con Escape, foco inicial y de retorno, y bloqueo del scroll, pero sin atrapar el foco.
  - No hay *skip link* ni tests de la navegación.
- **Inicio:** repite rol, comercio y plan, y tiene una grilla de "Accesos" que duplica el menú.

Motivación: ver proposal.md.

## Goals / Non-Goals

**Goals:**
- Cambiar la identidad visual completa tocando sobre todo `index.css` y la navegación, no las 40 páginas.
- Que la navegación escale con los ítems actuales y los que vengan, en escritorio, tablet y celular.
- Que el contraste y la visibilidad por rol queden cubiertos por tests.

**Non-Goals:**
- Una librería de componentes (MUI, Material Web): la app sigue con Tailwind y CSS propios. Se toman los criterios de Material, no su implementación.
- Rediseñar el contenido de cada página.

## Decisions

### D1. Mismos tokens, valores nuevos

Se reasignan los valores y se mantienen los nombres. Se definen todos los tokens también en claro, incluidos `brand`, `brand-2` y `on-brand`.

| Token | Oscuro | Claro |
|---|---|---|
| `bg` / `bg-2` | #14110D / #1A1612 | #F4EFE6 / #FBF8F2 |
| `card` / `card-2` | #1E1A15 / #231E18 | #FFFCF7 / #FAF6EF |
| `field` | #110E0B | #FFFFFF |
| `t1` / `t2` / `t3` | #F3ECE1 / #B8AC99 / #857A69 | #1F1A14 / #5C5244 / #8A7F6F |
| `line` / `line-2` / `fill` | rgba(243,236,225,.08 / .14 / .05) | rgba(31,26,20,.09 / .16 / .045) |
| `brand` / `brand-2` | #E0A54A / #EBB866 | #B87A22 / #A66C1A (ver la nota de contraste) |
| `brand-3` (texto en ámbar) | #F0C07A | #8A5A12 |
| `on-brand` | #1F1A14 | #1F1A14 |
| `ok` | #5BB585 | #2F7D55 |
| `warn` (terracota) | #E5824A | #B4561F |
| `crit` | #E5574F | #BF3A30 |
| `violet` (ciruela, sólo cuarta serie) | #B39BD6 | #7A5C9E |
| `glow` | ámbar al 35 % | ámbar al 25 % |
| `inverso` / `on-inverso` (nuevos) | #F3ECE1 / #1F1A14 | #1F1A14 / #F3ECE1 |

`whatsapp` y `on-whatsapp` siguen iguales en los dos temas. Se borran los tokens `navy*`.

**Ajuste por contraste (task 1.2):** el ámbar claro propuesto, #C8892B, daba 2,6:1 sobre el fondo crema #F4EFE6, por debajo del 3:1 que WCAG pide para indicadores de interfaz. Se oscureció a #B87A22 (3,1:1 sobre el fondo y 4,8:1 con texto `on-brand`), y `brand-2`, el de hover, a #A66C1A.

- *Alternativa:* renombrar `brand` a `acento` en todo el código. Se descarta porque toca unas 900 clases sin cambiar nada visible. El nombre `brand` sigue siendo correcto: es el color de marca.
- *Alternativa:* el texto blanco sobre el ámbar. Se descarta: #FFFFFF sobre #C8892B da 2,9:1, por debajo de AA. El texto oscuro da más de 6:1 en los dos temas, y es lo que muestra la referencia.

### D2. Forma, elevación, estados y tipografía (criterios de Material 3)

- **Forma:** `--radius-sm` 8, `-md` 12, `-lg` 16, `-xl` 24 y redondo completo. `.card` usa 20, los botones 12 y los chips y la navegación activa, redondo completo.
- **Elevación:** `--shadow-1` a `--shadow-3`, sombras cálidas (tinta al 6-14 %) y difusas. En oscuro, la elevación se marca sobre todo con superficies apenas más claras (`card` → `card-2`), como en Material, y con sombras más profundas.
- **Capas de estado:** un pseudo-elemento o un `background` con `color-mix(in srgb, currentColor 8%, transparent)` al pasar el mouse y 12 % con foco o al apretar, en `.btn`, `.chip`, `.nav-item` y `.fila-accion`.
- **Botones:** `.btn-primary` (lleno ámbar), `.btn-tonal` (nuevo, ámbar al 15 % con texto `brand-3`), `.btn-ghost` (con borde) y `.btn-texto` (nuevo). Sin degradés.
- **Tarjetas:**
  - `.card`: superficie sólida con borde `line` y `--shadow-1`. Se elimina el borde degradé `::after`.
  - `.card-hover`: sube a `--shadow-2`.
  - `.card-inversa`, nueva: fondo `inverso`, texto `on-inverso`, y el texto secundario es `on-inverso` al 70 %.
- **Píldoras:** `.etiqueta` (redonda, xs, `fill` y `t2`) y `.etiqueta-acento` (ámbar tonal).
- **Tipografía:** Plus Jakarta Sans sigue para todo. `--font-serif` (Instrument Serif, itálica 400) se usa sólo con la clase `.acento-serif`: el nombre en el saludo y el título de la portada.
- **Foco:** `:focus-visible` con un anillo de 2 px `brand-3` y 2 px de separación en todo lo interactivo, incluidos los `NavLink`.
- **Fondo:** `bg` liso, un radial ámbar al 8 % arriba a la izquierda y el grano actual. Se quitan los radiales azul y violeta.

### D3. La navegación como datos: `lib/navegacion.ts`

Módulo puro sin React ni Firebase, testeable como en CI.

- `seccionesDeNavegacion({ rol, plan }): Seccion[]`, donde cada sección tiene `{ clave, titulo, items }` y cada ítem `{ to, etiqueta, icono, fin?, alerta? }`. El ícono es una clave que la vista traduce a lucide. Los grupos vacíos no se devuelven.

  | Sección | Ítems y condición |
  |---|---|
  | General | Inicio (siempre); Movimientos (siempre); Inventario (DUENIO, EMPLEADO) |
  | Análisis | Rentabilidad y Gastos (DUENIO, CONTADOR); Alertas (DUENIO, CONTADOR, con `alerta: true`); Falta de stock, Stock parado, Inflación y Reportes (DUENIO, CONTADOR, PRO+) |
  | Compras | Órdenes y Remarcaciones (DUENIO, CONTADOR, PRO+); Proveedores (DUENIO) |
  | Asistente | Asistente (DUENIO) |
  | Cuenta | Usuarios y Comercio (DUENIO); Plan (siempre) |

  Respeta exactamente la visibilidad actual de los 15 ítems y suma Falta de stock y Stock parado con la misma condición que el resto de Análisis PRO.
- `accesosInferiores({ rol, plan }): Item[]` devuelve 4 ítems para la barra inferior móvil. "Más" lo agrega la vista.
  - Dueño: Inicio, Movimientos, Inventario, Alertas.
  - Contador: Inicio, Rentabilidad, Alertas, Gastos.
  - Empleado: Inicio, Inventario, Movimientos, Plan.

### D4. Estructura del shell

`AppShell` queda como orquestador: datos de `useMe`, `useResumenAlertas`, `useTema` y `useAuth`, la confirmación de salida y el estado del panel. La vista se divide en:

- **`BarraLateral`**, desde `md`:
  - `aside` fijo a la izquierda, de 256 px expandida o 76 px como riel;
  - de arriba abajo: logo y botón de colapsar (`aria-expanded`, `aria-controls`), tarjeta del comercio (nombre y rol), las secciones con su rótulo y la tarjeta del plan al pie;
  - la tarjeta del plan muestra el plan vigente y "Mejorar plan" hacia `RUTA_PLAN`; en PREMIUM no aparece;
  - abajo de todo, el usuario (email), el cambio de tema y "Cerrar sesión";
  - en el riel, cada ítem muestra sólo el ícono con `title` y su nombre accesible, y el badge queda como un punto.
  - El estado colapsado se guarda en `localStorage['barra-colapsada']` (con `try/catch`). La primera vez arranca colapsada por debajo de 1280 px (`xl`) y expandida desde ahí: con la barra abierta, a 1024 px el contenido queda en 768 px y los KPI no entran en cuatro columnas, así que pasan a cuatro recién desde `xl`.
- **`BarraSuperior`**: banda fina y pegajosa sobre el contenido.
  - A la izquierda, la fecha de hoy en Buenos Aires.
  - A la derecha, la campana con el conteo de alertas hacia `/alertas` (si `conAlertas`) y "Registrar movimiento" (`btn-primary`, dueño y empleado) hacia `/movimientos/nuevo`.
  - En móvil, el logo reemplaza a la fecha.
- **`BarraInferior`**, debajo de `md`: `nav aria-label="Accesos rápidos"` fija abajo.
  - Cuatro destinos con ícono y etiqueta, y el indicador activo en píldora tonal, como la *navigation bar* de Material.
  - El último botón, "Más", abre el panel.
  - Alto de 64 px más `env(safe-area-inset-bottom)`. El `main` suma ese espacio abajo.
- **`PanelNavegacion`**: el contenido de la barra lateral expandida dentro de un diálogo modal (`role="dialog"`, `aria-modal`).
  - Entra desde la izquierda.
  - Atrapa el foco: Tab y Shift+Tab ciclan dentro.
  - Lo cierran Escape, el fondo o un cambio de ruta.
  - Bloquea el scroll del body y devuelve el foco a "Más".
  - Reutiliza la lógica del cajón actual y le agrega el atrapado de foco.
- El ítem activo se marca con `aria-current="page"`, que `NavLink` agrega solo. El nombre accesible incluye las alertas, por ejemplo "Alertas, 3 activas". Se elimina el `ResizeObserver`.
- **Enlace "Ir al contenido":** visible sólo con foco, apunta a `<main id="contenido" tabIndex={-1}>`.
- **`main`:** `max-w-6xl` dentro del área de contenido, con padding de 16 a 32 px.

### D5. Inicio

- `lib/inicio-formato.ts`, puro:
  - `saludo(ahora)`: "Buen día" de 5 a 12 h, "Buenas tardes" de 12 a 20 h y "Buenas noches" el resto, en hora de Buenos Aires;
  - `fechaLarga(ahora)`, por ejemplo "jueves 2 de octubre".
- `HomePage`:
  - `h1` "{saludo}, <span class="acento-serif">{comercio}</span>";
  - debajo, píldoras: plan (`etiqueta-acento`) y alertas activas (`etiqueta`, si `conAlertas`);
  - se quita la línea de rol, comercio y plan;
  - "Accesos" queda sólo con la tarjeta de salud del sistema y, para el EMPLEADO, sus contadores de stock bajo y sin stock;
  - el resto de los accesos los cubre la navegación.
- `Dashboard`: el KPI "Stock valorizado" pasa a `card-inversa`, y su burbuja de ícono a ámbar sobre `inverso`. Los otros KPI usan ámbar, ok, terracota y ciruela.

### D6. Pantallas públicas y piezas con color fijo

- **Login y portada:** el panel con degradé pasa a `card-inversa`.
  - `GraficaBarras` usa `currentColor` y `--color-brand`, sin `#ffffff`.
  - Los `text-white/*` y `bg-white/15` pasan a `text-on-inverso` con opacidad o a `bg-brand/15`.
  - El logo pasa de una baldosa con degradé a una baldosa ámbar (`bg-brand text-on-brand`), en todos los lugares donde aparece.
- **`IconoCanal`:** el auricular toma `--color-on-whatsapp`.
- **Overlays:** `bg-black/50` pasa a `bg-[color-mix(in_srgb,var(--color-t1)_40%,transparent)]`, que hace de velo en los dos temas.
- **`index.html`:** carga Instrument Serif itálica junto a Plus Jakarta Sans, y suma `<meta name="theme-color">` con `media` para cada tema. `aplicarTema` también actualiza el `theme-color` cuando el tema elegido no coincide con el del sistema.
- **`public/favicon.svg`:** baldosa ámbar con el glifo en tinta.
- Quedan vacíos los greps `white/`, `text-white`, `bg-black` y `#[0-9a-f]{3,6}` en `apps/web/src/**/*.tsx`, salvo los colores oficiales del logo de Google en `LoginPage`.

### D7. Gráficos

- `InflacionPage`: los datos del comercio van en color y las referencias oficiales en gris. Mis precios en `brand` (ámbar), mis costos en `violet` (ciruela), IPC en `t2` e IPC bienes en `t3` punteado. La primera versión usaba `warn` (terracota) para los costos, pero en tema claro quedaba muy parecido al ámbar.
- `Anillo`, `Barra` y `PlanPage` siguen usando los colores de estado, que ya tienen los valores nuevos.
- `EstadoVacio` toma el ámbar por `brand-3` sin cambios.

### D8. Tests

- `lib/navegacion.test.ts`:
  - la matriz de 3 roles por 3 planes contra la tabla de D3;
  - que ningún grupo salga vacío;
  - que haya 4 accesos inferiores por rol y que sean visibles en `seccionesDeNavegacion`.
- `lib/inicio-formato.test.ts`: los límites de 5, 12 y 20 h en Buenos Aires, también cuando en UTC ya es otro día.
- **`lib/contraste.test.ts`:** lee `src/index.css` con `fs`, extrae los tokens de `@theme` y de `:root[data-theme='light']`, y compone los `rgba` sobre su fondo. Calcula la relación WCAG y exige, en los dos temas:
  - 4,5:1 para `t1` y `t2` sobre `bg`, `card` y `bg-2`;
  - 4,5:1 para `on-brand` sobre `brand`, para `brand-3` sobre `bg` y `card`, y para `on-inverso` sobre `inverso`;
  - 3:1 para `t3` y para `ok`, `warn` y `crit` sobre `card`;
  - 3:1 para `brand` sobre `bg`, como componente de interfaz.

  Si un valor de D1 no pasa, se ajusta el valor y se documenta.

### Módulos y documentos afectados

- **Web:** `index.css`, `index.html`, `public/favicon.svg`, `app/AppShell.tsx` y los nuevos `app/BarraLateral.tsx`, `app/BarraSuperior.tsx`, `app/BarraInferior.tsx` y `app/PanelNavegacion.tsx`.
- **Módulos puros nuevos:** `lib/navegacion.ts`, `lib/inicio-formato.ts`, `lib/contraste.test.ts`.
- **Cambios en:** `lib/tema.ts` (`theme-color`), `features/home/HomePage.tsx`, `features/dashboard/Dashboard.tsx`, `features/landing/LandingPage.tsx`, `features/auth/{LoginPage,RegistroPage,OnboardingPage}.tsx`, `features/inflacion/InflacionPage.tsx`, `ui/{GraficaBarras,IconoCanal,Campo,Confirmar}.tsx`.
- **ADR 0022** "Paleta ámbar cálida y navegación lateral con criterios de Material", que reemplaza D2 (valores) y D1 (navegación) de ADR 0012. También `docs/arquitectura.html` y `openspec/CAPACIDADES.md`.
- **Sin cambios:** API, `packages/shared`, contrato OpenAPI y la app Flutter.

## Risks / Trade-offs

- [Algún color fijo que no apareció en los greps queda azul] → Grep de `blue`, `indigo`, `violet-` y `sky-` de Tailwind, y de hex, más el recorrido visual en los dos temas.
- [El ámbar de marca se confunde con un aviso] → `warn` pasa a terracota y los avisos llevan ícono y texto, no sólo color.
- [El riel de íconos esconde el significado] → Tooltips con `title`, el nombre accesible completo y el botón para expandirlo. Desde `lg` arranca expandida.
- [La barra inferior tapa contenido o botones fijos de las páginas] → El `main` suma el alto de la barra y el *safe area*. Se revisa en las páginas con acciones al pie (formularios).
- [Cambiar toda la identidad a dos meses de la entrega] → Es reversible con un commit, porque los tokens se mantienen. Las pruebas de la API no se tocan.

## Migration Plan

Sin migraciones. El deploy es normal en Vercel, y para volver atrás alcanza con revertir el commit. La preferencia `barra-colapsada` en `localStorage` es nueva y se ignora si no existe.
