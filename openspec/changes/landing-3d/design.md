## Context

**Cómo carga hoy la portada:**
- `features/landing/LandingPage.tsx` es la portada y se baja con `React.lazy` (`features/publico/carga.tsx`) cuando `AuthGate` no encuentra sesión en `/`.
- Usa Motion 13.5 con `LazyMotion domAnimation strict` (`features/publico/Animado.tsx`) en un chunk diferido de unos 83 KB (29 KB comprimido).
- `apps/web/scripts/verificar-chunks.mjs` corre al final de `pnpm build`, también en el CI y en Vercel. Falla si Motion aparece en `index-*.js`.
- `vite.config.ts` no tiene `manualChunks`.

**Las secciones que tocamos:**
- **Hero:** con `PanelDelHero`, que tiene parallax, `Contador` y `GraficaBarras` con alturas `[38, 52, 46, 64, 58, 76, 70, 88]`.
- **`FrenteAFrente`:** sin cambios.
- **Servicios:** sin cambios.
- **"Cómo funciona":**
  - `ComoFuncionaAnclado` se ancla desde 1024 px y sin movimiento reducido;
  - usa `h-[240vh]`, un panel sticky, `useScroll` y `tramoDePaso()` de `lib/animacion.ts`;
  - `PASOS` tiene hoy 3 entradas.
- **Planes:** sin cambios.

**Reglas vigentes:**
- **ADR 0012:** la app con sesión no lleva librerías de animación.
- **ADR 0022:** sólo tokens, con contraste AA testeado en `lib/contraste.test.ts`. El test acepta sólo `#rrggbb` o `rgba()`.
- **ADR 0023:** Motion sólo en las pantallas públicas. Sólo se animan `transform` y `opacity` más un desenfoque breve al aparecer. Lo decorativo lleva `aria-hidden`. Con puntero táctil no hay efectos que sigan al puntero.
- **ADR 0025:** imágenes generadas, con topes de peso y `ImagenAnimada`, que muestra el PNG con movimiento reducido.

**Tema:** `useTemaActual()` (`lib/tema-actual.ts`) devuelve `'dark' | 'light'` sin aplicar el tema.

**Tests:**
- Vitest con jsdom, sin jest-dom.
- `src/test/setup.ts` da un `IntersectionObserver` que informa todo como visible y un `matchMedia` que siempre devuelve `matches: false`.
- jsdom no tiene WebGL.
- `FrenteAFrente.test.tsx` exige que no haya `src` ni `href` a dominios externos.

La motivación y el alcance están en proposal.md.

## Goals / Non-Goals

**Goals:**
- Tres escenas 3D que cuenten la idea del producto. Que no sumen ni un byte al paquete de la app ni al chunk de la portada antes de hacer falta.
- El LCP sigue siendo el `h1`, y el CLS no supera 0,02.
- Fluido en la compu y aceptable en un Android de gama media. Con movimiento reducido, sin WebGL o con gama baja, se ve una imagen fija equivalente.
- Las decisiones con lógica (modo, disposición, sincronía de pasos, proyección y cinta) quedan en funciones puras con tests.

**Non-Goals:**
- Que la escena sea interactiva: no hay clics sobre objetos 3D ni controles de órbita.
- Postprocesado (bloom o profundidad de campo), sombras reales y texturas de archivo.
- WebGPU.
- Llevar three a otra pantalla.

## Decisions

### D1. three.js puro y un chunk 3D diferido

- **Dependencias:** `three` y `@types/three`, con versión fija al instalar. Los addons se importan de `three/addons/...`: `RoundedBoxGeometry` y, si hace falta, `BufferGeometryUtils`. No se usan r3f ni drei.
- **Por qué no r3f y drei:**
  - **peso:** r3f v9 registra todo el namespace `THREE` y suma su reconciler. Son unos 200 a 230 KB comprimidos, contra 115 a 140 KB de three puro;
  - **acople:** su reconciler va atado a la versión menor de React (19.3);
  - **poco provecho:** las escenas son imperativas de todos modos (matrices de instancias por cuadro), así que lo declarativo casi no se aprovecha.
