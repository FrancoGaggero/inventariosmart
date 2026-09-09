# ADR 0004 · OpenAPI generado desde el código como contrato entre API, web y mobile

**Estado:** aceptada · 09/09/2026

## Contexto

Dos clientes en lenguajes distintos (TypeScript y Dart) consumen la misma API. Un cambio en una ruta o en un campo debe detectarse en compilación, no en producción (RNF-07).

## Decisión

`@nestjs/swagger` genera el documento OpenAPI 3 a partir de los controladores y DTOs. El script `pnpm openapi` lo exporta a `docs/openapi.json`, versionado en el repositorio; CI falla si el archivo no coincide con el código. Desde ese archivo se generan:

- `packages/api-client`: tipos TypeScript (`openapi-typescript`) y cliente `openapi-fetch` para la web.
- Cliente Dart (`openapi-generator`) para la app, a partir de la change `mobile-mvp`.

Convenciones fijadas: paginación por cursor, errores `{ code, message, details }` con mensaje en español, montos `decimal(14,2)` como string, fechas ISO 8601, `Idempotency-Key` en `POST /movements`.

## Alternativas consideradas

- **GraphQL:** flexible, pero complica caché, permisos por campo y el cliente Dart.
- **tRPC:** excelente para TypeScript, inútil para Flutter.
- **Documentación manual:** se desactualiza; nadie la mantiene en un equipo de una persona.

## Consecuencias

- Swagger UI disponible en `/docs` en todos los entornos.
- Todo endpoint nuevo requiere DTOs decorados; es un costo pequeño que paga la generación de clientes.
