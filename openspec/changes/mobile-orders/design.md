## Context

- **API** (sin cambios): `@Controller('purchase-orders')` con `@RequierePlan('PRO')` y `@Roles('DUENIO','CONTADOR')`; las rutas que escriben son sólo `DUENIO`.
  - `GET /purchase-orders?estado&cursor&limit` → `{items: OrdenResumen[], siguienteCursor}`.
  - `GET /purchase-orders/:id` → `OrdenCompra`. Incluye `proveedor{nombre, email, telefono, whatsapp, canal}`, `items[{id, producto{id, codigo, nombre, stockActual}, alertaId, cantidad, costoUnitarioNeto?, subtotal?}]`, `totalNeto`, `asunto`, `texto`, `canal`, `motivoNoEnvio` y `whatsappUrl`, además de las fechas.
  - `PATCH /purchase-orders/:id {items}` reemplaza la lista de líneas y sólo funciona en borrador.
  - `POST /purchase-orders/:id/confirm {canal?}`, `POST /purchase-orders/:id/mark-sent` y `POST /purchase-orders/:id/cancel`.
- **Respuestas de error:**
  - 409 "Sólo se puede modificar una orden en borrador.";
  - 400 `VALIDACION` con `details`, incluido `details.canal` cuando falta el dato del canal.
- **`whatsappUrl`:** el servidor lo arma sólo en una orden `CONFIRMADA` por `WHATSAPP` cuyo teléfono todavía sirve (ADR 0015, punto 7). El cliente no arma el enlace: lo abre en el gesto del usuario.
- **Textos de la web:** `apps/web/src/lib/canales.ts` (`textoConfirmar`, `avisoDeEnvio`, `fraseEnviada`, `canalesDe`) y las etiquetas de `packages/shared/src/ordenes.ts` y `whatsapp.ts` (`formatearWhatsApp`).
- **La app hoy:**
  - no tiene `url_launcher` ni pantallas de órdenes;
  - `rutaPermitida` exige `veAnalisis` (DUENIO o CONTADOR) para todo `/mas/...`, salvo el asistente;
  - la tarjeta `_TarjetaOrden` del asistente no es tocable;
  - el manifiesto principal no declara `INTERNET`, pero el combinado de release lo trae de los plugins de Firebase.

## Goals / Non-Goals

**Goals:**
- Mismos textos y reglas que la web, con funciones puras portadas y probadas con los casos de `canales.test.ts`.
- Que ninguna acción quede a medias. Si la API rechaza algo, se muestra su mensaje y la orden se vuelve a pedir.
- Que el enlace de WhatsApp sea siempre el que da el servidor.

**Non-Goals:**
- Edición completa del borrador: agregar productos, cambiar el proveedor y editar las notas o el texto se hacen en la web.
- Sugerencia o creación de órdenes.

## Decisions

### D1. Textos portados

`lib/core/ordenes_formato.dart` tiene:
- **las etiquetas:**
  - de estado: Borrador, Confirmada, Enviada y Cancelada;
  - de canal: Correo, WhatsApp y Otro medio;
  - de motivo de no envío: `SIN_EMAIL` y `ENVIO_FALLIDO`, con los textos de `shared`;
- `filtrosOrdenes`, con las etiquetas Todas, Borradores, Confirmadas, Enviadas y Canceladas;
- `formatearWhatsApp`: "5491123456789" → "+54 9 11 2345-6789";
- `canalesDe`, `textoConfirmar`, `avisoDeEnvio` y `fraseEnviada`, copiados de `canales.ts`;
- `fraseEstado(orden)`, para la frase de la cabecera según el estado;
- `textoParaCopiar(orden)`, que devuelve `asunto + "\n\n" + texto`.

`test/core/ordenes_formato_test.dart` repite los casos de `apps/web/src/lib/canales.test.ts`.

### D2. Modelos

