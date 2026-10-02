## Why

Franco quiere que las pantallas públicas tengan más vida: fondos animados, tarjetas que se mueven y reaccionan al mouse, elementos que aparecen de forma dinámica y efectos al hacer scroll. Pidió recomendaciones de librerías. Se compararon tres:

| Librería | A favor | En contra |
|---|---|---|
| **Motion para React** (ex Framer Motion, v12) | API declarativa pensada para React. Unos 4,6 KB con `LazyMotion` (34 KB el componente completo). Scroll con ScrollTimeline nativo. Respeta "reducir movimiento" con `MotionConfig` | — |
| GSAP + ScrollTrigger | 100 % gratis desde mayo de 2025, también para uso comercial | Imperativa, más pesada |
| anime.js v4 | Modular, con `onScroll` | Imperativa y con menos integración con React |

Franco eligió **Motion**, con una intensidad **llamativa** y para **la portada, el login y el registro**. La app con sesión, donde se trabaja todos los días, queda sin cambios.

Es presentación de las pantallas públicas (RNF-01): no cambia la API ni las reglas de negocio, por eso se declara `skip_specs: true`. Corresponde a la **Fase 2**, después de `web-redesign` y `landing-comparison`.

## What Changes

- **Dependencia `motion` (v12), sólo en las pantallas públicas.** La portada, el login y el registro se cargan con `React.lazy`, así la librería no llega al paquete de la app.
- **Fondo animado:**
  - manchas ámbar, terracota y ciruela difuminadas que derivan lento;
  - una cuadrícula de puntos tenue;
  - en la compu, un foco de luz que sigue al mouse.
- **Apariciones al hacer scroll:**
  - secciones y tarjetas que entran escalonadas (desplazamiento, opacidad y desenfoque);
  - el título del hero se arma palabra por palabra.
- **Tarjetas con movimiento:**
  - se inclinan en 3D siguiendo el mouse, con un brillo que acompaña al cursor;
  - se elevan al pasar el mouse;
  - los íconos reaccionan.
- **Scroll:**
  - una barra de progreso de lectura;
  - parallax en la tarjeta del panel del hero;
  - "Cómo funciona" se ancla en pantalla y va iluminando cada paso, desde 1024 px;
  - la cabecera se compacta al bajar.
- **Detalles:**
  - contadores que suben en la tarjeta del hero;
  - un brillo que cruza el botón principal;
  - un borde con degradé que gira en el plan destacado;
  - "Antes y después" con tarjetas que entran desde los costados y se elevan al pasar el mouse, y el círculo que entra con escala y late.
- **Login y registro:**
  - el mismo fondo animado;
  - el formulario aparece escalonado;
  - el panel ilustrativo se inclina con el mouse;
  - los beneficios aparecen uno por uno.

### Criterios que se mantienen

- **Con "reducir movimiento"** nada se mueve (`MotionConfig reducedMotion="user"` y el bloque CSS). En pantallas táctiles no hay inclinación 3D ni foco que siga al puntero.
- **Sólo se animan `transform` y `opacity`.** El texto queda completo para lectores de pantalla y los elementos decorativos van con `aria-hidden`.
- **Colores:** sólo tokens de ADR 0022, sin colores fijos.
- **Los formularios de login y registro no cambian** en su comportamiento.

### Fuera de alcance

- Animaciones en la app con sesión.
- Animaciones en la app móvil.
- Videos o imágenes de terceros.

## Capabilities

### New Capabilities

Ninguna (`skip_specs: true`).

### Modified Capabilities

Ninguna.

## Impact

- **Web:**
  - `apps/web/package.json` (`motion`);
  - nueva carpeta `features/publico/` con las piezas de animación;
  - `lib/animacion.ts`;
  - `features/landing/LandingPage.tsx` y `FrenteAFrente.tsx`;
  - `features/auth/{LoginPage,RegistroPage,AuthGate}.tsx` y `app/router.tsx` (carga diferida);
  - `index.css` (keyframes y movimiento reducido);
  - `vite.config.ts` y `src/test/setup.ts` (*stubs* para jsdom).
- **Docs:**
  - ADR 0023 "Motion para las pantallas públicas", que acota la regla "sin librerías de animación" de ADR 0012 a la app con sesión;
  - `docs/arquitectura.html` y `openspec/CAPACIDADES.md`.
- **Sin cambios:** API, contrato OpenAPI y app móvil.
