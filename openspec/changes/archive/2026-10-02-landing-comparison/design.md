## Context

La portada (`features/landing/LandingPage.tsx`) tiene, en orden, el hero (L144-203), `#servicios`, `#como` y `#planes`, y su cabecera enlaza a esas anclas. Usa `Entrada` para las entradas escalonadas, `.card` y los tokens de ADR 0022: `brand`, `warn`, `ok`, `crit`, `card-inversa` y `acento-inverso`. Las animaciones son CSS, están en `index.css` y se apagan con `prefers-reduced-motion`. Motivación y qué se adapta de la referencia: ver proposal.md.

## Goals / Non-Goals

**Goals:**
- Reproducir la estructura de la referencia (encabezado, dos listas y un círculo central) con nuestro sistema visual, en los dos temas y en cualquier ancho.
- Que la animación cuente el producto en un vistazo sin depender de ningún archivo externo.

**Non-Goals:**
- Reproducir los valores exactos de la referencia: tamaños en `vw`, colores, sombra y tipografía.

## Decisions

### D1. Un componente, sin datos externos

`FrenteAFrente.tsx` exporta la sección. Los textos son constantes del archivo (`CON_PLANILLA` y `CON_INVENTARIOSMART`), y la animación es el subcomponente `AnimacionReposicion`, que no se exporta.

- *Alternativa:* textos en `lib/landing-formato.ts`. Se descarta porque no hay lógica que probar aparte; el test del componente verifica las listas.

### D2. Estructura y diseño

- **`<section id="diferencia" aria-labelledby="diferencia-titulo">`:** `max-w-6xl mx-auto px-4 md:px-6 py-12 flex flex-col items-center gap-9`.
- **Encabezado:**
  - píldora `.etiqueta .etiqueta-acento` con el ícono `ArrowLeftRight` y "Antes y después";
  - `<h2 id="diferencia-titulo">` en `font-extrabold tracking-tight text-center`, `text-[clamp(28px,4vw,48px)]` y `leading-[1.15]`;
  - la segunda línea va en un `span` con `bg-[linear-gradient(90deg,var(--color-brand),var(--color-warn))] bg-clip-text text-transparent inline-block pb-1`.
- **Grilla:** `w-full flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-9 lg:items-center`. Las fracciones reemplazan a los `26vw` de la referencia, que desbordaban dentro de `max-w-6xl`.
- **Listas:**
  - cada columna es un `div` con su `<h3 class="sr-only">` ("Con la planilla" y "Con InventarioSmart") y un `<ul class="flex flex-col gap-3">`;
  - cada `li` es `card p-4 flex gap-3 items-start`, con el ícono de 18 px (`X` en `text-crit`, `Check` en `text-ok`, los dos `aria-hidden`) y el texto `text-sm leading-snug`;
  - el texto va en `text-t2` del lado de la planilla y en `text-t1` del lado de InventarioSmart;
  - sin `card-hover`.
- **Centro:** `order-first lg:order-none self-center` y un círculo `relative rounded-full overflow-hidden card-inversa shadow-3 size-[clamp(200px,22vw,320px)] grid place-items-center` con la animación.
- **Entradas:** con `Entrada`, la píldora y el título con índice 0 y 1, y cada tarjeta con 2 + n.

### D3. Animación propia en SVG y CSS

- **SVG `viewBox="0 0 200 200"`, `aria-hidden`, `w-[78%]`:**
  - a la izquierda, cuatro barras de stock (`rect`, `fill="currentColor"` con `opacity` decreciente, porque el círculo es `on-inverso`);
  - una línea punteada de umbral en `var(--color-acento-inverso)`;
  - a la derecha arriba, una campana (`path`) en `acento-inverso`;
  - a la derecha abajo, una "orden" (`rect` redondeado con dos líneas) en `acento-inverso`.
- **Ciclo de 6 s, `infinite`:**
  - `stock-baja`: las barras bajan con `scaleY` de 1 a 0,35 entre 0 y 40 %, quedan bajas hasta el 75 % y vuelven a 1 al 90 %;
  - `campana`: entre el 38 y el 60 % aparece (`opacity`) y late (`rotate` ±12°);
  - `orden-sale`: entre el 58 y el 80 % entra deslizándose (`translateX` de 24 px a 0, con `opacity`) y desaparece al 95 %.
- **Detalles:** `transform-box: fill-box` y `transform-origin: bottom` para las barras, `center top` para la campana. Las barras arrancan escalonadas, con `animation-delay` de 0,15 s cada una.
- **Clases en `index.css`:** `.anim-stock`, `.anim-campana`, `.anim-orden`.
- **Movimiento reducido:** con `prefers-reduced-motion: reduce` las tres quedan en `animation: none`, y su estado base es el cuadro final legible: barras al 60 % (`transform: scaleY(0.6)`), campana y orden visibles. Así el estado base sin animación también comunica.

### D4. Integración en la portada

- `<FrenteAFrente />` entre el hero y `#servicios`.
- En la `nav aria-label="Secciones"` de la cabecera, el enlace "Antes y después" hacia `#diferencia` va antes de "Servicios", con el mismo estilo que los otros.

### D5. Test

`FrenteAFrente.test.tsx` (vitest con jsdom, render con `@testing-library/react`, como `ui/GraficoLineas.test.tsx`) verifica:
- el `h2` con el título y la sección con `aria-labelledby` apuntando a él;
- dos listas de cinco ítems, con los encabezados `sr-only`;
- el SVG con `aria-hidden="true"`;
- que no haya ningún `src` ni `href` hacia un dominio externo.

## Risks / Trade-offs

- [La animación distrae o marea] → Es lenta (6 s), está en un solo elemento y se apaga con "reducir movimiento". Además es decorativa y el contenido está en las listas.
- [Texto con degradé de bajo contraste] → Es texto grande (≥ 28 px) y los dos colores del degradé superan el 3:1 sobre `bg` en los dos temas (`lib/contraste.test.ts`).
- [El círculo empuja el contenido en el celular] → Mide entre 200 y 320 px y está arriba, como en la referencia. Se revisa a 360 px.

## Migration Plan

Sin migración. El deploy es normal en Vercel y para volver atrás alcanza con revertir el commit.

## Nota posterior

**02/10/2026, `landing-motion`:** a pedido de Franco, las tarjetas de esta sección suman movimiento al pasar el mouse (se elevan) y aparecen desde los costados al hacer scroll; el círculo entra con escala y late. Reemplaza el "sin estados de hover" de D2.
