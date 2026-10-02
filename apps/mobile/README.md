# InventarioSmart · app Android (Flutter)

Paquete `com.inventariosmart.app`. Es la herramienta de mostrador: login, inicio con el panel del mes, inventario, registrar movimiento y "Más" (cuenta, tema y cierre de sesión). Lo de gestión queda en la web (ADR 0024).

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
├─ main.dart                  inicializa Firebase y las preferencias, y monta la app
├─ app/
│  ├─ router.dart             rutas (go_router) y redirecciones por sesión y rol
│  ├─ shell.dart              barra inferior: pestañas por rol y "Más" al final
│  ├─ theme.dart              tokens de la paleta ámbar (claro y oscuro) y tema de Material 3
│  └─ tema_provider.dart      tema elegido (Sistema, Claro u Oscuro), guardado en el dispositivo
├─ core/                      cliente de la API, sesión, formato y modelos escritos a mano (ADR 0009)
├─ features/
│  ├─ auth/                   login, creación de cuenta y onboarding
│  ├─ inicio/                 panel del mes
│  ├─ inventario/             listado, filtros y alta rápida
│  ├─ movimientos/            venta, ingreso y ajuste
│  └─ mas/                    cuenta, tema, lo que se hace en la web y secciones por rol y plan
└─ ui/                        aviso, estados de carga y logo
```

## Colores

Los colores salen siempre del tema con `context.tokens` y nunca de una constante. Los valores son copia de `apps/web/src/index.css`:

- `test/app/tokens_web_test.dart` falla si la web y la app no coinciden;
- `test/app/contraste_test.dart` exige contraste WCAG AA en los dos temas.

Si cambiás un color en la web, copialo en `lib/app/theme.dart`.
