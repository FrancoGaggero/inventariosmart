## Context

- Las pantallas públicas son `features/landing/LandingPage.tsx` (que renderiza `AuthGate` en `/` sin sesión), `features/auth/LoginPage.tsx` y `RegistroPage.tsx`.
- No hay *code splitting*: `AuthGate` importa `LandingPage` directo y el router importa `LoginPage` y `RegistroPage`.
- **Movimiento actual:** CSS puro (`.entra`, `.pulso`, `.trazo`, `.anim-*`) con su bloque de `prefers-reduced-motion`.
- **ADR 0012** decidió no usar librerías de animación, y ADR 0022 definió los tokens.
- **Tests de la web:** vitest con jsdom, que no tiene `IntersectionObserver`.

Motivación y elección de la librería: ver proposal.md.

## Goals / Non-Goals

**Goals:**
- Movimiento llamativo en las tres pantallas públicas sin sumar peso al paquete de la app.
- Que todo quede quieto con "reducir movimiento" y fluido en celulares (sólo `transform` y `opacity`).

**Non-Goals:**
- Animar la app con sesión.
- Usar `layout` animations, `drag` ni las features de `domMax`.

## Decisions

### D1. Motion con `LazyMotion` y carga diferida

- **Dependencia y uso:**
  - `motion` (se instaló la 13.5.0, la versión vigente al aplicar la change), importado siempre desde `motion/react`, con `m` en lugar de `motion`;
  - `features/publico/Animado.tsx` envuelve con `<LazyMotion features={domAnimation} strict>` y `<MotionConfig reducedMotion="user">`;
  - `strict` hace fallar en desarrollo si alguien usa `motion.div`, que arrastraría el bundle completo.
- **Carga diferida:**
  - `AuthGate` renderiza `<Suspense fallback={<FondoLiso/>}><LandingPublica/></Suspense>`, con `LandingPublica = lazy(() => import('@/features/landing/LandingPage'))`;
  - el router hace lo mismo con `/login` y `/registro`;
  - las tres páginas exportan `default`, además del export con nombre que ya usan los tests y el arnés.
- **Verificación:** después de `vite build`, un script de la tarea de verificación (`apps/web/scripts/verificar-chunks.mjs`) busca la firma de motion (`motion/react` o `MotionConfig`) en `dist/assets/*.js`. Falla si aparece en el chunk `index-*.js`, que es el de la app.
- **Tamaños medidos (task 4.1):**

  | | Antes | Después |
  |---|---|---|
  | Paquete de la app (`index-*.js`) | 929 KB (261 KB comprimido), con las pantallas públicas adentro | 908 KB (256 KB comprimido), sin cambios por Motion |
  | Pantallas públicas | — | `LandingPage` 39 KB, `LoginPage` 6 KB y `RegistroPage` 3 KB, más el chunk compartido con Motion de 83 KB (29 KB comprimido) |

  El chunk de Motion es más grande que los ~5 KB de `m` solo, porque incluye `domAnimation`, `animate`, `useScroll` y los hooks de valores. Igual se descarga sólo al entrar a una pantalla pública. El script corre al final de `pnpm build` (`apps/web/package.json`), así que el CI y Vercel lo verifican en cada build.
- *Alternativa:* cargar Motion siempre. Se descarta: unos 30 KB más para todos los usuarios de la app, que no lo usan.

### D2. Piezas en `features/publico/`

