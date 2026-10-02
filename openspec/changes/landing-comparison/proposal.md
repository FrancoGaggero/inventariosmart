## Why

La portada muestra qué hace InventarioSmart, pero no contrasta con cómo trabaja hoy el comercio, que lleva todo en una planilla. Franco pasó como referencia una sección de "antes y después" de otro sitio y pidió adaptarla a nuestra web. Tiene cinco problemas de un lado, cinco soluciones del otro y un elemento visual circular en el centro.

Es contenido y diseño de la portada (RNF-01 usabilidad, RNF-08 mensajes claros). No cambia la API, las reglas de negocio ni los criterios de las HU, por eso se declara `skip_specs: true`. Corresponde a la **Fase 2**, junto con el rediseño visual (`web-redesign`, ADR 0022).

## What Changes

- **Sección nueva "Antes y después"** en la portada, entre el hero y "Qué hace por tu comercio":
  - una píldora y el título "Dejá de apagar incendios. *Manejá tu comercio con datos.*", con la segunda línea en degradé ámbar y terracota;
  - cinco tarjetas "Con la planilla", con una cruz;
  - cinco "Con InventarioSmart", con un tilde y referidas a funcionalidades que existen: alertas, margen, inflación, órdenes y listas de precios;
  - en el centro, un círculo con una **animación propia** en SVG y CSS: el stock baja, la alerta avisa, sale la orden y el stock se repone.
- **Diseño:**
  - en el celular, el círculo arriba y las dos listas apiladas; desde `lg`, tres columnas;
  - tokens del sistema en los dos temas y sin colores fijos;
  - la animación se detiene con "reducir movimiento" y es decorativa para los lectores de pantalla;
  - sin estados de hover, como la referencia.
- **Ancla "Antes y después"** en la navegación de la cabecera de la portada.

### Qué se adapta de la referencia y qué no

- **No se usan el video (Mux) ni los íconos (CDN de Webflow) de la referencia**, porque son de otra empresa. En su lugar hay una animación propia e íconos de lucide, que ya usa la web. Tampoco hace falta `hls.js`.
- **No se usa la tipografía Mazzard H**: es comercial y el sitio que la sirve no tiene licencia para distribuirla. Además, la tipografía de la web la fija ADR 0022.
- **El código de la referencia está en Tailwind v3 y con colores fijos.** Se reescribe en Tailwind v4 con los tokens.
- **Los textos** se escriben en español rioplatense, para el caso de una PyME con planilla.

### Fuera de alcance

- Un video real de la app.
- Mostrar la sección dentro de la app con sesión.
- La app móvil.

## Capabilities

### New Capabilities

Ninguna (`skip_specs: true`).

### Modified Capabilities

Ninguna.

## Impact

- **Web:**
  - `apps/web/src/features/landing/FrenteAFrente.tsx` (nuevo), con su test;
  - `features/landing/LandingPage.tsx`: inserción y ancla;
  - `apps/web/src/index.css`: keyframes de la animación y el bloque de movimiento reducido.
- **Docs:** `docs/arquitectura.html` y `openspec/CAPACIDADES.md`.
- **Sin cambios:** API, dependencias, contrato OpenAPI y app móvil.