- **Spike (tarea 1.1, 15/10/2026):** se midieron los dos caminos minificados con esbuild, con lo que usan las escenas (renderer, `InstancedMesh`, `RoundedBoxGeometry`, `ExtrudeGeometry`, `LatheGeometry`, `CatmullRomCurve3`, luces, `CanvasTexture`):

  | Camino | Minificado | Comprimido (gzip -9) |
  |---|---|---|
  | three 0.186.1 puro | 556 KB | 141 KB |
  | @react-three/fiber 9.8.2 + three, sin React | 909 KB | 243 KB |

  r3f 9.8.2 declara `react >=19 <19.4`: hoy funciona con 19.3, pero se rompería al subir de versión menor. Queda **three puro**, fijado en 0.186.1 con `@types/three` 0.186.0.
- **Cómo se divide:**
  - `3d/Lienzo3D.tsx` va en el chunk de la portada y no importa three. Carga cada escena con `import()` a través de `3d/cargar.ts`, un mapa `{ deposito, como, argentina }` que en los tests se reemplaza;
  - Rolldown arma un chunk común con three y el motor, más uno chico por escena;
  - el común se agrupa con nombre estable (`tres-*.js`) desde `vite.config.ts`, con los grupos de chunks de Rolldown que exponga la versión de Vite instalada.
- **Cuándo se carga cada escena:**
  - **hero:** con `requestIdleCallback` después de `load` (timeout de 2,5 s). En el celular, además, con el primer `scroll` o `pointerdown`, o a los 3 s;
  - **"Cómo funciona" y "Argentina":** con un `IntersectionObserver` de `rootMargin: '100% 0px'`.
- **Qué controla `verificar-chunks.mjs`:**
  - firma `/__THREE__|THREE\.WebGLRenderer/`, porque son textos que sobreviven a la minificación;
  - three nunca en `index-*.js` ni en `LandingPage-*.js`;
  - three en exactamente un chunk;
  - ese chunk sin la firma de Motion;
  - al menos un chunk con three;
  - topes comprimidos de 160 KB para el común y 45 KB por escena;
  - una tabla con KB y KB comprimidos.
- *Alternativas descartadas:*
  - **Spline o embeds:** runtime y assets en un CDN.
  - **CSS 3D:** sin instancing, serían cientos de nodos.
  - **OGL:** liviano, pero con poco ecosistema.
  - **Babylon:** más pesado.
  - **WebGPU:** soporte despar en iOS.
  - **Video o WebP pre-renderizado:** no sigue el scroll y pesa más.

### D2. `Lienzo3D`, modos y motor

- **Modos:** `3d/modo.ts` define `decidirModo(entorno)`, una función pura que devuelve `'completo' | 'liviano' | 'imagen'`.
  - **`imagen`** si se cumple alguno:
    - `prefers-reduced-motion`;
    - sin WebGL, o `getContext(..., { failIfMajorPerformanceCaveat: true })` que da null;
    - `navigator.connection.saveData`;
    - `deviceMemory ≤ 2` o `hardwareConcurrency ≤ 2`;
    - `sessionStorage['escenas3d:degradado']`.
  - **`liviano`** si no hay `pointer: fine` o el ancho es menor a 1024 px.
  - **`completo`** en el resto de los casos.
  - `leerEntorno()` y `soportaWebGL()` envuelven las APIs del navegador. `soportaWebGL()` crea un canvas fuera del DOM, pide el contexto y lo libera con `WEBGL_lose_context`, todo protegido contra errores. El movimiento reducido se lee con `useMedia('(prefers-reduced-motion: reduce)')`, que se puede simular en tests, además de `useReducedMotion`.
