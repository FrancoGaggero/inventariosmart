## 1. Contrato compartido y configuración

- [x] 1.1 `packages/shared/src/asistente.ts` (D6, D7): esquemas de mensaje, conversación, fuentes y acciones, límites y los códigos `LIMITE_ALCANZADO` y `SERVICIO_NO_DISPONIBLE`; exportado en `index.ts` y `dist` reconstruido. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con mensaje vacío, de 1.000 y de 1.001 caracteres
- [x] 1.2 Variables `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` y `ASISTENTE_LIMITE_DIARIO` en `config/env.ts` y `.env.example`; dependencia `@anthropic-ai/sdk`. Listo cuando: `env.spec.ts` pasa con y sin clave y la API arranca sin ella

## 2. Base de datos

- [x] 2.1 Migración `20261002_ai_assistant` con `conversacion` y `mensaje_asistente`, índices, RLS y permisos (D5); modelos en `TENANT_MODELS`. Listo cuando: `rls.e2e-spec.ts` cubre las dos tablas y pasa, y `app_api` no puede actualizar ni borrar mensajes

## 3. API

- [x] 3.1 `ModeloAsistente`, `ModeloAnthropic` y `ModeloFalso` (D1). Listo cuando: el test unitario del adaptador pasa con el SDK simulado, incluido el tiempo límite y la falta de clave
- [x] 3.2 Herramientas de consulta (D2) con esquema de entrada y resultado recortado. Listo cuando: los tests unitarios cubren entrada inválida, recorte a 10 filas y que `buscar_proveedores` no devuelve correo, teléfono ni CUIT
- [x] 3.3 Herramienta `preparar_orden` (D2). Listo cuando: CP-08.3 y CP-08.3b pasan y no se registra ningún envío
- [x] 3.4 `AssistantService.responder` con el ciclo de D3 y las instrucciones de D4. Listo cuando: CP-08.1, CP-08.1b, CP-08.1c y CP-08.2 pasan con el modelo guionado, y el tope de 6 consultas tiene su test
- [x] 3.5 Historial: listar y obtener conversaciones del usuario. Listo cuando: CP-08.1d pasa y un usuario no ve las conversaciones de otro del mismo comercio
- [x] 3.6 Límite diario y disponibilidad (D6). Listo cuando: CP-08.5c y CP-08.5d pasan y el 503 no descuenta del límite
- [x] 3.7 `AssistantController` y DTOs Swagger (D7) con `@RequierePlan('PREMIUM')` y `@Roles('DUENIO')`; módulo en `AppModule`. Listo cuando: CP-08.5, CP-08.5b y CP-08.5e pasan
- [x] 3.8 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene las tres rutas de `/assistant` y CI no reporta contrato desactualizado

## 4. Web

- [x] 4.1 `lib/asistente.ts` y `lib/asistente-formato.ts` con test (D8). Listo cuando: el test de los textos pasa sin variables de entorno, como en CI
- [x] 4.2 `AsistentePage` en `/asistente` con chat, preguntas sugeridas, fuentes, acción de orden, avisos de 429 y 503, aviso de IA y aviso de plan; enlace en la navegación. Listo cuando: CP-08.6 y CP-08.6b se ven en la web y la página no desborda a 360, 768 y 1280 px en los dos temas

## 5. Modelo real

- [ ] 5.1 (manual, Franco) Crear la clave en la consola de Anthropic y cargarla en `apps/api/.env` y en Render, sin pegarla en el chat ni en el repo. Listo cuando: `POST /assistant/messages` deja de responder 503 en local y en producción
- [ ] 5.2 Suite `assistant.live-spec.ts` con el modelo real, fuera de CI (D9). Listo cuando: CP-08.1, CP-08.2b, CP-08.2c, CP-08.4 y CP-08.4b pasan en local con la clave cargada

## 6. Documentación y cierre

- [x] 6.1 ADR 0018, README, `docs/arquitectura.html`, `docs/ARRANQUE.md` y `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D10
- [ ] 6.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 6.3 Producción: Franco pregunta por su producto más rentable, por lo que tiene que reponer y algo ajeno al negocio, y pide un pedido a un proveedor. Listo cuando: CP-08.1, CP-08.3, CP-08.4 y CP-08.6 se cumplen en `https://inventariosmart0.vercel.app` y la orden queda en borrador en la base de producción
- [ ] 6.4 (manual, Franco) Mover HU-08 a Hecho en Trello y actualizar el backlog y el Gantt. Listo cuando: Trello, backlog y Gantt coinciden
