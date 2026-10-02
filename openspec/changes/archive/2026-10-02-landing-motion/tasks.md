## 1. Base

- [x] 1.1 Instalar `motion` en `apps/web` y crear `features/publico/Animado.tsx` (D1). Listo cuando: `pnpm --filter @inventariosmart/web typecheck` pasa y `Animado` usa `LazyMotion` `strict` y `MotionConfig reducedMotion="user"`
- [x] 1.2 Carga diferida de la portada (en `AuthGate`), del login y del registro (en el router), con `Suspense` y un fondo liso como respaldo (D1). Listo cuando: las tres pantallas cargan igual que antes y `vite build` genera chunks separados para ellas
- [x] 1.3 `src/test/setup.ts` registrado en `vite.config.ts` (D6). Listo cuando: `pnpm --filter @inventariosmart/web test` sigue pasando completo sin `.env`

## 2. Piezas animadas

- [x] 2.1 `lib/animacion.ts` con `palabras` e `inclinacion`, y su test (D2). Listo cuando: los unitarios cubren el centro, los bordes y fuera del rectángulo, y la puntuación
- [x] 2.2 `FondoAnimado`, `Revelar` / `Escalonado`, `TextoQueSeArma`, `TarjetaInclinable`, `Contador` y `BarraDeProgreso` (D2), con los keyframes de D5. Listo cuando: el test de `TextoQueSeArma` pasa y, en el arnés, cada pieza se ve en los dos temas y queda quieta con movimiento reducido
- [x] 2.3 `ComoFuncionaAnclado` (D2). Listo cuando: desde 1024 px el panel se ancla y los tres pasos se iluminan en orden al hacer scroll, y en 360 px o con movimiento reducido se ve la lista normal

## 3. Pantallas

- [x] 3.1 Portada con todo lo de D3: fondo, progreso, cabecera que se compacta, hero, "Antes y después", servicios, "Cómo funciona" y planes con el borde giratorio. Listo cuando: el arnés muestra cada sección animándose al hacer scroll a 360, 768, 1024 y 1280 px en los dos temas, sin desborde horizontal, con capturas
- [x] 3.2 Login y registro con lo de D4. Listo cuando: el formulario aparece escalonado, el panel se inclina con el mouse, el login con Google y con correo sigue funcionando y el orden de tabulación no cambia
- [x] 3.3 Revisión de movimiento reducido y pantallas táctiles en las tres pantallas. Listo cuando: con la regla CSS y `MotionConfig` nada se mueve, y con `pointer: coarse` no hay inclinación ni foco; el arnés queda borrado

## 4. Verificación y cierre

- [x] 4.1 `apps/web/scripts/verificar-chunks.mjs`, con el tamaño de los chunks antes y después (D1). Listo cuando: el script pasa (motion no está en `index-*.js`) y los tamaños quedan anotados en el design
- [x] 4.2 ADR 0023, `docs/arquitectura.html` y `openspec/CAPACIDADES.md` (fila 26); nota en el design de `landing-comparison` sobre los hovers. Listo cuando: los documentos reflejan D1 a D7
- [x] 4.3 `pnpm lint`, `pnpm format:check`, `pnpm typecheck` y `pnpm test` (la web también sin `.env`); push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [x] 4.4 Producción: Franco abre https://inventariosmart0.vercel.app sin sesión, el login y el registro, en la compu y en el celular. Listo cuando: Franco confirma que el movimiento le gusta y va fluido
