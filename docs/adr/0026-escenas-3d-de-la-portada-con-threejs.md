# ADR 0026 · Escenas 3D de la portada con three.js, diferidas y con imagen fija

**Estado:** aceptada · 16/10/2026. Completa ADR 0023 para la portada pública. Change `landing-3d`.

## Contexto

Franco quiso darle más vida a la portada con varios elementos 3D:

- el hero "depósito vivo";
- "Cómo funciona" en 3D;
- una sección "Hecho para Argentina" con mapa;
- 3D liviano también en el celular.

Las decisiones vigentes ya marcaban límites:

- **ADR 0012:** la app con sesión no lleva librerías de animación.
- **ADR 0023:** Motion sólo en las pantallas públicas y en un chunk diferido, y siempre con salida para "reducir movimiento".
- **ADR 0025:** las animaciones de la app son imágenes generadas, con topes de peso.

Ningún ADR preveía WebGL.

## Decisión

1. **three.js puro, versión fija (0.186.1), sólo en la portada.** Nunca en la app con sesión, en el login ni en el registro. Se midió en el build real (tarea 1.1):

   | Opción                                        | Peso comprimido |
   | --------------------------------------------- | --------------- |
   | three puro                                    | 141 KB          |
   | @react-three/fiber 9.8.2 con three, sin React | 243 KB          |

   Además, r3f declara `react <19.4`. Las escenas son imperativas (matrices de instancias por cuadro), así que lo declarativo casi no se aprovecharía.

2. **Chunks.**
   - `Lienzo3D` no importa three: cada escena se baja con `import()` desde `3d/cargar.ts`.
   - three y el motor quedan en un chunk `tres-*.js`; cada escena, en uno chico.
   - El hero se carga en idle después de `load`, o al primer gesto en el celular. Las otras dos escenas, cuando la sección se acerca.
   - `scripts/verificar-chunks.mjs` corre en cada `pnpm build`. Busca la firma `__THREE__|THREE.WebGLRenderer` y falla si:
     - three se puede alcanzar con importaciones estáticas desde `index-*` o `LandingPage-*`;
     - three aparece en más de un chunk o junto con Motion;
     - el chunk común pasa los 160 KB comprimidos o una escena pasa los 45 KB.
   - Hoy pesan:

     | Chunk                  | Comprimido |
     | ---------------------- | ---------- |
     | `tres-*.js`            | 140 KB     |
     | Depósito               | 1,5 KB     |
     | "Cómo funciona"        | 2,4 KB     |
     | Argentina, con el mapa | 10,8 KB    |

3. **Tres modos.** La función pura `decidirModo` elige uno según el dispositivo:
   - **Imagen fija:**
     - con "reducir movimiento", sin WebGL o con advertencia de rendimiento;
     - con ahorro de datos, 2 GB de memoria o 2 núcleos o menos;
     - o si la escena ya se degradó en la sesión.
   - **Liviano:** puntero no fino o menos de 1024 px. Usa menos objetos, DPR de 1,5 como máximo y 30 cuadros por segundo, y no sigue el dedo.
   - **Completo:** el resto.

   El motor dibuja bajo demanda y se pausa fuera de pantalla y con la pestaña oculta. Libera el contexto cuando la sección queda a más de dos pantallas, así nunca hay más de dos contextos vivos. Pasa a la imagen fija si:
   - se pierde el contexto;
   - falla el chunk;
   - los cuadros siguen lentos después de bajar la resolución.

4. **Contrato de escena.**
   - Cada escena recibe el avance del scroll por `FuenteDeProgreso`, que un `MotionValue` ya cumple. No hay estado de React por cuadro y Motion no entra en el chunk 3D.
   - Los colores salen de los tokens del tema (ADR 0022), con un respaldo igual a `index.css` que un test vigila.
   - Las decisiones con lógica son funciones puras con tests: modo, disposición de las cajas, sincronía de pasos con `tramoDePaso`, proyección del mapa y cinta.

5. **Imagen fija generada de la misma escena.**
   - `apps/web/captura.html` sólo existe en desarrollo y Vite no la publica.
   - `herramientas/visuales/exportar.mjs` la abre con Chrome sin ventana y SwiftShader, que es render por CPU y da el mismo resultado en cualquier máquina. Genera un PNG por escena y tema en `public/animaciones/`.
   - Topes: 150 KB para el hero y 120 KB para las otras. Hoy pesan entre 14 y 33 KB.

6. **Mapa.**
   - Natural Earth 1:10m, vista de país de Argentina, v5.1.2, de dominio público.
   - Incluye las Islas Malvinas, Georgias del Sur y Sandwich del Sur como territorio argentino, y el sector antártico (74° O a 25° O) en un recuadro, como el mapa bicontinental de la Ley 26.651.
   - `herramientas/mapas/generar-argentina.mjs` lo baja verificando su SHA-256, lo simplifica, valida puntos (Malvinas y Ushuaia adentro, Santiago de Chile afuera) y lo embebe como datos locales. La portada no pide nada a otros dominios.

7. **Accesibilidad.**
   - Los lienzos y las imágenes van con `aria-hidden` y `pointer-events: none`. Lo que importa está en el texto: el título, los pasos, las ciudades de la encuesta y la frase de la cinta, rotulada "Datos de ejemplo".
   - El LCP sigue siendo texto del hero: el `h1` en la compu y el párrafo en el celular (Lighthouse 13.5.0, 16/10/2026).
   - En compu el hero queda anclado unos 75vh mientras las cajas se transforman; con "reducir movimiento", no.

8. **Sin recursos de terceros.** No se usan fuentes 3D, modelos, HDR ni logos: el envío por WhatsApp se representa con un avión de papel genérico.

## Alternativas consideradas

- **@react-three/fiber + drei:** 100 KB comprimidos más y el reconciler atado a la versión menor de React.
- **Spline u otros embeds:** runtime y assets en un CDN externo.
- **Modelos GLB de terceros:** licencias y peso.
- **CSS 3D:** sin instancing, serían cientos de nodos DOM.
- **OGL:** liviano, con poco ecosistema.
- **Babylon.js:** más pesado.
- **WebGPU:** soporte despar en iOS.
- **Video o WebP pre-renderizado:** no sigue el scroll y pesa más que la escena.

## Consecuencias

- Quien visita la portada con WebGL baja unos 155 KB comprimidos más, en diferido. La app con sesión no cambia: su paquete bajó de 908 a 888 KB porque la portada se separó mejor.
- Las escenas no se pueden probar en jsdom. Las cubren las funciones puras, el test de `Lienzo3D` (modos y respaldo) y la página de captura, que también funciona como prueba de humo.
- Si cambia la paleta, una escena o el mapa, hay que regenerar las imágenes fijas con `node herramientas/visuales/exportar.mjs escena-deposito escena-como escena-argentina`.
- Dependencias nuevas:
  - `three` y `@types/three` en la web;
  - `polygon-clipping` en `herramientas/mapas`;
  - `puppeteer-core` y `sharp` declarados en `herramientas/visuales`, donde ya estaban como transitivas.

  Las cuatro son MIT o Apache-2.0.
