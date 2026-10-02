## 1. Base

- [x] 1.1 `planCumple`, `Me.veAnalisis`, `Me.tienePro` y `ApiException.esPlanRequerido` (D2). Listo cuando: `modelos_test.dart` y `api_exception_test.dart` cubren los tres planes, los tres roles y el 402
- [x] 1.2 Modelos de `analisis.dart` y bloques opcionales del panel en `dashboard.dart`; fixtures `alertaJson`, `quiebresJson`, `stockParadoJson` y `dashboardJson` con los bloques nuevos (D3). Listo cuando: `modelos_test.dart` lee los tres resultados con y sin `siguienteCursor`, con `SIN_HISTORIAL` y `ultimaVenta: null`, y el panel con los bloques y sin ellos
- [x] 1.3 `analisis_formato.dart` y `formatoPesosEntero` (D1). Listo cuando: `analisis_formato_test.dart` repite los casos de `apps/web/src/lib/quiebres-formato.test.ts` y `stock-parado-formato.test.ts`, cubre `fraseAlertas` y `formatearCobertura` con casos propios (la web no tiene test de `lib/alertas.ts`) y pasa

## 2. Navegación

- [x] 2.1 Rutas `/mas/alertas`, `/mas/quiebres` y `/mas/stock-parado` con `rutaPermitida` por `veAnalisis`; sección "Análisis" en `seccionesMas` (D5). Listo cuando: `mas_test.dart` cubre CP-M.8f (dueño y contador PRO con tres entradas, dueño FREE sólo con Alertas, empleado sin sección) y un test verifica que el EMPLEADO que abre `/mas/alertas` vuelve al inventario
- [x] 2.2 `MovimientoScreen` con `tipoInicial` desde `?tipo=` (D5). Listo cuando: `movimiento_test.dart` abre `/movimientos/nuevo?productoId=…&tipo=INGRESO` y ve el tipo Ingreso y el producto elegidos (CP-M.9c)
- [x] 2.3 `ui/aviso_plan.dart` (D6). Listo cuando: lo usan las tres pantallas y el inicio, y los tests de FREE lo encuentran

## 3. Pantallas

- [x] 3.1 Alertas: providers, pantalla y acciones (D4, D7). Listo cuando: `alertas_test.dart` cubre CP-M.9 (datos y frase), CP-M.9b (ATENDER y POSPONER con su cuerpo y su aviso), CP-M.9c, CP-M.9d (contador sin acciones), CP-M.9e (vacío), CP-M.9f (FREE sin pedidos a `/alerts`), CP-M.9g (409 con el mensaje) y "Cargar más"
- [x] 3.2 Falta de stock: provider con período y pantalla (D4, D7). Listo cuando: `quiebres_test.dart` cubre CP-M.10 ($ 4.000, "5,0 días", "Sin stock ahora"), CP-M.10b (`dias=90` en el pedido), CP-M.10c, CP-M.10f, CP-M.10g (FREE sin pedidos) y "Cargar más"
- [x] 3.3 Stock parado: provider con período y pantalla (D4, D7). Listo cuando: `stock_parado_test.dart` cubre CP-M.10d ($ 21.000, "120 días"), CP-M.10b (`dias=180`), CP-M.10e, CP-M.10f y CP-M.10g
- [x] 3.4 Inicio con tarjetas de análisis y bloque "Reposición" (D8). Listo cuando: `inicio_test.dart` cubre CP-M.11 (tarjetas que llevan a su pantalla), CP-M.11b (en cero no aparecen), CP-M.11c (tres filas, total y "Ver alertas") y CP-M.11d (FREE)
- [x] 3.5 Aislamiento (CP-M.10h). Listo cuando: un test verifica que ningún pedido de las tres pantallas lleva el comercio en la ruta ni en la query

## 4. Verificación y cierre

- [x] 4.1 Recorrido visual de las tres pantallas, el inicio con los bloques nuevos y "Más", en los dos temas, como dueño PRO, contador PRO y dueño FREE, con capturas de un test temporal que no se commitea (como en `mobile-redesign`). Listo cuando: no hay desbordes ni texto ilegible a 360 y 412 dp de ancho, y lo temporal quedó borrado
- [x] 4.2 `docs/arquitectura.html` (la tabla web y mobile y la nota de la app), `apps/mobile/README.md` (estructura y la regla de copiar los textos de la web) y `openspec/CAPACIDADES.md` (fila 29). Listo cuando: los documentos reflejan D1 a D8
- [x] 4.3 `flutter analyze --fatal-infos` y `flutter test` en `apps/mobile`, y `pnpm format:check` en la raíz; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [x] 4.4 Celular: Franco instala el APK con la cuenta demo "Lubricentro carfax" (PREMIUM) y compara alertas, falta de stock, stock parado y el inicio contra la web. Listo cuando: Franco confirma que los números coinciden
- [ ] 4.5 (manual, Franco) Anotar HU-06, HU-18 y HU-19 en mobile en Trello y en el backlog. Listo cuando: Trello y backlog lo reflejan
