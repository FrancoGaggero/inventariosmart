## 1. Base

- [x] 1.1 Spike de stack (D1): construir una caja que gira con three puro y otra con `@react-three/fiber` v9 en un build de prueba, y medir los KB comprimidos y la compatibilidad con React 19.3. Listo cuando: los números y la decisión quedan anotados en D1 y el spike está borrado
- [x] 1.2 Instalar `three` y `@types/three` con versión fija; agregar `3d/modo.ts` (`decidirModo`, `leerEntorno`, `soportaWebGL`), `3d/colores.ts` (`leerPaleta` y `RESPALDO`) y `3d/progreso.ts` (D2), y pasar a helper de test el parser de `contraste.test.ts`. Listo cuando: `modo.test` cubre la tabla de casos, `colores.test` compara `RESPALDO` contra `index.css` en los dos temas y `pnpm --filter @inventariosmart/web test` pasa
- [x] 1.3 `3d/motor/motor.ts` y `3d/motor/rendimiento.ts`, con DPR, bucle bajo demanda con tope de fps, pausa fuera de pantalla y con la pestaña oculta, desmontaje, pérdida de contexto y degradación; `3d/cargar.ts` y `3d/Lienzo3D.tsx` con su máquina de estados y error boundary (D2). Listo cuando: `Lienzo3D.test` pasa en estos casos: sin WebGL o con movimiento reducido muestra la imagen del tema y no carga la escena; con WebGL la carga; si la carga falla muestra la imagen; siempre va con `aria-hidden`
- [x] 1.4 Extender `scripts/verificar-chunks.mjs` con la firma de three, los controles y los topes de D1, y agrupar el chunk `tres` en `vite.config.ts`. Listo cuando: `pnpm --filter @inventariosmart/web build` imprime la tabla con KB y KB comprimidos y pasa, y una prueba manual que importa three desde `LandingPage` lo hace fallar

## 2. Datos y funciones puras

- [x] 2.1 `herramientas/mapas/` con `package.json` propio, `generar-argentina.mjs` y README (D5): descarga verificada de Natural Earth, Malvinas, Georgias y Sandwich del Sur como territorio argentino, recorte del sector antártico, simplificación con lista blanca de islas y validaciones de punto en polígono. Listo cuando: `node herramientas/mapas/generar-argentina.mjs` escribe `3d/datos/argentina.ts` ya formateado y pasa `datos/argentina.test.ts` (Malvinas y Ushuaia adentro, Santiago de Chile afuera, el sector antártico dentro de su cuña)
- [x] 2.2 `3d/proyeccion.ts`, `3d/cinta.ts` y `3d/datos/inflacionEjemplo.ts` (D5), con la frase armada con `variacionReal` (RN-11) e `indiceBase100`. Listo cuando: sus tests pasan (el norte queda arriba y AMBA al este de Mendoza; la cantidad de vértices de la cinta es la esperada; la frase da el atraso correcto)
- [x] 2.3 Confirmar en `Encuesta_InventarioSmart_v2.xlsx` (Drive) qué ciudades tuvo la muestra. Listo cuando: el texto de la sección cita la encuesta sólo si la ficha técnica lo confirma; si no, se reformula según Open Questions del design
- [x] 2.4 `3d/disposicion.ts` (`repartir`, `estanterias`, `barras`, `curva`, `escalonar`) y `3d/pasos3d.ts` (`estadoDePaso` sobre `tramoDePaso`) (D3, D4). Listo cuando: los tests verifican que `repartir` suma N, que t = 0 y t = 1 dan estanterías y barras con la misma cantidad de cajas, que `escalonar` es monótona y acotada, y que `estadoDePaso` coincide con `tramoDePaso` con el último paso encendido al final

## 3. Escenas