| Pieza | Qué hace | Cómo |
|---|---|---|
| `FondoAnimado` | Manchas que derivan, cuadrícula y foco que sigue al mouse | 3 `div` `blur-3xl` con `color-mix(var(--color-brand / warn / violet) 30%)` y keyframes CSS `deriva-1..3` (18-30 s); cuadrícula con `radial-gradient` y `mask-image`; foco con `useMotionValue` + `useSpring` sólo con `(pointer: fine)` y sin movimiento reducido; `fixed inset-0 -z-10 pointer-events-none aria-hidden` |
| `Revelar` / `Escalonado` | Aparición al entrar en pantalla | `m.div` con variants `{ oculto: { opacity: 0, y: 32, filter: 'blur(6px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)' } }`, `whileInView="visible"`, `viewport={{ once: true, amount: 0.25 }}`; `Escalonado` con `staggerChildren: 0.08`; prop `desde: 'abajo' \| 'izquierda' \| 'derecha'` |
| `TextoQueSeArma` | Título palabra por palabra | `palabras(texto)` de `lib/animacion.ts`; cada palabra en un `m.span` con `y: '0.6em'`, `rotateX: 40` y opacidad, escalonado 0,06 s; el contenedor con `aria-label={texto}` y las palabras con `aria-hidden`; admite un fragmento con clase (`acento-serif`) |
| `TarjetaInclinable` | Inclinación 3D y brillo | `onPointerMove` usa `inclinacion(px, py, rect, 8)` para `rotateX/rotateY` con `useSpring`; `--brillo-x/--brillo-y` para un `radial-gradient` de `brand` al 18 % encima; `whileHover={{ y: -6 }}`; sin efecto con `pointer: coarse` o movimiento reducido (`useReducedMotion`) |
| `Contador` | Número que sube | `useInView` y `animate(0, valor, { duration: 1.4 })` con `onUpdate` formateado con `Intl` es-AR; con movimiento reducido, el valor final; `aria-label` con el valor final, como `MontoAnimado` del panel |
| `BarraDeProgreso` | Progreso de lectura | `useScroll().scrollYProgress` → `scaleX` con `useSpring`; `fixed top-14 inset-x-0 h-0.5 bg-brand origin-left z-30` |
| `ComoFuncionaAnclado` | Pasos que se iluminan con el scroll | desde `lg` y sin movimiento reducido: un contenedor de `h-[300vh]`, un panel `sticky top-20` y `useScroll({ target, offset: ['start start', 'end end'] })`; cada paso `i` toma opacidad 0,35 a 1 y `x` 0 a 12 según el tramo `[i/3, (i+1)/3]`, con una línea de progreso vertical; en otro caso, la lista actual con `Escalonado` |

`lib/animacion.ts` (puro):
- `palabras(texto)`: separa por espacios y conserva la puntuación pegada;
- `inclinacion(px, py, rect, max)`: `{ rotateX, rotateY }` con 0 en el centro, ±max en los bordes y acotado fuera del rectángulo;
- `useMedia(query)` queda en un hook aparte, en `features/publico/`.

### D3. Aplicación en la portada

- **Página:** `Animado` y `FondoAnimado` envuelven toda la página, y `BarraDeProgreso` va debajo de la cabecera.
- **Cabecera:** `useScroll` + `useMotionValueEvent`; pasados 24 px, el fondo pasa de `bg-bg-2/60` a `bg-bg-2/90` con `shadow-1`.
- **Hero:**
  - `TextoQueSeArma` en el `h1`, con "números reales" en serif;
  - `Escalonado` para el párrafo, los botones y la nota;
  - `.btn-brillo` en el botón primario, con un pseudo-elemento que cruza cada 4 s;
  - la tarjeta del panel con `TarjetaInclinable` y, en un `m.div`, `useScroll({ target, offset: ['start end', 'end start'] })` + `useTransform` para `y` (0 a −60) y `rotate` (0 a −2°);
  - `Contador` para "$ 1.451.652" y "38,4 %";
  - las barras de `GraficaBarras` con `whileInView`, porque hoy tienen `entra`;
  - las líneas de alerta y orden con `Revelar desde="derecha"`.
- **`FrenteAFrente`:**
  - `Revelar desde="izquierda"` y `desde="derecha"` en cada lista, escalonado;
  - el círculo con `initial={{ scale: 0.8, opacity: 0 }}` → `whileInView`, y un latido CSS suave (`latido`, 4 s);
  - las tarjetas con `whileHover={{ y: -4 }}`. Franco ahora pide hovers, y se anota en el design de `landing-comparison`.
