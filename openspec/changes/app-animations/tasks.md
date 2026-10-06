## 1. Taller

- [x] 1.1 `herramientas/visuales/` con README, `hyperframes/vendor/gsap.min.js` local, `remotion/` creado con `create-video --blank`, `tokens.json` con los colores de `index.css`, y los ignores de eslint y prettier (D2, D6). Listo cuando: `pnpm lint` y `pnpm format:check` pasan en la raíz con el taller adentro
- [x] 1.2 Las 6 composiciones `vacio-<nombre>` de HyperFrames con margen, loop sin salto y la variable `tema` (D2). Listo cuando: `npx hyperframes lint` da 0 errores y `check` no tiene hallazgos de contraste en cada una, y hay capturas de 4 cuadros por tema revisadas a ojo
- [x] 1.3 La composición `Bienvenida` de Remotion con `inputProps.tema` (D2). Listo cuando: `npx remotion still` de los cuadros 30, 90 y 170 en los dos temas da imágenes revisadas a ojo y sin cortes
- [x] 1.4 `exportar.mjs` con render, WebP, PNG fijo, control de peso, copia y manifiesto (D3). Listo cuando: `node exportar.mjs` genera las 14 piezas en `apps/web/public/animaciones/` y `apps/mobile/assets/animaciones/`, todas bajo su tope, y falla si se baja el tope a propósito

## 2. Web

- [x] 2.1 `lib/tema-actual.ts` con `useTemaActual` (D4). Listo cuando: `tema-actual.test.ts` verifica que un cambio de `data-theme` actualiza el valor sin llamar a `aplicarTema`
- [x] 2.2 `EstadoVacio` con `<picture>`, movimiento reducido y respaldo al SVG (D4). Listo cuando: `EstadoVacio.test.tsx` cubre la ruta por tema, la fuente `prefers-reduced-motion` y el `onError`, y los tests de las páginas siguen pasando sin `.env`
- [x] 2.3 La bienvenida en `OnboardingPage` (D4). Listo cuando: su test sigue pasando y el arnés de vista previa muestra la animación en los dos temas a 360 y 1280 px

## 3. Celular

- [x] 3.1 Assets en `pubspec.yaml` y `Vacio` con `ilustracion`, tema, `disableAnimations` y respaldo al ícono (D5). Listo cuando: `analisis_ui_test.dart` cubre los cuatro casos
- [x] 3.2 Alertas, falta de stock, stock parado y conversaciones con su ilustración, y la bienvenida en el onboarding (D5). Listo cuando: los widget tests encuentran la imagen en cada estado vacío y en el onboarding, y las capturas del test temporal se revisan en los dos temas

## 4. Verificación y cierre

- [x] 4.1 ADR 0025, `docs/arquitectura.html`, `apps/mobile/README.md`, el README del taller y `openspec/CAPACIDADES.md` (fila 31) (D7). Listo cuando: los documentos reflejan D1 a D7
- [ ] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck` y `pnpm test` (web sin `.env`); `pnpm --filter @inventariosmart/web build`; `flutter analyze --fatal-infos` y `flutter test`; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 4.3 Producción: Franco revisa los estados vacíos y el onboarding en la web y en el APK, en los dos temas y con movimiento reducido. Listo cuando: Franco confirma que se ven bien y que con movimiento reducido quedan quietas
- [ ] 4.4 (manual, Franco) Anotar la change en Trello y en el backlog. Listo cuando: Trello y backlog lo reflejan