- **Estados:** `esperando → cargando → activo`. Cualquier error, contexto perdido, chunk que no baja o degradación lleva a `imagen`. Un error boundary local evita que una escena rompa la portada.
- **Motor** (`3d/motor/motor.ts`):
  - **Renderer:**
    - `WebGLRenderer({ alpha: true, antialias: completo, powerPreference: 'low-power' en liviano })`;
    - DPR `min(devicePixelRatio, completo ? 2 : 1.5)`;
    - `outputColorSpace` sRGB y `NoToneMapping`, para que el ámbar se vea fiel;
    - `compileAsync` en idle antes del primer cuadro;
    - fundido de opacidad del canvas con CSS.
  - **Bucle bajo demanda:**
    - `progreso.on('change', invalidar)`;
    - en cada `requestAnimationFrame`, `actual = damp(actual, progreso.get(), 6, dt)`;
    - sigue mientras falte acercarse o `escena.actualizar()` devuelva `true`; si no, se detiene;
    - tope de 60 fps en completo y 30 en liviano.
  - **Pausas:**
    - con un `IntersectionObserver` fuera de pantalla y con `visibilityState === 'hidden'`;
    - a más de 2 viewports se desmonta: primero saca el listener de `webglcontextlost` y después hace `dispose` y `forceContextLoss`. Así quedan como máximo 2 contextos vivos.
  - **Degradación** (`3d/motor/rendimiento.ts`): promedia 60 cuadros. Si pasan 1,5 veces el presupuesto, baja el DPR a 1. Si sigue igual, va a `imagen` y lo recuerda en la sesión.
- **Contrato de escena** (`3d/progreso.ts`):
  - `FuenteDeProgreso { get(): number; on('change', f): () => void }`: un `MotionValue<number>` lo cumple de forma estructural;
  - `Escena { actualizar(progreso, dt): boolean; setPaleta(p); setPuntero?(x, y); dispose() }`;
  - `CrearEscena = (motor, { calidad, paleta }) => Escena`.
  - Cada sección crea su `useScroll` en el DOM y le pasa `scrollYProgress`. Así no hay estado de React por cuadro y Motion no entra en el chunk 3D.
- **Colores** (`3d/colores.ts`):
  - `leerPaleta(tema)` lee `--color-brand`, `brand-2`, `brand-3`, `ok`, `warn`, `crit`, `whatsapp`, `card`, `card-2`, `t3` y `bg` con `getComputedStyle`;
  - si alguno viene vacío usa `RESPALDO[tema]`, porque Tailwind v4 sólo emite las variables que se usan;
  - un test compara `RESPALDO` con `index.css`. El parser de `contraste.test.ts` pasa a ser un helper de test compartido;
  - se vuelve a aplicar cuando cambia `useTemaActual()`.
- **Accesibilidad y layout:**
  - el contenedor y el canvas llevan `aria-hidden="true"`, `tabIndex={-1}` y `pointer-events: none`. Nunca capturan el scroll táctil;
  - el lugar se reserva con `aspect-ratio`;
  - el puntero (sólo en completo) llega por un `pointermove` pasivo sobre `window`, como en `FondoAnimado`.

### D3. Hero "depósito vivo" (`3d/escenas/deposito.ts`)

- **Ubicación:**
  - va detrás de `PanelDelHero`, que pasa a `relative z-10`;
  - el lienzo es `absolute -inset-x-12 -inset-y-10` en la columna derecha;
  - la cámara encuadra la escena corrida hacia arriba y a la derecha, porque el panel tapa cerca del 40 %;
  - en menos de 1024 px es una franja de unos 320 px detrás del panel.
- **Progreso:** `useScroll({ target: heroRef, offset: ['start start', 'end 35%'] })`, que se ajusta en el arnés.
- **Intro:** al montar, las cajas caen escalonadas en 1,2 s.
- **Objetos:**
  - completo: 160 cajas (4 estanterías × 4 niveles × 10) en un `InstancedMesh` con `RoundedBoxGeometry`, más una cinta de embalar instanciada;
  - liviano: 64 cajas con `BoxGeometry`;
  - estructura de parantes y tablas en otro `InstancedMesh`;
  - piso con una `CanvasTexture` de 256² generada (sombra de contacto);
  - entre 3 y 4 draw calls y menos de 40 mil triángulos.
