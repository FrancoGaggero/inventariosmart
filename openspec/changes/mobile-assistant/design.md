## Context

- **La API**, sin cambios: `@Controller('assistant')` con `@Roles('DUENIO')` y `@RequierePlan('PREMIUM')`. Primero se controla el rol y después el plan, así que el CONTADOR recibe 403 antes que un 402.
- **Endpoints:**
  - `POST /assistant/messages {conversacionId?, mensaje}` → 201 `{conversacionId, mensaje: {id, rol, contenido, fuentes[{herramienta, nombre}], acciones[{tipo: 'ORDEN_BORRADOR', ordenId, numero, proveedor}], creadoEn}}`. Sin `conversacionId` crea una conversación. Sólo devuelve el mensaje del asistente.
  - `GET /assistant/conversations?cursor&limit` → `{items[{id, titulo, creadoEn, actualizadoEn}], siguienteCursor}`, de la más reciente a la más antigua.
  - `GET /assistant/conversations/:id` → `{id, titulo, creadoEn, actualizadoEn, mensajes[]}`, en orden. Si la conversación no es del usuario, 404.
- **Errores:**
  - 400 `VALIDACION`, con `details.mensaje`;
  - 402 `PLAN_REQUERIDO`;
  - 429 `LIMITE_ALCANZADO`, con el mensaje "…Se renueva mañana.";
  - 503 `SERVICIO_NO_DISPONIBLE`.
- **Tiempos:** cada llamada al modelo tiene 30 s de límite y una respuesta puede hacer hasta seis consultas más una vuelta final. En el peor caso pasa del minuto.
- **La web:** `apps/web/src/lib/asistente-formato.ts` tiene los textos (`PREGUNTAS_SUGERIDAS`, `AVISO_IA`, `AVISO_PLAN`, `fraseFuentes`, `bloquesDeTexto`, `fechaDeConversacion`, `contadorDeCaracteres`, `excedeElLargo`, `puedeEnviar` y `avisoDeError`) y su test.
- **La app:**
  - `dioProvider` tiene `receiveTimeout` de 60 s y un contador de pedidos en curso que enciende `apiDespertandoProvider` a los 5 s.
  - **Defecto encontrado:** el temporizador se cancela pero no vuelve a `null`. Como `??=` no lo recrea, el aviso de "despertando" sólo puede aparecer una vez por sesión.
  - `features/mas/secciones.dart` tiene una sección "Análisis", y `rutaPermitida` exige `veAnalisis` para todo `/mas/...`.
  - No hay pantalla de órdenes ni `url_launcher`.

## Goals / Non-Goals

**Goals:**
- Mismos textos y mismo comportamiento que la web, con los formatos portados a funciones puras de Dart y probados con los casos de la web.
- Que una respuesta larga no corte por tiempo ni encienda un aviso que no corresponde.
- Que un error nunca borre lo que el dueño escribió.

**Non-Goals:**
- No hay estado local persistente del chat: si la app se cierra, la conversación se recupera desde "Conversaciones".
- No hay reintento automático del envío: cada consulta gasta del límite diario y de la cuenta de la IA.

## Decisions

### D1. Textos portados de la web

`lib/core/asistente_formato.dart` es copia de `apps/web/src/lib/asistente-formato.ts`:
- **Constantes:** `preguntasSugeridas` (las cinco), `avisoIa` y `avisoPlanAsistente`.
- **Envío:** `contadorDeCaracteres` ("120 / 1.000"), `excedeElLargo` (más de 1000 después de recortar) y `puedeEnviar`.
- **Respuestas:**
  - `fraseFuentes`: "Consulté: a, b y c.", sin repetidos;
  - `bloquesDeTexto`: separa párrafos de listas con `-`, `•`, `*`, `1.` o `1)` y quita `**` y `#`.
- **Historial:** `fechaDeConversacion`: "hoy 14:32", "ayer" o "12 sept", en hora local.
- **Errores:** `avisoDeError(status, mensaje)` devuelve tono y texto para 402, 429 y 503, y el mensaje de la API en otro caso.

`test/core/asistente_formato_test.dart` repite los casos de `apps/web/src/lib/asistente-formato.test.ts`.

**Alternativa descartada:** renderizar Markdown con un paquete, por ejemplo `flutter_markdown`. Suma una dependencia y mostraría tablas o enlaces que las instrucciones del asistente prohíben. `bloquesDeTexto` da lo mismo que la web.

### D2. Modelos

