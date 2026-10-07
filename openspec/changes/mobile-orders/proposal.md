## Why

ADR 0024 dejó para el celular "ver las órdenes y enviarlas por WhatsApp", y WhatsApp ya está en el teléfono del dueño (HU-16, ADR 0015). Hoy la app no tiene ninguna pantalla de órdenes:
- un dueño que recibe una alerta en el local no puede confirmar el pedido sin ir a la compu;
- el borrador que prepara el asistente en el celular (`mobile-assistant`) muestra una tarjeta que no lleva a ningún lado y manda a la web.

Esta change lleva **HU-07 "Orden de compra asistida"** (RF-07, RN-06) y **HU-16 "Enviar la orden por WhatsApp"** (RF-17) al celular. Son de la **Fase 2** y del plan **PRO**. No cambia la API, la base ni el contrato: usa los endpoints de `purchase-orders`. El servidor ya arma el enlace `https://wa.me/...` (ADR 0015), así que la app sólo lo abre.

## What Changes

- **Sección "Compras" en "Más"** con "Órdenes de compra", para el DUENIO y el CONTADOR. En FREE, la pantalla explica que es del plan PRO sin consultar la API. El EMPLEADO no la ve (403).
- **Listado:**
  - chips Todas, Borradores, Confirmadas, Enviadas y Canceladas;
  - cada orden muestra número, proveedor, cantidad de ítems, total neto, estado con su canal y fecha;
  - "Cargar más" y estado vacío.
- **Detalle:**
  - la frase del estado ("Borrador creado el…", "Confirmada el…", "Enviada por WhatsApp a…");
  - el proveedor y sus datos de contacto;
  - las líneas con su cantidad, costo neto ("a confirmar" si falta) y subtotal, y el total neto estimado sin IVA;
  - el texto del mensaje.
- **Acciones del DUENIO** (RN-06):
  - **En borrador:**
    - cambiar cantidades y quitar líneas, con "Guardar";
    - cancelar el borrador, con confirmación;
    - elegir el canal si el proveedor tiene los dos;
    - **"Confirmar y enviar por WhatsApp"**, "…por correo" o "Confirmar", con el aviso de qué va a pasar.
  - **Confirmada por WhatsApp:** **"Abrir WhatsApp"** abre la conversación con el mensaje escrito, usando la URL del servidor. Después, **"Ya la envié"**.
  - **Confirmada sin canal o con el correo fallido:** "Copiar texto" y "Ya la envié".
- **"Copiar texto"** para cualquier rol, cuando la orden no es borrador.
- **El CONTADOR consulta en sólo lectura.**
- **La tarjeta "Orden OC-0007 para …" del asistente** lleva al detalle de la orden. El aviso de la tarjeta deja de mandar a la web.
- **Dependencia nueva:** `url_launcher` (paquete oficial de flutter.dev) para abrir WhatsApp. Se suma la consulta de intents `https` al manifiesto de Android.
- **El permiso `INTERNET` queda declarado en el `AndroidManifest.xml` principal.** Hoy llega sólo por los plugins de Firebase, lo que es frágil.
- **Nota en ADR 0024:** editar un producto puntual queda en la web, por decisión de Franco del 06/10/2026.

### Fuera de alcance

- **Generar órdenes desde las alertas, y la sugerencia por proveedor:** se crean en la web o con el asistente.
- **Editar un producto desde el celular:** queda en la web (nota en ADR 0024).
- **Del borrador, desde el celular no se puede:** agregar productos, cambiar el proveedor, editar las notas o reescribir el texto. Se hace en la web; acá se ve el texto y se puede copiar.
- Cambios en la API, la web y el contrato.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `mobile-app`:
  - **Requisito nuevo "Órdenes de compra en el celular".**
  - **Requisito modificado "Pestaña Más":** suma la sección "Compras".
  - **Requisito modificado "Asistente con IA en el celular":** la tarjeta de la orden en borrador lleva al detalle (CP-M.12e).
  - Las reglas (RN-06), los permisos, el plan, el texto y el enlace de WhatsApp son los que ya fijan `purchase-orders` (CP-07.x y CP-16.x).

## Impact

- **Mobile (`apps/mobile`):**
  - **Modelos y textos:** `lib/core/modelos/ordenes.dart` (resumen, detalle, línea y proveedor), y `lib/core/ordenes_formato.dart` con etiquetas de estado y canal, el texto del botón de confirmar, el aviso del envío y la frase de enviada, portados de `apps/web/src/lib/canales.ts` y de `packages/shared/src/ordenes.ts`.
  - **Pantallas:** `lib/features/ordenes/`, con el listado, el detalle y sus providers.
  - **Plan y rol:** `Me.veOrdenes`, que pide DUENIO o CONTADOR con PRO, y `Me.operaOrdenes`, sólo DUENIO.
  - **Navegación:** `app/router.dart` suma `/mas/ordenes` y `/mas/ordenes/:id`, y `features/mas/secciones.dart` la sección "Compras".
  - **Asistente:** `features/asistente/asistente_screen.dart` y `core/asistente_formato.dart`, para la tarjeta y su texto.
  - **Dependencias:** `pubspec.yaml` (`url_launcher`) y `android/app/src/main/AndroidManifest.xml` (`INTERNET` y la consulta de `https`).
- **Tests:** formato, modelos y widget tests del listado, el detalle, la edición, las acciones, los permisos y el lanzador de WhatsApp, que se reemplaza en los tests.
- **Docs:** `docs/arquitectura.html`, `apps/mobile/README.md`, `openspec/CAPACIDADES.md` y la nota en ADR 0024.