- [x] 3.1 `3d/escenas/deposito.ts` y el hero con `Lienzo3D` detrás de `PanelDelHero` (D3). Listo cuando: en el arnés, a 1280 y 360 px y en los dos temas, las cajas caen al entrar y con el scroll pasan a barras y después a curva, el panel queda delante y el `h1` no se mueve; con capturas
- [x] 3.2 `PASOS` de cuatro con el subtítulo nuevo, `ComoFuncionaAnclado` en dos columnas con `h-[320vh]`, sticky en el celular, y `3d/escenas/comoFunciona.ts` (D4). Listo cuando: en el arnés cada tarjeta se ilumina junto con su visual (planilla, venta, alerta y avión), en el celular la escena va arriba de la lista y con movimiento reducido se ve la lista con el PNG
- [x] 3.3 `HechoParaArgentina.tsx` con su link en la navegación y `3d/escenas/argentina.ts` (D5). Listo cuando: en el arnés se ven el mapa extruido con las Malvinas y el recuadro antártico, los 4 puntos y la cinta que se dibuja con el scroll, y en el DOM están la leyenda de ciudades y "Datos de ejemplo"
- [x] 3.4 `features/landing/LandingPage.test.tsx` (D8). Listo cuando: pasa sin importar three (lo confirman `cargar` mockeado y que `window.__THREE__` no exista) y verifica el `h1`, los 4 pasos, las 4 ciudades, "Datos de ejemplo" y que no haya `src` ni `href` externos

## 4. Más movimiento

- [x] 4.1 `atraccion()` en `lib/animacion.ts` con su test, más `BotonMagnetico`, la marquesina de rubros atada al scroll, el subrayado con `pathLength` y el indicador de sección activa (D6). Listo cuando: con `pointer: coarse` o movimiento reducido no hay magnetismo y la marquesina queda quieta en varias líneas, el lector de pantalla lee la lista una sola vez y no se usan `domMax` ni `layoutId`

## 5. Imagen fija

- [x] 5.1 `apps/web/captura.html` y `3d/captura.tsx` (D7). Listo cuando: `vite` sirve la captura con `?escena=deposito&tema=claro&progreso=0.5` y `dist/` no la incluye
- [x] 5.2 Piezas `escena3d` en `herramientas/visuales/exportar.mjs`, con `puppeteer-core` declarado, y su README actualizado (D7). Listo cuando: `node herramientas/visuales/exportar.mjs escena-deposito escena-como escena-argentina` genera los 6 PNG dentro de sus topes en `apps/web/public/animaciones/` y `manifiesto.json` los lista

## 6. Verificación

- [x] 6.1 Respaldo en el navegador: con movimiento reducido, sin WebGL (`--disable-webgl`) y con pérdida de contexto forzada (`WEBGL_lose_context`). Listo cuando: en los tres casos se ve el PNG del tema actual, sin errores en consola
- [x] 6.2 Lighthouse sobre `vite preview`, en celular y compu, antes y después (D9). Listo cuando: el LCP es el `h1`, CLS ≤ 0,02, Performance en celular baja 5 puntos o menos y la tabla queda en D9
- [ ] 6.3 Prueba en dispositivos: Franco abre la portada en un Android de gama media y en un iPhone. Listo cuando: Franco confirma que va fluido, que se pausa al salir de pantalla y que el celular no se calienta

## 7. Documentación

- [x] 7.1 ADR 0026 "Escenas 3D de la portada con three.js, diferidas y con imagen fija", y la línea "Completada por ADR 0026" en ADR 0023 (D10). Listo cuando: el ADR recoge D1 a D9 con los números medidos
- [x] 7.2 Nota en `docs/arquitectura.html`, fila 33 en `openspec/CAPACIDADES.md` y la portada 3D y `herramientas/mapas` en el README raíz. Listo cuando: los tres documentos mencionan la change y el ADR

## 8. Cierre

- [ ] 8.1 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (la web también sin `.env`) y `pnpm build`; push. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 8.2 Producción: Franco abre https://inventariosmart0.vercel.app sin sesión en la compu y en el celular. Listo cuando: Franco confirma que las tres escenas se ven y le gustan
- [ ] 8.3 Mover la tarjeta de Trello y actualizar el estado en el backlog. Listo cuando: Franco lo confirma
