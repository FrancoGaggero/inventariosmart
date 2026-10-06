## 1. Base

- [x] 1.1 `asistente_formato.dart` (D1). Listo cuando: `asistente_formato_test.dart` repite los casos de `apps/web/src/lib/asistente-formato.test.ts` y pasa
- [x] 1.2 Modelos de `asistente.dart`, `Me.tienePremium` y `Me.usaAsistente`; fixtures `respuestaAsistenteJson`, `conversacionesJson` y `conversacionJson` (D2). Listo cuando: `modelos_test.dart` lee la respuesta con fuentes y acciones, ignora una acción de tipo desconocido y lee la lista y el detalle
- [x] 1.3 Tiempo de espera por pedido, `sinAvisoDespertar` y el temporizador que vuelve a `null` (D4). Listo cuando: `api_client_test.dart` verifica el aviso en dos pedidos lentos sucesivos y que no se enciende con `sinAvisoDespertar`

## 2. Navegación

- [x] 2.1 Rutas `/mas/asistente` y `/mas/asistente/conversaciones`, `rutaPermitida` por `usaAsistente` y sección "Asistente" en `seccionesMas` (D5). Listo cuando: `mas_test.dart` cubre CP-M.8g (dueño PRO la ve; contador y empleado PREMIUM no, y vuelven a su inicio si abren la ruta) y los tests de "Análisis" siguen pasando

## 3. Pantallas

- [x] 3.1 `chatProvider` y `conversacionesProvider` (D3). Listo cuando: los tests de 3.2 y 3.3 los ejercitan, incluido el doble toque que no repite el POST
- [x] 3.2 Pantalla del chat (D6). Listo cuando: `asistente_test.dart` cubre CP-M.12, CP-M.12b, CP-M.12c, CP-M.12d, CP-M.12e, CP-M.12h, CP-M.12i, CP-M.12j y CP-M.12k
- [x] 3.3 Pantalla de conversaciones (D6). Listo cuando: `asistente_test.dart` cubre CP-M.12f (orden, "hoy" y "ayer", abrir y seguir con el mismo `conversacionId`), CP-M.12g y "Cargar más"

## 4. Verificación y cierre

- [x] 4.1 Recorrido visual del chat vacío, con respuesta y lista, con orden en borrador, esperando y con error, y de las conversaciones y el aviso PREMIUM, en los dos temas a 360 y 412 dp, con capturas de un test temporal que no se commitea. Listo cuando: no hay desbordes, el pie no queda tapado por el teclado (con `viewInsets` simulados) y lo temporal quedó borrado
- [x] 4.2 `docs/arquitectura.html` (la fila del asistente y una nota de la app), `apps/mobile/README.md` (estructura y textos del asistente) y `openspec/CAPACIDADES.md` (fila 30). Listo cuando: los documentos reflejan D1 a D6
- [x] 4.3 `flutter analyze --fatal-infos` y `flutter test` en `apps/mobile`, y `pnpm format:check` en la raíz; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 4.4 Celular: Franco instala el APK con la cuenta demo PREMIUM, pregunta "¿Qué productos tengo que reponer?" y "¿tengo plata parada en productos que no se venden?", abre la conversación desde "Conversaciones" y la sigue. Gasta del límite diario y de la cuenta de la IA, unos centavos. Listo cuando: Franco confirma que las respuestas dicen "Consulté: …" y que coinciden con la web
- [ ] 4.5 (manual, Franco) Anotar HU-08 en mobile en Trello y en el backlog. Listo cuando: Trello y backlog lo reflejan