`lib/core/modelos/ordenes.dart` tiene `ProveedorOrden`, `LineaOrden`, `OrdenResumen` y `OrdenCompra`, con los campos de arriba y montos como string, igual que el resto de la app.

En `Me` se suman `veOrdenes` (`veAnalisis`, en cualquier plan, como la sección) y `operaOrdenes` (`esDuenio`).

### D3. Providers

- **`filtroOrdenesProvider`:** un `Notifier<String>` con `TODAS` por defecto.
- **`ordenesProvider`:** un `AsyncNotifier` con `cargarMas()`, que pagina de a 25 con `Acumulado` y `ListaPaginada`. Si `!me.tienePro`, devuelve `null` y no consulta.
- **`ordenProvider(id)`:** un `FutureProvider.autoDispose.family`.
- **`accionesOrden`:** expone `guardar(id, items)`, `confirmar(id, canal?)`, `marcarEnviada(id)` y `cancelar(id)`, una función por acción. Cada una devuelve la `OrdenCompra` nueva o lanza `ApiException`. Si sale bien, invalida `ordenProvider(id)`, `ordenesProvider`, `alertasProvider`, `resumenAlertasProvider` y `dashboardProvider`, porque confirmar atiende las alertas. Si falla con 409, también invalida `ordenProvider(id)` para mostrar el estado real (CP-M.13j).

### D4. Detalle y edición del borrador

`OrdenScreen` es un `ConsumerStatefulWidget` que guarda una copia local de las líneas: `Map<productoId, cantidad>` más el orden original. Calcula `cambios` comparándola con la orden cargada.

- **Cada línea editable lleva:**
  - un campo numérico de cantidad (entero de 1 a 1.000.000; si no, el error del campo y "Guardar" deshabilitado);
  - un `IconButton` con el tooltip "Quitar".
  - No se puede quitar la última línea: la API pide al menos un producto. El aviso dice que para dejarla vacía hay que cancelarla.
- **"Guardar":** manda `PATCH {items: [{productoId, cantidad, alertaId?}]}` y avisa "Borrador guardado.".
- **El botón de confirmar:** si hay cambios sin guardar, primero guarda y después confirma, como la web. Su texto sale de `textoConfirmar(canalElegido ?? proveedor.canal)`.
- **"Enviar por":** si el proveedor tiene correo y WhatsApp, aparecen los chips Correo y WhatsApp. El canal se manda sólo si el dueño lo cambió.
- **El aviso de qué va a pasar** sale de `avisoDeEnvio`.
- **"Cancelar borrador":** pide confirmación con un `AlertDialog`: "¿Cancelar la orden {numero}? Se conserva como cancelada.", con los botones "Volver" y "Cancelar orden". Después vuelve al listado.
- **Después de confirmar,** el aviso depende de cómo quedó la orden:
  - ENVIADA: "Orden {n} enviada a {enviadaA}.";
  - WHATSAPP: "Orden {n} confirmada. Abrí WhatsApp para enviarle el mensaje a {proveedor}.";
  - si no, "Orden {n} confirmada. {motivo}".
- **Confirmada por WhatsApp:**
  - **si hay `whatsappUrl`:** el botón lleno "Abrir WhatsApp", con el aviso "Falta enviarla: abrí WhatsApp, mandale el mensaje a {proveedor} y después tocá \"Ya la envié\".";
  - **si la URL es `null`:** el aviso "El teléfono de {proveedor} ya no sirve para WhatsApp. Corregilo en el proveedor o copiá el texto y enviala por otro medio.".
- **Confirmada sin canal o con el correo fallido:** el motivo de no envío. En los dos casos de confirmada, "Copiar texto" y "Ya la envié", que avisa "Orden {n} marcada como enviada.".
- **El CONTADOR, y el DUENIO en una orden cerrada,** ven las líneas sin campos y sin botones de acción. "Copiar texto" está para todos cuando la orden no es borrador.

### D5. Abrir WhatsApp y copiar

