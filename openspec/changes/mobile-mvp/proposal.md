## Why

La Propuesta compromete una app Android como herramienta de mostrador (RNF-06; documento de arquitectura §7): registrar la venta desde el celular, mirar el stock y ver el panel resumido sin abrir la computadora. Hoy `apps/mobile` es el esqueleto del sprint 0 y sólo muestra `GET /health`. Con la API y la web de Fase 1 completas y verificadas en producción, es el momento de construir las cuatro pantallas comprometidas para el MVP.

Cubre desde mobile las historias ya construidas en la API: **HU-11** (acceso), **HU-04** (panel), **HU-01** (consulta y alta de productos) y **HU-10** (movimientos), en la **Fase 1 – MVP**. Es la décima capacidad del mapa de `openspec/CAPACIDADES.md` y la última de la Fase 1.

## What Changes

- **Acceso**: login con email y contraseña y con Google sobre el mismo proyecto Firebase que la web; creación de cuenta con email desde el celular; sesión persistente entre aperturas; cierre de sesión; si el comercio tiene el onboarding pendiente, el DUENIO completa el nombre del comercio en una pantalla mínima (la importación Excel sigue siendo web, §7).
- **Inicio (panel resumido)** para DUENIO y CONTADOR: cuatro indicadores del mes (unidades en stock con su valorización, ventas netas con la variación contra el mes anterior, margen bruto con porcentaje, margen neto o su motivo), los tres productos más rentables y las alertas (sin stock, stock bajo, gastos faltantes), con cambio de mes. Mismo `GET /dashboard` que la web. El EMPLEADO no tiene panel: su inicio es el inventario.
- **Inventario de mostrador** para DUENIO y EMPLEADO: lista con búsqueda por código o nombre, chips de estado (Todos / OK / Bajo / Sin stock), carga por cursor al llegar al final, y un botón "Vender" por producto. **Alta rápida** de producto para el DUENIO (código, nombre, precio con IVA, costo, stock inicial, stock de seguridad). Sin edición ni baja desde el celular. El CONTADOR no ve el inventario (CP-01.3d).
- **Registrar movimiento** para DUENIO y EMPLEADO: venta, ingreso o ajuste con selector de producto con búsqueda, cantidad, precio unitario (venta), motivo (ingreso y ajuste) y observación; clave de idempotencia por intento; resultado con el stock resultante y el aviso de stock bajo. El EMPLEADO no ve costos (la API ya los filtra).
- **Errores y conexión**: mensajes de la API tal cual (ya vienen en español); sesión vencida o usuario dado de baja vuelve al login; sin conexión ofrece reintentar; aviso mientras la API de Render Free se despierta.
- **Sin cambios en la API ni en el contrato OpenAPI.** Los modelos Dart se escriben a mano para los seis endpoints que usa la app (ver design D1).
- **Calidad**: tests de widgets por pantalla y unitarios de modelos y formato; el job "Mobile (Flutter)" de CI ya ejecuta análisis estático y tests.

Supuestos registrados:
- **Google en Android requiere un paso manual**: el `google-services.json` actual no tiene cliente OAuth porque la huella SHA-1 de la app no está registrada en Firebase. Hasta que Franco la registre y reemplace el archivo, el botón de Google muestra un mensaje que lo explica; el acceso con email y contraseña funciona sin ese paso.
- **Cuatro pantallas y nada más** (§7): proveedores, gastos, usuarios, rentabilidad detallada, importación, anulación de movimientos, edición y baja de productos quedan en la web.
- **Sólo Android**; sin modo offline ni notificaciones push (evolución de Fase 2).
- El APK de la demo se compila apuntando a la API de producción con firma de depuración; la firma de release se decide en el hito H4.

## Capabilities

### New Capabilities

- `mobile-app`: comportamiento observable de la app Android: acceso con la misma identidad que la web, panel resumido del mes, inventario de mostrador con alta rápida y registro de movimientos, respetando los permisos por rol y el aislamiento por comercio que ya define la API.

### Modified Capabilities

Ninguna. `auth-tenancy`, `user-roles`, `financial-dashboard`, `product-catalog` y `stock-movements` se consumen tal cual; la app no agrega ni cambia reglas.

## Impact

- **Código:** `apps/mobile` (`lib/app` router y shell, `lib/core` cliente HTTP, sesión, modelos y formato, `lib/features/{auth,inicio,inventario,movimientos}`, `test/`); `pubspec.yaml` suma `google_sign_in`, `intl` y `uuid`. Sin cambios en `apps/api`, `apps/web`, `packages/*` ni base de datos.
- **Documentación:** ADR 0009 (modelos Dart a mano, sin cliente generado), README (correr la app, registrar la SHA-1, compilar el APK), `docs/arquitectura.html` §7, `openspec/CAPACIDADES.md` (capacidad `mobile-app`).
- **Trazabilidad:** escenarios CP-M.1 a CP-M.6, cada uno referido al criterio de la HU que reutiliza (CP-11.x, CP-04.x, CP-01.x, CP-10.x).
- **Fuera de alcance:** iOS, modo offline, push, cliente Dart generado desde OpenAPI, alertas predictivas (HU-06), historial completo de movimientos, todo lo enumerado en los supuestos.