- **Material e iluminación:** `MeshLambertMaterial` con `instanceColor`, `HemisphereLight` y una `DirectionalLight`, sin sombras.
- **Transformación** (`3d/disposicion.ts`, funciones puras):
  - `estanterias`, `barras(n, alturas)` y `curva(n, puntos)` devuelven posición, rotación, escala y color por caja;
  - `repartir(N, pesos)` usa el método del mayor resto, así las columnas suman exactamente N;
  - las barras usan las alturas de `GraficaBarras` y la curva es una Catmull-Rom sobre sus 8 puntos: el 3D "se convierte" en el gráfico del panel. En la curva, las cajas escalan a 0,35, se orientan por la tangente y toman el color `ok`;
  - tramos del progreso:

    | Tramo | Qué pasa |
    |---|---|
    | 0 a 0,1 | quietas |
    | 0,1 a 0,5 | de estanterías a barras |
    | 0,5 a 0,6 | pausa |
    | 0,6 a 0,95 | de barras a curva |

  - `escalonar(t, i, n)` da el retraso por columna, con `easeInOutCubic`. Cada caja viaja en arco (`sin(πt)·alto`), con `slerp` para la rotación y el color interpolado;
  - la estructura se desvanece entre 0,15 y 0,45.
- **Puntero:** sólo en completo, la cámara gira ±5° y se inclina ±3°, con amortiguación.
- **Por cuadro:** se reutilizan `Object3D`, `Matrix4` y `Color`, y `needsUpdate` sólo se marca si algo cambió.

### D4. "Cómo funciona" en 3D (`3d/escenas/comoFunciona.ts`, `3d/pasos3d.ts`)

- **Los cuatro pasos:**

  | Paso | Ícono |
  |---|---|
  | Importá tu planilla | `FileSpreadsheet` |
  | Registrá lo que vendés | `Smartphone` |
  | Te avisa antes de que falte | `BellRing` |
  | Mandá la orden por WhatsApp | `MessageCircle` en `whatsapp` |

  El subtítulo pasa a "Cuatro pasos y el primer día ya tenés el panel." Es la misma historia que la bienvenida de Remotion (ADR 0025).
- **Anclado** (1024 px o más, sin movimiento reducido):
  - el contenedor pasa a `h-[320vh]`;
  - el panel sticky queda en dos columnas: a la izquierda el encabezado, la línea de progreso y los `PasoAnclado` compactos; a la derecha el `Lienzo3D` con `aspect-[4/3]`;
  - los dos reciben el mismo `scrollYProgress`.
- **Sincronía:** `estadoDePaso(p, 4)` se arma sobre `tramoDePaso(i, 4)` y devuelve los pesos de cada paso (0 a 1, con el último encendido al final), el índice y el avance local. Un test asegura que coincide con lo que ilumina la lista.
- **La escena, paso por paso:**
  1. una planilla (plano con una grilla en `CanvasTexture`) se inclina y de sus filas salen 24 cajas que vuelan al estante;
  2. las cajas salen de a una hacia un mostrador con un celular, y el medidor de stock (cilindro, `scale.y`) baja de 24 a 6;
  3. el medidor cruza el anillo del punto de reposición (RN-04) y se tiñe de `warn`; aparece una campana (`LatheGeometry` con un perfil propio) que rebota y un anillo que pulsa 2 veces;
  4. un avión de papel verde `whatsapp`, de 4 triángulos, sale por una curva; el estante se repone y el medidor vuelve a `ok`. No se usa el logo de WhatsApp, que es una marca.
- **Celular:**
  - en liviano, el lienzo va `sticky top-16 h-56` arriba de la lista, con `useScroll({ target: listaRef, offset: ['start 60%', 'end 60%'] })` y el 40 % de los objetos;
  - en imagen, la lista de siempre más el PNG del paso 4.

### D5. "Hecho para Argentina" (`HechoParaArgentina.tsx`, `3d/escenas/argentina.ts`, `herramientas/mapas/`)

- **Ubicación:** entre "Cómo funciona" y "Planes", con `id="argentina"` y `scroll-mt-14`. Se suma "Argentina" a la navegación.
- **Texto en el DOM:**
  - el `h2`;
  - cuatro puntos: precios netos de IVA (21 % por defecto y configurable, RN-03), tus precios frente al IPC (HU-15), órdenes por WhatsApp (HU-16) y la frase de los comercios relevados;
  - la leyenda visible de las ciudades;
  - el texto de la cinta.
