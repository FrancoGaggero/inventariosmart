## Why

Franco quiere que la portada pública tenga todavía más vida, con varios elementos 3D y más movimiento, para mostrar en pocos segundos la idea del producto: el inventario se convierte en números y el sistema avisa antes del problema. Eligió tres escenas con three.js:
- el hero "depósito vivo";
- "Cómo funciona" en 3D;
- una sección nueva "Hecho para Argentina".

Además pidió que el celular también tenga 3D, en una versión liviana.

Es presentación de la portada (RNF-01, RNF-08): no cambia la API ni las reglas de negocio, por eso se declara `skip_specs: true`. Corresponde a la **Fase 2**, después de `web-redesign`, `landing-comparison` y `landing-motion`.

## What Changes

- **Dependencia `three`, sólo en la portada y en un chunk propio.** Se baja en idle o cuando la sección se acerca; nunca entra en el paquete de la app, del login ni del registro. `verificar-chunks.mjs` lo controla y pone topes de peso.
- **Hero "depósito vivo":**
  - estanterías con cajas 3D detrás del panel actual;
  - con el scroll, las cajas vuelan y se reordenan en el gráfico de barras del panel y después en la curva de margen;
  - en la compu, la cámara acompaña levemente al mouse.
- **"Cómo funciona" en 3D:**
  - pasa de tres a **cuatro pasos**: importá tu planilla, registrá lo que vendés, te avisa antes de que falte y mandá la orden por WhatsApp;
  - una escena anclada cambia con cada paso: la planilla se vuelve cajas, el stock baja, salta la alerta en el punto de reposición (RN-04) y sale la orden.
- **Sección nueva "Hecho para Argentina":**
  - **El mapa:**
    - Argentina extruida en 3D, con las **Islas Malvinas, Georgias del Sur y Sandwich del Sur** y el **sector antártico** en un recuadro, como establece la Ley 26.651;
    - puntos en AMBA, Córdoba, Rosario y Mendoza.
  - **La cinta:**
    - muestra la inflación frente a tus precios con **datos de ejemplo** fijos, rotulados como tales, sin consultar la API;
    - el texto que la acompaña sale de RN-11.
  - **El texto:** destaca IVA neto (RN-03), precios frente al IPC (HU-15) y órdenes por WhatsApp (HU-16).
- **Tres modos según el dispositivo:**
  - **completo:** compu con mouse;
  - **liviano:** celular o tablet con WebGL, con menos objetos, menos resolución, sin seguir el dedo y en pausa fuera de pantalla;
  - **imagen fija:** con "reducir movimiento", sin WebGL, con ahorro de datos, en equipos de gama baja, si se pierde el contexto o si la escena falla. Muestra un PNG por tema generado de la misma escena.
- **Más movimiento sin 3D:**
  - botones magnéticos en los llamados a la acción, sólo con mouse;
  - una marquesina de rubros que avanza con el scroll;
  - un subrayado que se dibuja bajo "números reales";
  - un indicador de la sección activa en la navegación.

### Criterios que se mantienen

- **Con "reducir movimiento":** nada se mueve y se ve la imagen fija.
- **Lo que se lee va en el DOM:**
  - el título, los pasos, las ciudades y la frase de la cinta son texto;
  - los lienzos y las imágenes van con `aria-hidden`;
  - el LCP sigue siendo el título del hero.
- **Colores:** sólo tokens de ADR 0022, leídos del tema actual y actualizados al cambiarlo.
- **Recursos externos:** la portada no carga nada de otros dominios. No se usan fuentes, modelos, HDR ni logos de terceros; el mapa sale de Natural Earth, que es de dominio público, y se embebe como datos locales.

### Fuera de alcance

- 3D o animaciones nuevas en la app con sesión, el login, el registro o la app móvil.
- Datos reales del IPC o del comercio en la portada.
- Provincias, rutas o mapas interactivos.
- Textos en 3D.

## Capabilities

### New Capabilities

Ninguna (`skip_specs: true`).

### Modified Capabilities

Ninguna.

## Impact

- **Web:**
  - `apps/web/package.json` (`three`, `@types/three`);
  - nueva carpeta `features/landing/3d/` (motor, modos, escenas, datos y captura);
  - `features/landing/LandingPage.tsx` y `HechoParaArgentina.tsx`;
  - `features/publico/ComoFuncionaAnclado.tsx` y `lib/animacion.ts`;
  - `vite.config.ts`, `scripts/verificar-chunks.mjs` y `captura.html` (sólo para desarrollo);
  - imágenes fijas en `public/animaciones/escena-*`.
- **Herramientas:**
  - `herramientas/mapas/`: el generador del contorno, fuera del workspace;
  - `herramientas/visuales/exportar.mjs`: las piezas `escena3d`.
- **Docs:**
  - ADR 0026 "Escenas 3D de la portada con three.js, diferidas y con imagen fija" y una nota en ADR 0023;
  - `docs/arquitectura.html`, `openspec/CAPACIDADES.md` y los README.
- **Sin cambios:** API, contrato OpenAPI, app con sesión y app móvil.