- **`abrirEnlaceProvider`:** un `Provider<Future<bool> Function(Uri)>`. Por defecto llama a `launchUrl(uri, mode: LaunchMode.externalApplication)` de `url_launcher` y no consulta `canLaunchUrl` antes. Si devuelve `false`, la pantalla avisa "No se pudo abrir WhatsApp. Copiá el texto y envialo a mano.".
  - Los tests lo reemplazan y registran la URI.
- **Manifiesto:** suma `<queries><intent><action VIEW/><data scheme="https"/></intent></queries>` para Android 11+, por si una versión de `url_launcher` lo consulta.
- **Copiar:** `Clipboard.setData` de `flutter/services`, sin paquetes. Avisa "Texto copiado. Pegalo en WhatsApp o en tu correo.".
- **Alternativa descartada:** armar `wa.me` en el cliente. Duplicaría la normalización del teléfono y el recorte del mensaje de 3000 caracteres, que ya viven en `shared` y en el servidor (ADR 0015).

### D6. Rutas, "Más" y el asistente

- **Rutas:** `Rutas.ordenes = '/mas/ordenes'` y `/mas/ordenes/:id`, como subrutas de `/mas`. Ya las cubre la regla de `veAnalisis` de `rutaPermitida`, así que el EMPLEADO vuelve a su inicio.
- **"Más":** `seccionesMas` suma la sección "Compras", con la entrada "Órdenes de compra" y el detalle "Confirmalas y envialas por WhatsApp", si `me.veOrdenes`.
- **El asistente:** `_TarjetaOrden` pasa a ser un `InkWell` que hace `context.push('/mas/ordenes/${accion.ordenId}')`, con el chevron a la derecha. `borradorSinEnviar` pasa a "Borrador. Todavía no se envió: tocá para revisarla y confirmarla.". Si el comercio bajó de plan, el detalle muestra el aviso de PRO.

### D7. Manifiesto

`android/app/src/main/AndroidManifest.xml` declara `<uses-permission android:name="android.permission.INTERNET"/>` explícito. Hoy funciona porque lo aportan los plugins de Firebase en el manifiesto combinado. Declararlo evita que un cambio de dependencias rompa el APK de release sin que se note.

### D8. Tests

- **`ordenes_formato_test.dart`:** los casos de la web.
- **`modelos_test.dart`:** `OrdenCompra` con y sin costos, con y sin `whatsappUrl`, y la lista.
- **`ordenes_test.dart`**, con `ServidorFalso` y el abridor falso, cubre CP-M.13 a CP-M.13l. Verifica:
  - el cuerpo del PATCH con las líneas que quedaron;
  - el `canal` del confirm sólo cuando se eligió a mano;
  - la URI abierta, que es exactamente `whatsappUrl`;
  - el texto copiado, con un mock del canal de plataforma del portapapeles;
  - el 409 con recarga.
- **`mas_test.dart`:** CP-M.8h.
- **`asistente_test.dart`:** CP-M.12e, que al tocar la tarjeta abre el detalle.

## Risks / Trade-offs

- [Edición parcial: no se agregan productos desde el celular] → El aviso del borrador lo dice: para agregar productos o cambiar el proveedor, la web. Es el criterio de ADR 0024.
- [El dueño abre WhatsApp y no vuelve a tocar "Ya la envié"] → Es lo mismo que en la web (ADR 0015): la orden queda confirmada, con el aviso "Falta enviarla".
- [`url_launcher` falla en un celular sin WhatsApp] → `wa.me` abre el navegador, que ofrece WhatsApp Web o instalarlo. Si `launchUrl` devuelve `false`, el aviso ofrece copiar el texto.
- [Dos personas editan el mismo borrador] → La API responde 409 si la orden dejó de estar en borrador. Si sigue en borrador, gana el último que guarda, igual que en la web.

## Migration Plan

Sin migraciones de datos. La versión nueva usa la API desplegada. El permiso `INTERNET` explícito no cambia el comportamiento de los APK actuales.
