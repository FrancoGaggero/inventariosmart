## Context

Ver proposal.md – Why. Estado actual de `apps/mobile`: Flutter 3.47.3 con Riverpod 3, go_router 18, dio 5, firebase_core y firebase_auth 6; una sola pantalla (`HealthScreen`) y una sola ruta; `dioProvider` ya adjunta el ID token de Firebase cuando hay sesión; `ApiException.fromDio` ya traduce `{ code, message, details }` y la falta de red. Tema oscuro con la paleta de los wireframes v3. CI ejecuta `flutter analyze --fatal-infos` y `flutter test` sin `google-services.json`, así que nada en tests puede depender de Firebase real.

La API expone todo lo que la app necesita (`/me`, `/me/onboarding`, `/dashboard`, `/products`, `/movements`) con paginación por cursor, errores en español, filtro de campos sensibles para EMPLEADO e `Idempotency-Key` en `POST /movements`. No se genera cliente Dart desde OpenAPI. El `google-services.json` local (ignorado por git) no tiene `oauth_client`: la huella SHA-1 de la app no está registrada en Firebase.

## Goals / Non-Goals

**Goals:**
- Cuatro pantallas (login, inicio, inventario, registrar movimiento) más onboarding mínimo, navegación por rol y manejo uniforme de errores, todo probado con tests de widgets sin red ni Firebase.
- Reutilizar el contrato tal cual: ningún cambio en API, shared ni web.
- Que el APK de demo funcione contra la API publicada en Render.

**Non-Goals:**
- Cliente Dart generado, cache persistente, modo offline, push, iOS, firma de release, tema claro.
- Cualquier pantalla fuera de las cuatro comprometidas (ver proposal – Fuera de alcance).

## Decisions

### D1 · Modelos Dart escritos a mano, sin generador
Seis endpoints y cinco formas de respuesta (`Me`, `Dashboard`, `Producto`, `Movimiento`, `ListaPaginada<T>`) no justifican el generador de OpenAPI para Dart (requiere Java, produce decenas de archivos y modelos con `dynamic` para los `oneOf`). Se escriben clases inmutables con `fromJson`/`toJson` en `lib/core/modelos/`, con tests unitarios que parsean JSON de ejemplo copiado del contrato, y los montos se mantienen como `String` (decimal con dos decimales), igual que en la web. El contrato lo custodia CI del lado TypeScript; si un campo cambia, el test unitario del modelo se actualiza con el JSON nuevo. Alternativas: `openapi_generator` (descartado por peso), `swagger_dart_code_generator` (genera Dio + modelos, pero exige `build_runner` y mantenimiento de anotaciones). Queda registrado en **ADR 0009**.

### D2 · Sesión y autenticación
`AuthRepository` (interfaz) con una implementación Firebase (`firebase_auth` para email y contraseña y `google_sign_in` 7 → `GoogleAuthProvider.credential(idToken)` → `signInWithCredential`) y una implementación falsa para tests. `sesionProvider` expone `Stream<UsuarioAuth?>` (`authStateChanges`); `meProvider` (`FutureProvider`) llama `GET /me` cuando hay sesión y expone rol, plan y `onboardingPendiente`. Los mensajes de Firebase se traducen con la misma tabla que la web (`auth/invalid-credential`, `auth/email-already-in-use`, `auth/weak-password`, `auth/network-request-failed`). Un `401` o `403` en `GET /me` cierra la sesión local y muestra el motivo en el login (CP-M.1i); un `403` en otra pantalla se muestra como mensaje sin cerrar sesión. Google en Android necesita la SHA-1 registrada en Firebase y un `google-services.json` nuevo: tarea manual de Franco; si `google_sign_in` falla por configuración, el login muestra el mensaje de CP-M.1c.

### D3 · Estado con Riverpod 3
Consultas: `FutureProvider.autoDispose.family` (`dashboardProvider(periodo)`, `productosProvider(filtros)`, `buscarProductosProvider(q)`); la lista del inventario usa un `AsyncNotifier` que acumula páginas por cursor. Formularios: `Notifier` con estado inmutable (campos, errores, enviando, resultado). Tras registrar un movimiento o crear un producto se invalidan `dashboardProvider`, `productosProvider` y `meProvider` no. Sin persistencia local.

### D4 · Navegación y shell por rol
go_router con `redirect` global: sin sesión → `/login`; con sesión y `onboardingPendiente` y rol DUENIO → `/onboarding`; si no, a la primera pestaña permitida. `StatefulShellRoute.indexedStack` con `NavigationBar` cuyo conjunto de pestañas depende del rol: DUENIO Inicio · Inventario · Movimiento; EMPLEADO Inventario · Movimiento; CONTADOR Inicio. Rutas: `/login`, `/onboarding`, `/inicio`, `/inventario`, `/inventario/nuevo`, `/movimientos/nuevo?productoId=`. "Cerrar sesión" en la barra superior de cada pestaña. El `HealthScreen` del sprint 0 se retira del router (su test se reemplaza por los de las pantallas nuevas).

