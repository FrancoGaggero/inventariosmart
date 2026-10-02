## 1. Tema y tokens

- [x] 1.1 `Tokens` como `ThemeExtension` con `Tokens.oscuro` y `Tokens.claro` copiados de `apps/web/src/index.css`, `context.tokens` y `buildTheme(Brightness)` con `ColorScheme` y temas de componentes (D1, D8). Listo cuando: `flutter analyze --fatal-infos` pasa con `theme.dart` nuevo y `AppColors` todavía presente (se borra en 3.4)
- [x] 1.2 `test/app/contraste_test.dart` con los pares de D5 en los dos temas. Listo cuando: el test pasa (CP-M.7c) y, si algún par no llegaba, el ajuste quedó anotado en el design
- [x] 1.3 `test/app/tokens_web_test.dart`: compara los colores de `Tokens` con `index.css` y se saltea con mensaje si no encuentra el archivo (D6). Listo cuando: pasa en el repo y falla si se cambia a mano un valor de `Tokens.claro`
- [x] 1.4 `shared_preferences` en `pubspec.yaml`, `PreferenciaTema`, `temaProvider` y `preferenciasProvider` con el override en `main.dart`; `MaterialApp.router` con `theme`, `darkTheme` y `themeMode`, y `AnnotatedRegion` para las barras del sistema (D2, D3). Listo cuando: un test levanta la app con el sistema en claro y en oscuro sin preferencia (CP-M.7) y otro con `tema=claro` guardado, y verifica el `Brightness` del tema aplicado

## 2. Pestaña Más

- [x] 2.1 `Rutas.mas`, la cuarta rama del shell, `Pestania.mas`, `pestaniasDe` terminando siempre en "Más" y `rutaPermitida` para `/mas` (D4). Listo cuando: `shell_test.dart` verifica Inicio, Inventario, Movimiento y Más para DUENIO (CP-M.8), Inventario, Movimiento y Más para EMPLEADO, e Inicio y Más para CONTADOR (CP-M.8b)
- [x] 2.2 `features/mas/secciones.dart` (`seccionesMas`, vacía por ahora) y `mas_screen.dart` con la cuenta, `nombrePlan`, "Apariencia", "En la web" y "Cerrar sesión" (D4). Listo cuando: `mas_test.dart` cubre CP-M.8c (comercio, email, "Dueño" y "Pro"), CP-M.8d (las tareas de la web y la dirección), CP-M.8e (los datos salen del `/me` de quien inició sesión) y CP-M.7b (elegir "Claro" guarda la preferencia y cambia el tema)
- [x] 2.3 Borrar `MenuSesion` de las tres barras superiores y mover CP-M.1h a "Más". Listo cuando: `login_test.dart` cierra sesión desde la pestaña "Más" y no queda ningún uso del tooltip "Cuenta"

## 3. Pantallas

- [x] 3.1 `ui/logo.dart` en ámbar con el ícono en `onBrand`, usado en login y onboarding (D7). Listo cuando: el login y el onboarding no tienen degradé ni `Colors.white`, y `login_test.dart` y `onboarding_test.dart` pasan
- [x] 3.2 Inicio, inventario y movimiento con `context.tokens`, tarjetas de radio 20 y estado de stock con color y etiqueta (D8, CP-M.7d). Listo cuando: `inicio_test.dart`, `inventario_test.dart` y `movimiento_test.dart` pasan sin cambios de comportamiento
- [x] 3.3 `ui/aviso.dart` y `ui/estado_carga.dart` con tokens. Listo cuando: los tests de errores y de "Reintentar" (CP-M.5) siguen pasando
- [x] 3.4 Borrar `AppColors` y revisar los colores fijos. Listo cuando: `flutter analyze --fatal-infos` pasa y `grep -rn "Color(0x\|Colors\." lib` sólo encuentra `theme.dart` y `Colors.transparent`

## 4. Verificación y cierre

- [x] 4.1 Recorrido visual de login, onboarding, inicio, inventario, movimiento y "Más", en los dos temas y con dueño, empleado y contador. Con el emulador si está disponible; si no, con capturas de un test de *golden* temporal que no se commitea. Listo cuando: hay capturas de cada pantalla en los dos temas, sin desbordes ni texto ilegible, y lo temporal quedó borrado
- [x] 4.2 ADR 0024 (D9), nota en ADR 0022, `apps/mobile/README.md` con la estructura actual, `docs/arquitectura.html` (sección mobile) y `openspec/CAPACIDADES.md` (fila 28). Listo cuando: los documentos reflejan D1 a D9
- [x] 4.3 `flutter analyze --fatal-infos` y `flutter test` en `apps/mobile`, y `pnpm format:check` en la raíz por los documentos; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [x] 4.4 Celular: Franco instala el APK de entrega y recorre la app con el tema del sistema en claro y en oscuro, y elige un tema desde "Más". Listo cuando: Franco confirma que la paleta, la barra inferior y "Más" se ven bien y que cerrar sesión funciona
- [ ] 4.5 (manual, Franco) Anotar el rediseño de la app en Trello y en el backlog. Listo cuando: Trello y backlog lo reflejan