- **Servicios:** `Escalonado` con `TarjetaInclinable`; el ícono con `whileHover={{ rotate: -8, scale: 1.1 }}` del padre, vía variants.
- **"Cómo funciona":** `ComoFuncionaAnclado` con `PASOS`.
- **Planes:**
  - `Escalonado`;
  - la tarjeta destacada con `.borde-giratorio`: `@property --angulo` y un `conic-gradient(from var(--angulo), var(--color-brand), transparent 30%, var(--color-warn), transparent 70%, var(--color-brand))` como borde con máscara, girando cada 6 s;
  - `whileHover={{ y: -8 }}`.

### D4. Login y registro

- **`LoginPage`:**
  - `Animado` y `FondoAnimado`;
  - el bloque del formulario con `Escalonado` (logo, título, campos y botones), en el mismo orden;
  - el panel invertido con `TarjetaInclinable` (máximo 4°, porque es grande) y `Escalonado` para los beneficios;
  - el `Logo` sin cambios.
- **`RegistroPage`:** `Animado`, `FondoAnimado` y la tarjeta con `Revelar`.
- **No se tocan** los manejadores, las validaciones ni el orden de tabulación.

### D5. CSS

- Nuevo en `index.css`:
  - `@keyframes deriva-1`, `deriva-2` y `deriva-3` (`translate` y `scale`);
  - `@keyframes latido` (escala de 1 a 1,03);
  - `@keyframes brillo-boton`;
  - `@property --angulo { syntax: '<angle>'; inherits: false; initial-value: 0deg }` y `@keyframes girar-borde`;
  - las clases `.mancha-1..3`, `.btn-brillo`, `.borde-giratorio` y `.latido`.
- Todas entran al bloque de `prefers-reduced-motion` con `animation: none`.

### D6. Tests

- `src/test/setup.ts` en `test.setupFiles`:
  - un `IntersectionObserver` *stub* que llama al callback con `isIntersecting: true`, para que `whileInView` muestre el contenido en jsdom;
  - `matchMedia` con `matches: false`.
- `lib/animacion.test.ts`: `palabras` e `inclinacion` (centro, bordes, fuera del rectángulo).
- `publico/TextoQueSeArma.test.tsx`: `aria-label` con el texto completo, palabras con `aria-hidden` y el fragmento serif presente.
- `FrenteAFrente.test.tsx` y el resto siguen pasando.

### D7. ADR 0023

"Motion para las pantallas públicas":
- la comparación de librerías;
- la carga diferida;
- la regla vigente: la app con sesión sigue sin librería de animación (ADR 0012), y las pantallas públicas usan Motion con `LazyMotion` y `m`;
- los criterios de movimiento reducido y de pantallas táctiles.

## Risks / Trade-offs

- [Mareo o distracción por la intensidad llamativa] → Todo se apaga con "reducir movimiento". Los movimientos son de 0,4 a 1,4 s con resortes amortiguados. El texto nunca se mueve después de aparecer.
- [Fluidez en celulares de gama baja] → Sólo `transform` y `opacity` (el `filter: blur` va sólo en la aparición, una vez). Sin inclinación ni foco en pantallas táctiles. `viewport.once`.
- [El anclado de "Cómo funciona" hace la página más larga] → Sólo desde `lg`. En el celular, la lista normal.
- [Contenido invisible si falla la observación] → El *stub* de los tests lo cubre, y con movimiento reducido el estado inicial ya es visible (`MotionConfig` lo maneja).
- [Primera carga de la portada con un chunk más] → El respaldo de `Suspense` es el fondo liso del tema, sin parpadeo de contenido.

## Migration Plan

Sin migración. El deploy es normal en Vercel. Para volver atrás alcanza con revertir el commit; la dependencia sale con él.
