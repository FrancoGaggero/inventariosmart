# ADR 0001 · Monolito modular NestJS con una única API REST

**Estado:** aceptada · 09/09/2026

## Contexto

InventarioSmart tiene dos clientes (web React y app Android Flutter) y un único desarrollador. RNF-05 exige una arquitectura modular que permita escalar módulos de forma independiente; RNF-04 exige respuestas en menos de 3 segundos. El registro de una venta debe descontar stock y crear el movimiento de forma atómica (RN-07).

## Decisión

Un solo backend NestJS, organizado en un módulo por historia de usuario (products, movements, suppliers, expenses, profitability, dashboard, import, …), que expone una única API REST versionada en `/api/v1` consumida por ambos clientes.

## Alternativas consideradas

- **Microservicios desde el inicio:** cumple RNF-05 al pie de la letra, pero multiplica despliegues, exige sagas o colas para la transacción de stock y no es sostenible para una persona en el plazo de la tesis.
- **Backend por cliente (BFF web y BFF mobile):** duplica lógica de negocio y reglas RN-xx; la diferencia entre clientes es de pantallas, no de datos.
- **Express sin framework:** sin estructura modular impuesta, más difícil de mantener y documentar (RNF-07).

## Consecuencias

- Un despliegue, un contrato OpenAPI, transacciones simples en PostgreSQL.
- Cada módulo se prueba y documenta por separado; si uno necesita escalar (por ejemplo el asistente IA) se extrae detrás del mismo contrato.
- El proyecto queda en NestJS 11 mientras la línea 12 (sólo ESM) no sea compatible con Jest en Node 22 (ver design.md D11 de la change sprint0-esqueleto).
