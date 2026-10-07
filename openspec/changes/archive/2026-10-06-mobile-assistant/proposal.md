## Why

ADR 0024 puso el asistente con IA entre lo que va al celular, porque preguntar en lenguaje natural es lo más cómodo en un teléfono. La API ya responde, con tres endpoints y sus límites, pero la app no tiene cómo usarla. Un dueño PREMIUM que está en el local tiene que ir a la compu para preguntar "¿qué tengo que reponer?".

Esta change lleva **HU-08 "Asistente conversacional con IA"** (RF-10; RN-09) al celular. Es de la **Fase 3** y del plan **PREMIUM**. No cambia la API, la base ni el contrato OpenAPI: usa `POST /assistant/messages`, `GET /assistant/conversations` y `GET /assistant/conversations/:id` tal como están.

## What Changes

- **Entrada "Asistente" en "Más"**, en una sección propia y sólo para el DUENIO, igual que en la web:
  - con plan PREMIUM abre el chat;
  - con FREE o PRO muestra qué hace el asistente y que el plan se cambia desde la web, sin consultar la API;
  - el CONTADOR y el EMPLEADO no la ven, porque la API les responde 403.
- **Chat:**
  - **Conversación vacía:** "¿Qué querés saber?" y las cinco preguntas sugeridas de la web, que se envían al tocarlas.
  - **Mensajes:** burbujas de quien pregunta y del asistente. El texto del asistente se separa en párrafos y listas, sin `**` ni `#`, igual que en la web. Debajo va la línea "Consulté: …" con las consultas que hizo.
  - **Escritura:** campo con contador "N / 1.000"; no envía vacío ni con más de 1000 caracteres.
  - **Espera:** mientras el asistente responde, se ve la pregunta y "Consultando tus datos…".
  - **Aviso permanente:** las respuestas las genera una IA y conviene verificar los números importantes.
- **Orden en borrador:** cuando el asistente prepara un pedido, el mensaje muestra la tarjeta "Orden OC-0007 para {proveedor}". Aclara que es un borrador sin enviar y que se revisa y confirma desde Órdenes en la web (RN-06). El enlace a la orden dentro de la app llega con `mobile-orders`.
- **Historial:**
  - la pantalla "Conversaciones" lista las del dueño, de la más reciente a la más antigua, con su título y fecha ("hoy 14:32", "ayer", "12 sept"), y "Cargar más";
  - abrir una conversación muestra sus mensajes y permite seguirla;
  - "Nueva conversación" arranca de cero.
- **Errores con el texto que se escribió intacto:**
  - **límite diario alcanzado (429):** el mensaje de la API, "se renueva mañana";
  - **asistente no disponible (503):** "Tu consulta quedó escrita: probá de nuevo en unos minutos.";
  - **plan (402):** el aviso del plan;
  - **sin conexión:** el mensaje habitual de la app.
- **Tiempo de espera propio:** una respuesta puede hacer varias consultas al modelo. El envío espera hasta 3 minutos, más que los 60 segundos del resto de la app, y no muestra el aviso de "la API está despertando".

### Fuera de alcance

- **Abrir la orden en borrador desde el chat, confirmarla o enviarla:** llega con `mobile-orders`.
- **Respuestas en streaming y dictado por voz.**
- **Borrar o renombrar conversaciones:** la API no lo ofrece.
- **Contador de consultas restantes del día:** la API no lo expone; sólo avisa al llegar al límite.
- Cambios en la API, la web y el contrato.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `mobile-app`:
  - **Requisito nuevo "Asistente con IA en el celular":** chat, historial, orden en borrador, errores y plan.
  - **Requisito modificado "Pestaña Más":** suma la sección "Asistente", sólo para el DUENIO.
  - Las reglas, los permisos, el plan y el límite diario son los que ya fija `ai-assistant` (HU-08, RN-09); la app los muestra.

## Impact

- **Mobile (`apps/mobile`):**
  - **Modelos y textos:**
    - `lib/core/modelos/asistente.dart`: `MensajeAsistente`, `RespuestaAsistente`, `ConversacionResumen` y `ConversacionDetalle`;
    - `lib/core/asistente_formato.dart`: preguntas sugeridas, avisos, "Consulté: …", bloques de texto, fecha de la conversación, contador y aviso de cada error, portados de `apps/web/src/lib/asistente-formato.ts`;
    - `Me.tienePremium`.
  - **Pantallas:** `lib/features/asistente/`, con el chat, las conversaciones y sus providers.
  - **Navegación:** `features/mas/secciones.dart` y `app/router.dart` suman `/mas/asistente` y `/mas/asistente/conversaciones`, sólo para el DUENIO.
  - **Tiempo de espera:** `core/api_client.dart` permite indicarlo por pedido y que un pedido no encienda el aviso de "despertando".
- **Tests:** formato, modelos y widget tests del chat, el historial, los errores y los permisos.
- **Docs:** `docs/arquitectura.html` (la fila del asistente y la nota de la app), `apps/mobile/README.md` y `openspec/CAPACIDADES.md`.
- **Costo:** sin cambios. Las consultas desde el celular cuentan en el mismo límite diario del comercio que las de la web.