`lib/core/modelos/asistente.dart` tiene:
- `FuenteAsistente {herramienta, nombre}`;
- `AccionAsistente {tipo, ordenId, numero, proveedor}`, que ignora un tipo desconocido para tolerar tipos futuros;
- `MensajeAsistente {id, rol, contenido, fuentes, acciones, creadoEn}`;
- `RespuestaAsistente {conversacionId, mensaje}`;
- `ConversacionResumen {id, titulo, actualizadoEn}`;
- `ConversacionDetalle {id, titulo, mensajes}`.

`Me.tienePremium` es `planCumple(plan, 'PREMIUM')`, y `Me.usaAsistente` es `esDuenio`.

### D3. Estado del chat

`chatProvider` es un `Notifier<EstadoChat>`. Arranca vacío y no es `autoDispose`, para que el chat sobreviva al ir y volver de "Más".

**`EstadoChat` tiene:**
- `conversacionId?`;
- `mensajes: List<MensajeAsistente>`;
- `enviando: bool`;
- `pendiente: String?`, la pregunta que se está enviando, que se dibuja como burbuja mientras se espera;
- `aviso: AvisoAsistente?`;
- `borrador: String`, el texto del campo, para que un error no lo pierda.

**`enviar(texto)`:**
- si `!puedeEnviar`, no hace nada;
- si no, marca `enviando` y `pendiente`, y hace el POST con `conversacionId` si hay;
- **si sale bien:** agrega la pregunta como mensaje `USUARIO` armado localmente (la API no lo devuelve) y la respuesta; guarda `conversacionId`; limpia `borrador` e invalida `conversacionesProvider`;
- **si falla:** deja `borrador = texto` y `aviso = avisoDeError(status, message)`, y no agrega mensajes.

**Las otras acciones:**
- `abrir(id)` carga el detalle con `GET /conversations/:id` y reemplaza los mensajes. Mientras carga, el chat muestra `Cargando`; si falla, `ErrorConReintento`.
- `nueva()` limpia todo menos el borrador.

**Las conversaciones:** `conversacionesProvider` es un `AsyncNotifier`. Pagina de a 25 con `Acumulado` y `ListaPaginada`, como las alertas, y devuelve `null` si `!me.tienePremium`, sin consultar.

**Alternativa descartada:** pedir el detalle de nuevo después de cada envío. Es un pedido más por mensaje para obtener lo mismo que ya está en memoria. La web también suma los mensajes en memoria.

### D4. Tiempo de espera y aviso de "despertando"

- **El envío:** usa `Options(receiveTimeout: Duration(minutes: 3), extra: {'sinAvisoDespertar': true})`. El tiempo de espera cubre el peor caso de la API (siete llamadas de hasta 30 s), con margen.
- **El interceptor:** no cuenta los pedidos marcados con `sinAvisoDespertar`. El chat tiene su propio indicador, "Consultando tus datos…", y "la API está despertando" confundiría.
- **El defecto del temporizador:** se corrige asignando `temporizador = null` al terminar el último pedido. Así el aviso de CP-M.5b vuelve a funcionar en toda la sesión, no sólo la primera vez. Lo cubre un test con dos pedidos lentos sucesivos.
- **Alternativa descartada:** subir el `receiveTimeout` global a 3 minutos. Una pantalla común sin red tardaría tres minutos en mostrar "Reintentar".

### D5. Navegación y permisos

- **Las rutas:** `Rutas.asistente = '/mas/asistente'` y `Rutas.conversaciones = '/mas/asistente/conversaciones'`, como subrutas de `/mas`.
- **Los permisos:** `rutaPermitida` resuelve `/mas/asistente` antes que la regla general de `/mas/` y exige `me.usaAsistente`. El CONTADOR, que sí ve "Análisis", no entra al asistente (CP-M.8g).
- **"Más":** `seccionesMas` suma, después de "Análisis", la sección "Asistente" con la entrada "Asistente con IA" y el detalle "Preguntale por tu negocio", sólo para el DUENIO y en cualquier plan.
- **El plan:** se resuelve en la pantalla con `AvisoPlan(avisoPlanAsistente)` (CP-M.12j), como las pantallas PRO. `AvisoPlan` deja de decir "PRO" en su comentario.

### D6. Pantallas

