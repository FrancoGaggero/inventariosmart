# InventarioSmart · app Android (Flutter)

Paquete `com.inventariosmart.app`. Sprint 0: una pantalla que consulta `GET /api/v1/health`.

## Requisitos

- Flutter 3.47 estable y Android Studio con un emulador (ver `docs/ARRANQUE.md`).
- `android/app/google-services.json` copiado desde la carpeta de secretos (está ignorado por git).

## Correr

```bash
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3000
```

`10.0.2.2` es la máquina anfitriona vista desde el emulador. Para un teléfono físico en la misma red usá la IP de la PC; para producción, la URL de Render.

## Verificar

```bash
flutter analyze
flutter test
```

## Estructura

```
lib/
├─ main.dart            inicializa Firebase y monta la app
├─ app/router.dart      rutas (go_router)
├─ app/theme.dart       paleta de los wireframes
├─ core/config.dart     API_URL por --dart-define
├─ core/api_client.dart dio + token de Firebase + ApiException
└─ features/health/     pantalla de estado del servicio
```