- **Mapa:**
  - `Shape` con huecos a partir de los anillos proyectados (`3d/proyeccion.ts`), con `ExtrudeGeometry` de bisel mínimo;
  - la cara superior en `card-2` mezclado con `brand` y los laterales oscurecidos;
  - Malvinas, Isla de los Estados y Tierra del Fuego forman parte del mismo grupo;
  - un recuadro con proyección polar muestra el sector antártico (de 74° O a 25° O y de 60° S al polo), las Georgias del Sur y las Sandwich del Sur, como en el mapa bicontinental;
  - con el scroll, la extrusión crece y la cámara pasa de vista cenital a 3/4, con un giro de 12° como máximo.
- **Ciudades:** AMBA, Córdoba, Rosario y Mendoza, como conos y esferas instanciados que caen en secuencia, con un anillo que pulsa 3 veces y se detiene.
- **Cinta:**
  - `3d/datos/inflacionEjemplo.ts` tiene 12 meses fijos de ejemplo, verosímiles pero inventados, con tus precios atrasados;
  - se acumulan con `indiceBase100` de `@inventariosmart/shared`;
  - `3d/cinta.ts` arma una tira con ancho en profundidad: el IPC en `warn`, tus precios en `brand` y el atraso en una franja `crit` translúcida;
  - se dibuja con `setDrawRange`;
  - la frase sale de `variacionReal` (RN-11) y `formatearVariacion` (`lib/inflacion-formato.ts`), con la etiqueta visible "Datos de ejemplo". No se llama a la API.
- **Contorno** (`herramientas/mapas/generar-argentina.mjs`): va fuera del workspace, como `visuales`, con `polygon-clipping` (MIT) y `fuente/` en `.gitignore`. Hace lo siguiente:
  1. baja una sola vez Natural Earth 1:10m (dominio público) en un tag fijo y verifica el SHA-256;
  2. usa la vista de país de Argentina si incluye las islas del Atlántico Sur; si no, une ARG, FLK y SGS;
  3. recorta la Antártida a su sector;
  4. simplifica a unos 900 puntos en el continente, con una lista blanca para Soledad, Gran Malvina e Isla de los Estados;
  5. redondea a 0,01° y guarda lon/lat; la única proyección está en `proyeccion.ts`;
  6. antes de escribir valida que (−59; −51,7) caiga dentro, que (−70,65; −33,45), Santiago de Chile, caiga fuera, y que Ushuaia caiga dentro;
  7. escribe `3d/datos/argentina.ts`, con una cabecera que indica fuente, versión, licencia, Ley 26.651 y "no editar", y lo formatea con Prettier.
- **La frase de los comercios:** la ficha técnica de `Encuesta_InventarioSmart_v2.xlsx` lo confirma (tarea 2.3): n = 24, del 11 al 17/03/2026, 18 respuestas de AMBA y 2 de cada una de Córdoba Capital, Rosario y Mendoza. La portada lo cita así.

### D6. Más movimiento sin 3D

Se hace con `m.*` o CSS, animando sólo `transform` y `opacity`. Con movimiento reducido, todo queda quieto.

1. **Botón magnético** (`features/publico/BotonMagnetico.tsx`):
   - va en "Crear cuenta gratis", en el CTA de la cabecera y en el plan destacado;
   - `useSpring` sobre x e y hasta 6 px, dentro de un radio de 80 px;
   - la función pura `atraccion(px, py, rect, radio, max)` va en `lib/animacion.ts`;
   - sólo funciona con `pointer: fine`.
2. **Marquesina de rubros** bajo el hero:
   - `x = useTransform(scrollY, …)`: no se mueve sola, así que no necesita un control de pausa (WCAG 2.2.2);
   - la lista aparece una vez para lectores de pantalla y la copia va con `aria-hidden`;
   - con movimiento reducido queda quieta y en varias líneas.
