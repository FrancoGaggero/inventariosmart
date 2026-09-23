## 1. Base de la app

- [x] 1.1 `pubspec.yaml`: agregar `google_sign_in` 7.x, `intl` 0.20.x y `uuid` 4.x; `android:label` "InventarioSmart"; retirar `HealthScreen` y su ruta (D4). Listo cuando: `flutter pub get` y `flutter analyze --fatal-infos` terminan sin errores
- [x] 1.2 `lib/core`: `ApiException` con `SIN_CONEXION` y `esNoAutenticado`/`esSinPermiso`; `dioProvider` con timeouts de D5 y `apiDespertando` (aviso a los 5 s); `ListaPaginada<T>`; `formato.dart` (`formatoPesos`, `formatoPorcentaje`, `formatoFecha`, `mesActual`, `sumarMeses`) con tests unitarios. Listo cuando: `flutter test test/core` pasa con `$ 1.230.000,00`, `-12,5 %` y el mes en Buenos Aires
- [x] 1.3 Modelos Dart (D1): `Me`, `Comercio`, `Dashboard` (stock, ventas, mesAnterior, topRentables, alertas), `Producto`, `Movimiento`, `MovimientoCreate.toJson` por tipo, etiquetas y `MOTIVOS_POR_TIPO` copiadas de shared, con tests que parsean JSON de ejemplo del contrato. Listo cuando: los tests de modelos pasan, incluido un `Producto` sin `costoReposicion` (respuesta a EMPLEADO)

## 2. Acceso y navegación

- [x] 2.1 `AuthRepository` (interfaz), `FirebaseAuthRepository` (email/contraseña, Google con `google_sign_in` 7, crear cuenta, cerrar sesión) y `AuthRepositoryFalso` para tests; `sesionProvider` y `meProvider` (D2); tabla de mensajes de Firebase en español. Listo cuando: un test unitario cubre la traducción de los códigos de Firebase y `meProvider` con `401` dispara el cierre de sesión (CP-M.1i)
- [x] 2.2 `LoginScreen` (D7) con ingreso, Google y "Crear cuenta". Listo cuando: los tests de widgets cubren CP-M.1, CP-M.1c, CP-M.1d y CP-M.1e
- [x] 2.3 `OnboardingScreen` (nombre del comercio → `POST /me/onboarding`). Listo cuando: el test de widget cubre CP-M.1g (guardar invalida `meProvider` y navega al inicio)
- [x] 2.4 Router con `redirect` por sesión, onboarding y rol, `StatefulShellRoute` con pestañas por rol y "Cerrar sesión" (D4). Listo cuando: tests de widgets verifican las pestañas de DUENIO, EMPLEADO (sin Inicio, CP-M.2e) y CONTADOR (sólo Inicio, CP-M.3d y CP-M.4g), y CP-M.1f/CP-M.1h con el repositorio falso

## 3. Inicio · panel resumido

- [x] 3.1 `dashboardProvider(periodo)` y `InicioScreen` (D7): mes con flechas, frase en lenguaje claro, cuatro tarjetas, top 3 y alertas; "No calculable" con la guía a la web. Listo cuando: tests de widgets cubren CP-M.2, CP-M.2b y CP-M.2c con JSON fijo, y CP-M.2d se verifica invalidando el provider tras un movimiento

## 4. Inventario de mostrador

- [x] 4.1 `InventarioNotifier` (búsqueda, chip de estado, páginas por cursor) e `InventarioScreen` con buscador, chips, lista con estado en color, "Vender" por fila y FAB sólo para DUENIO. Listo cuando: tests de widgets cubren CP-M.3, CP-M.3b (dos páginas con `siguienteCursor`), CP-M.3c (sin costos) y CP-M.3h
- [x] 4.2 `ProductoNuevoScreen` (alta rápida, `POST /products`) con validaciones locales y mensajes de la API (`409`, `402`). Listo cuando: tests de widgets cubren CP-M.3e, CP-M.3f y CP-M.3g e invalidan la lista al crear

## 5. Registrar movimiento

- [x] 5.1 `MovimientoNotifier` (tipo, producto, cantidad, motivo, observación, `Idempotency-Key` por intento según D5) y `MovimientoScreen` con selector de producto con buscador, resultado con stock resultante y aviso de stock bajo; precarga desde `?productoId=` (CP-M.4f); invalida dashboard e inventario al registrar. Listo cuando: tests cubren CP-M.4, CP-M.4b, CP-M.4c (`409`), CP-M.4d (misma clave en el reintento, clave nueva al editar), CP-M.4e y CP-M.4f

## 6. Documentación y cierre

- [x] 6.1 ADR 0009 (modelos Dart a mano), README (correr la app, registrar la SHA-1 y reemplazar `google-services.json`, compilar el APK de demo), `docs/arquitectura.html` §7 (pantallas mobile construidas), `openspec/CAPACIDADES.md` (capacidad `mobile-app`). Listo cuando: los documentos reflejan D1 a D9
- [x] 6.2 `flutter analyze --fatal-infos`, `flutter test` y `flutter build apk --debug --dart-define=API_URL=https://inventariosmart-api.onrender.com` en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [x] 6.3 (manual, Franco) Registrar la SHA-1 de depuración en Firebase → app Android y reemplazar `apps/mobile/android/app/google-services.json`. Listo cuando: el archivo nuevo tiene `oauth_client` y "Continuar con Google" entra al comercio (CP-M.1b)
- [x] 6.4 Verificar en el emulador contra producción: login con email, panel del mes, inventario con búsqueda y chips, una venta desde "Vender" con su stock resultante, y la venta visible en la web. Listo cuando: CP-M.6 se cumple con los datos reales del comercio
- [ ] 6.5 (manual, Franco) Mover la tarea mobile a Hecho en Trello, actualizar `Backlog_InventarioSmart_v2.xlsx` y la tarea 4.10 del Gantt. Listo cuando: Trello, backlog y Gantt coinciden