### D5 · Cliente HTTP e idempotencia
Se conserva `dioProvider`; `connectTimeout` 15 s y `receiveTimeout` 60 s para tolerar el arranque en frío de Render Free; un temporizador de 5 s en la primera consulta en curso muestra "La API está despertando" (CP-M.5b). `ApiException.fromDio` distingue `SIN_CONEXION` (sin respuesta) de los errores con cuerpo. `POST /movements` envía `Idempotency-Key` UUID v4 que el `Notifier` del formulario genera al pasar a "enviando" y conserva mientras el formulario no cambie; se regenera al editar cualquier campo o tras un éxito (CP-M.4d). Los `200` por clave repetida se tratan como éxito.

### D6 · Formato y textos
`intl` con locale `es_AR`: pesos con separador de miles y dos decimales (`$ 1.230.000,00`), porcentajes con un decimal, fechas ISO → hora local. Etiquetas de tipo, motivo y estado copiadas de `packages/shared` (`ETIQUETA_TIPO`, `ETIQUETA_MOTIVO`, `ETIQUETA_MOTIVO_RESUMEN`) como constantes Dart; los motivos por tipo (`MOTIVOS_POR_TIPO`) se replican y se prueban.

### D7 · Pantallas (wireframes v3)
- **Login**: logo, email, contraseña, "Ingresar", "Continuar con Google", enlace "Crear cuenta" que despliega nombre y confirma contraseña. Errores en una franja roja bajo el formulario.
- **Onboarding**: un campo "Nombre del comercio" y "Guardar y continuar".
- **Inicio**: título con el mes y flechas ← →, frase en lenguaje claro ("Este mes vendiste N unidades por $X netos"), cuatro tarjetas en grilla 2×2, lista "Más rentables" (3) y bloque "Alertas" con contadores; el aviso de gastos faltantes lleva el texto de CP-M.2b.
- **Inventario**: buscador arriba, fila de chips (Todos / OK / Bajo / Sin stock), lista con código, nombre, stock, precio y punto de color por estado, botón "Vender" en cada fila; FAB "Nuevo producto" sólo para DUENIO. Alta rápida en pantalla completa con validaciones locales mínimas (obligatorios y numéricos) y los mensajes de la API para el resto.
- **Movimiento**: segmentos Venta / Ingreso / Ajuste; selector de producto (hoja inferior con buscador que usa `GET /products?q=`); cantidad; precio de venta vigente mostrado como texto (la API registra la venta a ese precio; el cuerpo no lleva precio); motivo (Ingreso/Ajuste); observación; "Registrar". Resultado en tarjeta con stock resultante y aviso de stock bajo (CP-M.4e) y acciones "Registrar otro" / "Ver inventario".

### D8 · Tests
Tests de widgets por pantalla con `ProviderScope(overrides)`: `AuthRepository` falso, `dioProvider` reemplazado por un `Dio` con adaptador falso que responde JSON fijo por ruta (para probar el `Idempotency-Key` repetido y los `409`), y providers de datos sobreescritos donde alcance. Unitarios: modelos (`fromJson` con JSON del contrato), `formatoPesos`, `variación`, motivos por tipo, lógica del `Notifier` de movimiento (clave de idempotencia). `flutter analyze --fatal-infos` limpio y `flutter test` en verde son el gate de CI.

### D9 · Configuración y entrega
`API_URL` por `--dart-define` (default `http://10.0.2.2:3000` para el emulador). Demo: `flutter build apk --release --dart-define=API_URL=https://inventariosmart-api.onrender.com` con firma de depuración; el APK no se commitea. `android:label` pasa a "InventarioSmart".

## Risks / Trade-offs

- [Google sin SHA-1 registrada] → mensaje explicativo en el login (CP-M.1c); README con los pasos (`gradlew signingReport`, Firebase → app Android → agregar huella → descargar `google-services.json`); email y contraseña como camino garantizado.
- [Arranque en frío de Render Free, hasta 50 s] → timeouts de D5 y aviso "La API está despertando"; el poll de `/health` del sprint 0 no se conserva.
- [Emulador sin Google Play] → Google sólo funciona en imágenes con Play Services o en un celular real; email y contraseña funcionan en cualquier imagen.
- [`google_sign_in` 7 cambió la API respecto de la 6] → versión fijada en `pubspec.yaml` y uso encapsulado en `AuthRepository`.
- [Modelos a mano desactualizados si cambia el contrato] → tests unitarios con JSON del contrato y revisión de `docs/openapi.json` en cada change que toque esos endpoints.
- [Firebase en tests] → ningún test instancia Firebase; `main.dart` es el único lugar que lo inicializa.

## Migration Plan

Sin base de datos ni API. Pasos: (1) `flutter pub get` con las dependencias nuevas; (2) código y tests; (3) CI verde; (4) Franco registra la SHA-1 y reemplaza `google-services.json` local; (5) prueba en el emulador contra producción; (6) `flutter build apk --release` para la demo. Rollback: revertir el commit; nada persiste fuera del repositorio.

## Open Questions

- Firma de release del APK (keystore propia) para la entrega final: se decide en el hito H4; no cambia specs ni tareas de esta change.