3. **Subrayado** bajo "números reales": `m.path` con `pathLength` de 0 a 1 al montar, `aria-hidden`.
4. **Indicador de sección activa** en la navegación:
   - es una píldora que se mueve con `x` y `scaleX` según la sección visible;
   - no usa `layoutId`, porque pide `domMax`.

### D7. Imagen fija de respaldo

- **Página de captura:**
  - `apps/web/captura.html` y `3d/captura.tsx` sólo existen en desarrollo: Vite construye únicamente `index.html`. Se verifica que no aparezcan en `dist/`;
  - leen `?escena=…&tema=…&progreso=…&calidad=…`, fijan `data-theme` y crean la escena con `preserveDrawingBuffer` y fondo transparente;
  - cuando terminan, ponen `window.__escenaLista = true`.
- **Exportador:** `herramientas/visuales/exportar.mjs` suma piezas `con: 'escena3d'`:

  | Pieza | Estado capturado | Tope |
  |---|---|---|
  | `escena-deposito` | progreso 0,5 (barras) | 150 KB |
  | `escena-como` | paso 4 | 120 KB |
  | `escena-argentina` | estado final | 120 KB |

  - levanta `vite` en el puerto 5174 y abre Chrome sin ventana con `puppeteer-core` (declarado con versión fija), `--use-angle=swiftshader` y `deviceScaleFactor: 2`;
  - captura el elemento con `omitBackground` y comprime con `sharp`, que ya está en el taller;
  - escribe `public/animaciones/escena-<nombre>-<claro|oscuro>.png` y actualiza `manifiesto.json`. Si una pieza pasa su tope, no copia nada;
  - el render también sirve de prueba de humo: si una escena tira error, el exportador falla.
- `Lienzo3D` reutiliza `rutaAnimacion()` de `ui/ImagenAnimada.tsx`. La imagen va con `alt=""`, `aria-hidden`, medidas fijas, `decoding="async"` y `fetchpriority="low"`.

### D8. Tests

- **Funciones puras:**
  - `decidirModo`, con una tabla de casos;
  - `repartir`, que debe sumar N;
  - `disposicion` en t = 0 y t = 1, conservando la cantidad;
  - `escalonar`, monótona y acotada;
  - `estadoDePaso` contra `tramoDePaso`;
  - `proyeccion`: el norte queda arriba y AMBA al este de Mendoza;
  - `cinta`: cantidad de vértices e índices;
  - `atraccion`;
  - la frase de RN-11.
- **Datos del mapa:** Malvinas adentro, Santiago de Chile afuera, Ushuaia adentro, el sector antártico en su cuña y una cantidad de puntos acotada.
- **`colores.test`:** `RESPALDO` coincide con `index.css` en los dos temas.
- **`Lienzo3D.test`** (con `cargar` mockeado y `modo` mockeado en parte):
  - sin WebGL o con movimiento reducido muestra la imagen del tema, y cambia a `-claro` cuando cambia `data-theme`;
  - en esos dos casos no llama a `cargar`;
  - con WebGL, carga la escena;
  - si la carga falla, muestra la imagen;
  - el contenedor va siempre con `aria-hidden`.
- **`LandingPage.test`:**
  - mockea `3d/cargar` con una promesa que nunca resuelve, así three no se importa;
  - verifica el `h1`, los 4 pasos, la región "Hecho para Argentina" con sus 4 ciudades, "Datos de ejemplo" y que no haya `src` ni `href` externos en toda la portada.
- **Cómo se corren:** las comparaciones van por `textContent` y `getAttribute`. Se corren también sin `.env`, como en el CI.

### D9. Accesibilidad y rendimiento

