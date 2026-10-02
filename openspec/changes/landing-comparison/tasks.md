## 1. Sección

- [x] 1.1 `features/landing/FrenteAFrente.tsx` con el encabezado, las dos listas y el círculo (D1, D2). Listo cuando: `pnpm --filter @inventariosmart/web typecheck` pasa y el componente no tiene hex, `white` ni URLs externas
- [x] 1.2 `AnimacionReposicion` y los keyframes `.anim-stock`, `.anim-campana` y `.anim-orden` en `index.css`, incluido el bloque de movimiento reducido (D3). Listo cuando: en el arnés se ve el ciclo de 6 s en los dos temas y, con `prefers-reduced-motion` emulado, queda el cuadro fijo legible
- [x] 1.3 `FrenteAFrente.test.tsx` (D5). Listo cuando: el test pasa sin variables de entorno, como en CI

## 2. Integración

- [x] 2.1 `<FrenteAFrente />` entre el hero y `#servicios`, y el ancla "Antes y después" en la cabecera de la portada (D4). Listo cuando: el enlace lleva a la sección y la portada no desborda a 360, 768, 1024 y 1280 px en los dos temas, con capturas y el arnés borrado

## 3. Cierre

- [x] 3.1 `docs/arquitectura.html` (portada) y `openspec/CAPACIDADES.md` (fila 25, `skip_specs`). Listo cuando: los documentos mencionan la sección
- [x] 3.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck` y `pnpm test`, más el test de contraste; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 3.3 Producción: Franco abre https://inventariosmart0.vercel.app sin sesión y baja hasta la sección en la compu y en el celular. Listo cuando: Franco confirma que se ve bien
