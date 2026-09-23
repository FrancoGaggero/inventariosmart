# ADR 0009 · Modelos Dart escritos a mano, sin cliente generado desde OpenAPI

**Estado:** aceptada · 24/09/2026

## Contexto

El documento de arquitectura (§7 y §10) preveía generar el cliente Dart desde `docs/openapi.json`, como se hace con `packages/api-client` para TypeScript. La app Android del MVP (`mobile-mvp`) consume seis endpoints (`/me`, `/me/onboarding`, `/dashboard`, `/products`, `/products/:id`, `/movements`) con cinco formas de respuesta. El contrato ya lo custodia CI del lado TypeScript (`pnpm openapi` y la verificación de contrato desactualizado).

## Decisión

1. **Modelos a mano** en `apps/mobile/lib/core/modelos/`: clases inmutables con `fromJson`/`toJson`, montos como `String` decimal (igual que en la web), constantes de etiquetas y motivos copiadas de `packages/shared` (`etiquetaTipo`, `etiquetaMotivo`, `motivosPorTipo`, `etiquetaEstadoStock`).
2. **Tests unitarios con JSON del contrato** (`test/core/modelos_test.dart`, `test/fixtures.dart`): cada modelo se parsea desde un ejemplo copiado de `docs/openapi.json`, incluido el caso del EMPLEADO sin `costoReposicion`. Si un change toca uno de esos endpoints, actualiza el fixture y el modelo.
3. **Sin generador**: no se agrega `openapi_generator` ni `swagger_dart_code_generator` al monorepo.
4. **Cliente HTTP**: `dio` con un interceptor que adjunta el ID token de Firebase y un `ApiException` que traduce `{ code, message, details }`; los errores de red se muestran con el mensaje fijo en español y "Reintentar". `POST /movements` lleva `Idempotency-Key` generada por intento y conservada mientras el formulario no cambie.

## Alternativas consideradas

- **`openapi_generator` (Java):** produce decenas de archivos y modelos con `dynamic` para los `oneOf` del contrato (movimientos discriminados por tipo); exige Java en CI y en la máquina de desarrollo.
- **`swagger_dart_code_generator`:** genera modelos y cliente sobre `chopper`, pero suma `build_runner`, anotaciones y un segundo cliente HTTP.
- **Compartir tipos con `packages/shared`:** imposible sin un puente TS→Dart; los esquemas zod no se traducen automáticamente.

## Consecuencias

- Seis modelos y dos fixtures que mantener a mano; el costo es bajo mientras la app tenga cuatro pantallas. Si Fase 2 suma varios endpoints más, se reconsidera el generador.
- Los tests de widgets corren sin red ni Firebase: `AuthRepository` tiene una implementación falsa y `dio` usa un adaptador en memoria (`test/dio_falso.dart`) que responde por ruta y registra cabeceras.
- Google en Android necesita la huella SHA-1 registrada en Firebase y un `google-services.json` nuevo; hasta entonces el botón muestra un mensaje y el acceso con email y contraseña es el camino garantizado.