**Chat** (`features/asistente/asistente_screen.dart`):
- **Barra superior:** el título "Asistente" y dos botones de ícono, "Conversaciones" (`history`) y "Nueva conversación" (`edit_square`). El de nueva conversación queda deshabilitado si el chat está vacío o enviando.
- **Cuerpo:** un `ListView` que se desplaza al final al agregar mensajes, con `ScrollController` y `animateTo` después del cuadro.
  - **Vacío:** "¿Qué querés saber?" y las preguntas sugeridas, que envían al tocarlas. **Ajuste de la implementación:** van como botones de ancho completo con hasta dos líneas y no como `ActionChip`, porque a 360 dp la pregunta más larga no entraba en un chip.
  - **Burbujas:**
    - las del usuario van a la derecha, en `brand` al 18 % con texto `t1`;
    - las del asistente van a la izquierda, en `card`, con los bloques de D1;
    - debajo de cada respuesta va la tarjeta de cada acción y la línea "Consulté: …" en `t2`;
    - `Semantics` antepone "Vos:" o "Asistente:" para lectores de pantalla.
  - **Mientras envía:** la burbuja `pendiente` y una burbuja del asistente con "Consultando tus datos…", con `liveRegion`.
- **Pie, fijo sobre el teclado:**
  - el `Aviso` del error si lo hay, con tono `warn` para 429 y 503, `AvisoPlan` para 402 y `error` en otro caso;
  - el campo multilínea, con "Escribí tu consulta…" y hasta 5 líneas visibles;
  - el contador, en `crit` si excede;
  - el botón de enviar (`IconButton.filled`, tooltip "Enviar");
  - el aviso de IA en 11 px y `t2`.
  - En el teclado, la tecla de acción es salto de línea, y se envía con el botón. En un teclado de celular, Enter para enviar haría imposibles las listas.
- **La tarjeta de orden:** "Orden {numero} para {proveedor}" y "Borrador. Todavía no se envió: revisala y confirmala desde Órdenes en la web.". No es tocable hasta `mobile-orders`, que la convertirá en enlace.

**Conversaciones** (`features/asistente/conversaciones_screen.dart`):
- lista de tarjetas con el título y `fechaDeConversacion(actualizadoEn)`;
- vacío: "Todavía no hay conversaciones.";
- "Cargar más" y `RefreshIndicator`;
- al tocar una, `chat.abrir(id)` y `context.pop()` vuelve al chat.

### D7. Tests

- **Formato:** `asistente_formato_test.dart` con los casos de la web.
- **Modelos:** `modelos_test.dart` suma la respuesta con fuentes y acciones, una acción de tipo desconocido, la lista y el detalle.
- **`asistente_test.dart`**, con `ServidorFalso`, cubre:
  - CP-M.12, con el cuerpo del POST sin `conversacionId` y la frase de fuentes;
  - CP-M.12b, los bloques;
  - CP-M.12c, el segundo POST con el `conversacionId` devuelto;
  - CP-M.12d, el contador y el botón deshabilitado;
  - CP-M.12e, la tarjeta;
  - CP-M.12f, la lista ordenada, abrir y seguir;
  - CP-M.12g, nueva conversación;
  - CP-M.12h y CP-M.12i, el texto conservado y el aviso;
  - CP-M.12j, PRO sin pedidos;
  - CP-M.12k, ningún pedido con el comercio o el usuario.
  - **Espera:** el `ServidorFalso` demora la respuesta con un `Completer` para verificar "Consultando tus datos…".
- **"Más" y router:** `mas_test.dart` suma CP-M.8g.
- **Cliente HTTP:** `api_client_test.dart`, nuevo, verifica que el aviso de "despertando" se enciende en dos pedidos lentos sucesivos y no se enciende con `sinAvisoDespertar`. Usa `fakeAsync` sobre el interceptor.

## Risks / Trade-offs

- [Una respuesta tarda hasta un par de minutos y el dueño cierra la pantalla] → El POST sigue en el `Notifier`, que no es `autoDispose`. Al volver, la respuesta ya está o sigue "Consultando…". Si la app se cierra, la respuesta queda guardada en la API y aparece en "Conversaciones".
- [Doble envío por tocar dos veces] → `enviar` no hace nada mientras `enviando` es verdadero, y el botón está deshabilitado.
- [Las frases de Dart se desvían de las de la web] → Los mismos casos de test, y la regla del README de la app (ADR 0024).
- [La orden en borrador sin enlace frustra] → El texto dice dónde confirmarla. `mobile-orders` la convierte en enlace.
- [El límite diario es por comercio y no por persona] → El mensaje de la API lo dice. No hay cambio de comportamiento respecto de la web.

## Migration Plan

No hay datos ni API que migrar. La versión nueva de la app usa la API ya desplegada. Para volver atrás, se revierte el commit.
