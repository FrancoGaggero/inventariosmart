## 1. Base

- [x] 1.1 `ordenes_formato.dart` (D1). Listo cuando: `ordenes_formato_test.dart` repite los casos de `apps/web/src/lib/canales.test.ts`, cubre `fraseEstado` y `formatearWhatsApp`, y pasa
- [x] 1.2 Modelos de `ordenes.dart`, `Me.veOrdenes` y `Me.operaOrdenes`, y fixtures `ordenResumenJson` y `ordenJson` (D2). Listo cuando: `modelos_test.dart` lee el resumen y el detalle con costos `null`, sin `whatsappUrl` y con él
- [x] 1.3 `url_launcher` en `pubspec.yaml`, `abrirEnlaceProvider`, y en el manifiesto `INTERNET` explícito y la consulta de `https` (D5, D7). Listo cuando: `flutter analyze --fatal-infos` pasa y `flutter build apk --debug` compila

## 2. Navegación

- [x] 2.1 Rutas `/mas/ordenes` y `/mas/ordenes/:id`, y sección "Compras" en `seccionesMas` (D6). Listo cuando: `mas_test.dart` cubre CP-M.8h y los tests de "Análisis" y "Asistente" siguen pasando

## 3. Pantallas

- [x] 3.1 Providers del listado, del detalle y de las acciones (D3). Listo cuando: los tests de 3.2 y 3.3 los ejercitan, incluida la invalidación de alertas y del panel después de confirmar
- [x] 3.2 Listado con filtro, "Cargar más", vacío y aviso de PRO (D3). Listo cuando: `ordenes_test.dart` cubre CP-M.13, CP-M.13k y CP-M.13l
- [x] 3.3 Detalle con la edición del borrador, el canal, confirmar, "Abrir WhatsApp", "Ya la envié", copiar, cancelar y los permisos (D4, D5). Listo cuando: `ordenes_test.dart` cubre CP-M.13b a CP-M.13j
- [x] 3.4 La tarjeta del asistente lleva al detalle (D6). Listo cuando: `asistente_test.dart` cubre CP-M.12e: tocar la tarjeta abre `/mas/ordenes/<ordenId>`

## 4. Verificación y cierre

- [x] 4.1 Recorrido visual del listado, un borrador en edición, una confirmada por WhatsApp, una enviada y la vista del contador, en los dos temas a 360 y 412 dp, con capturas de un test temporal que no se commitea. Listo cuando: no hay desbordes y lo temporal quedó borrado
- [x] 4.2 Nota en ADR 0024 (editar un producto queda en la web), `docs/arquitectura.html`, `apps/mobile/README.md` y `openspec/CAPACIDADES.md` (fila 32). Listo cuando: los documentos reflejan D1 a D7
- [ ] 4.3 `flutter analyze --fatal-infos` y `flutter test` en `apps/mobile`, y `pnpm format:check` en la raíz; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 4.4 Celular: Franco crea un borrador con el asistente o en la web, lo abre desde la tarjeta del asistente, cambia una cantidad, confirma por WhatsApp, abre WhatsApp y marca "Ya la envié", y comprueba en la web que quedó igual. Listo cuando: Franco confirma que el mensaje llegó a WhatsApp con el texto de la orden
- [ ] 4.5 (manual, Franco) Anotar HU-07 y HU-16 en mobile en Trello y en el backlog. Listo cuando: Trello y backlog lo reflejan
