# ADR 0023 · Motion para las pantallas públicas

**Estado:** aceptada · 02/10/2026. Acota la regla "sin librerías de animación" de ADR 0012 a la app con sesión.

## Contexto

Franco quiso más vida en la portada, el login y el registro: fondos animados, tarjetas que se mueven y reaccionan al mouse, apariciones dinámicas y efectos al hacer scroll, con una intensidad llamativa. ADR 0012 había resuelto todo el movimiento con CSS y sin librerías. Para efectos que dependen del scroll y del puntero, como el parallax, el anclado, la inclinación 3D o los resortes, el CSS solo se queda corto o termina en mucho código a mano. Además, hasta ahora la web no separaba en chunks: todo viajaba en un único paquete.

## Decisión

1. **Motion para React** (paquete `motion`, ex Framer Motion; se instaló la 13.5.0) en las pantallas públicas. Se importa siempre desde `motion/react`, con `LazyMotion features={domAnimation} strict` y el componente `m`. `strict` impide usar `motion.div`, que arrastra el bundle completo.
2. **Carga diferida.** La portada (desde `AuthGate`) y el login y el registro (desde el router) se cargan con `React.lazy` y `Suspense` (`features/publico/carga.tsx`). Motion viaja en un chunk propio de unos 83 KB (29 KB comprimido) que sólo se descarga al entrar a una pantalla pública. El paquete de la app no cambia.
3. **Control en el build.** `scripts/verificar-chunks.mjs` corre al final de `pnpm build` y falla si la firma de Motion aparece en `index-*.js`.
4. **Piezas reutilizables** en `features/publico/`:
   - `FondoAnimado`, `Revelar`, `Escalonado` e `Item`;
   - `TextoQueSeArma`, `TarjetaInclinable` y `Contador`;
   - `BarraDeProgreso` y `ComoFuncionaAnclado`.

   Los cálculos (palabras y puntuación, inclinación, tramos del scroll) son funciones puras en `lib/animacion.ts`, con tests.

5. **Accesibilidad y fluidez:**
   - `MotionConfig reducedMotion="user"` y el bloque CSS de `prefers-reduced-motion` dejan todo quieto, y las piezas que se mueven con el puntero o el scroll consultan `useReducedMotion`;
   - en pantallas táctiles (`pointer: coarse`) no hay inclinación 3D ni foco que siga al puntero, y el anclado sólo existe desde 1024 px;
   - sólo se animan `transform`, `opacity` y un desenfoque breve al aparecer;
   - el texto animado conserva su lectura completa en `aria-label`, y lo decorativo va con `aria-hidden`.
6. **La app con sesión sigue sin librería de animación** (ADR 0012): ahí se trabaja todos los días y conviene que sea liviana y quieta.

## Alternativas consideradas

- **GSAP + ScrollTrigger:** la más potente para secuencias coreografiadas y 100 % gratis desde 2025. Es imperativa (timelines y refs dentro de efectos) y pesa más. Para animaciones ligadas a componentes de React, Motion es más directa.
- **anime.js v4:** liviana, modular y con `onScroll`. También es imperativa, y el montaje, la limpieza y el movimiento reducido quedan a cargo propio.
- **Seguir sólo con CSS:** alcanza para las manchas del fondo, el latido y el borde giratorio, que quedaron en CSS. No alcanza para el parallax, el anclado con pasos, la inclinación con resorte ni los contadores.
- **Cargar Motion en toda la web:** unos 80 KB más para todos los usuarios de la app, que no lo usan.

## Consecuencias

- Las pantallas públicas suman un chunk de 83 KB. La primera visita a la portada tarda un poco más en tener movimiento, y mientras tanto se ve el fondo del tema.
- Los tests de la web necesitan _stubs_ de `IntersectionObserver` y `matchMedia` (`src/test/setup.ts`), porque jsdom no los trae.
- Con la pestaña en segundo plano el navegador pausa los cuadros, así que el contenido aparece cuando el usuario vuelve. Es el comportamiento estándar.