- **LCP:**
  - en los modos 3D no hay imagen provisoria: hasta que llega el canvas se ven el fondo y el panel;
  - en modo imagen, la caja del PNG del hero tiene que ser menor que el bloque del `h1`, para que no le gane el LCP;
  - se mide con Lighthouse sobre `vite preview`, en celular y compu, antes y después.
  - **Medición del 16/10/2026** (Lighthouse 13.5.0, sólo rendimiento). "Antes" es la producción de Vercel y "después", el build local con `vite preview`, así que los números de red no son comparables uno a uno:

    | | Performance | LCP | CLS | TBT | Elemento LCP |
    |---|---|---|---|---|---|
    | Celular, antes | 58 | 6,3 s | 0,132 | 0 ms | párrafo del hero |
    | Celular, después | 74 | 5,5 s | 0,003 | 31 ms | párrafo del hero |
    | Compu, antes | 98 | 0,87 s | 0,001 | 0 ms | — |
    | Compu, después | 99 | 0,88 s | 0,014 | 55 ms | `h1` del hero |

    En los dos casos el LCP es texto del hero: el `h1` en la compu y el párrafo en el celular (igual que antes). La escena nunca lo toma. CLS ≤ 0,02, el TBT sube menos de 100 ms y la nota en el celular no baja.
  - Aceptación:
    - LCP = `h1`;
    - CLS ≤ 0,02;
    - Performance en celular baja 5 puntos como máximo;
    - TBT sube 100 ms como máximo.
- **Presupuesto por escena:**

  | | Completo | Liviano |
  |---|---|---|
  | Draw calls | ≤ 6 | ≤ 5 |
  | Triángulos | < 60 mil | < 15 mil |
  | Actualización por cuadro | ≤ 2 ms | ≤ 2 ms |

  Las texturas son sólo generadas, de 256² como máximo.
- **Mareo:**
  - el movimiento lo maneja el scroll;
  - los giros de cámara son de 12° como máximo, sin zoom brusco ni giros continuos;
  - lo que se mueve solo (la intro y los pulsos) termina en menos de 5 s.

### D10. ADR 0026

**"Escenas 3D de la portada con three.js, diferidas y con imagen fija"**. Registra:
- el stack, con las alternativas de D1;
- los tres modos y sus reglas;
- los chunks y sus topes;
- el contrato de escena;
- el respaldo generado;
- el mapa, con la Ley 26.651 y Natural Earth en dominio público;
- las licencias de three, sus addons y `polygon-clipping` (MIT), y de `puppeteer` y `sharp` (Apache-2.0);
- la regla de no usar fuentes, modelos, HDR ni logos de terceros.

ADR 0023 suma la línea "Completada por ADR 0026".

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| Peso: unos 140 KB comprimidos más | Chunk diferido en idle o por cercanía, sólo para quien visita la portada con WebGL. Topes que hacen fallar el build. Con ahorro de datos, imagen fija. |
| Mareo | El scroll lo controla el usuario, con giros chicos y animaciones que terminan. Con movimiento reducido, imagen fija. |
| Batería y calor en el celular | Bucle bajo demanda a 30 fps, pausa fuera de pantalla y con la pestaña oculta, desmontaje lejos y degradación automática. |
| Safari/iOS: 30 fps en bajo consumo, contexto que se pierde por memoria | DPR ≤ 1,5 y como máximo 2 contextos. Si se pierde el contexto, imagen fija. Prueba en un iPhone real. |
| `forceContextLoss` al desmontar se confunde con una pérdida real | Sacar el listener antes de forzarlo. |
| El PNG del hero se vuelve el LCP | Caja más chica que el `h1` y medición con Lighthouse. |
| Mapa mal resuelto: islas perdidas por la simplificación o Malvinas fuera | Lista blanca de islas, tests de punto en polígono y revisión visual en el arnés. |
| Que una cifra de ejemplo se lea como real | Etiqueta visible "Datos de ejemplo" y sin cifras del INDEC. |
| Variables de Tailwind que no se emiten | `RESPALDO` con un test espejo de `index.css`. |
| Archivo generado y Prettier en el CI | El generador lo formatea. |
| jsdom registra `getContext` como no implementado | `soportaWebGL` se mockea en los tests. |

## Migration Plan

- **Deploy:** se publica como siempre, con un push a `main`: Vercel y el CI corren `pnpm build`, que incluye `verificar-chunks`.
- **Rollback:**
  - revertir el commit;
  - como alternativa rápida, que `decidirModo` devuelva `imagen` para todos. La portada queda con las imágenes fijas sin tocar el resto.
