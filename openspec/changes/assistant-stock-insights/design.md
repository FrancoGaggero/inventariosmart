## Context

El asistente consulta con herramientas acotadas que reutilizan servicios de la API dentro del comercio del request (ADR 0018). `StockoutsService.listar` y `DeadStockService.listar` ya devuelven totales y una lista paginada ordenada, y sus módulos exportan el servicio. Las dos funcionalidades son del plan PRO, así que todo comercio con asistente (PREMIUM) las tiene. Motivación: ver proposal.md.

## Goals / Non-Goals

**Goals:**
- Que el asistente informe exactamente las mismas cifras que las páginas, sin un cálculo propio.

**Non-Goals:**
- Endpoints o cambios de contrato.

## Decisions

### D1. Las consultas llaman a `listar` con `limit: 10` y sin cursor

Se reutiliza la primera página del servicio, que ya trae los totales sobre todos los productos. El resultado para el modelo se arma con los campos que necesita para responder. Los ids de producto se mantienen, por si después quiere comparar proveedores o preparar una orden.

- *Alternativa:* un método nuevo de "resumen" en cada servicio. Se descarta porque `listar` ya hace exactamente eso y un segundo método duplicaría el orden y los totales.

### D2. Entrada con enums numéricos validados por zod

`dias` se valida contra los valores de cada página (`DIAS_QUIEBRES` y `DIAS_STOCK_PARADO`) y tiene default. Un valor inválido vuelve al modelo como error, igual que las otras consultas. No se reutiliza `StockoutsQuerySchema` porque acepta strings (`z.coerce`) para la query HTTP, y el modelo manda números.

### D3. Instrucciones

Se suma un párrafo a "De dónde salen los datos":
- Falta de stock es para "lo que dejé de vender o de ganar por no tener stock", y la cifra es una estimación.
- Stock parado es para "lo que no se vende" o la "plata inmovilizada".
- Si una fila no tiene historial, no se da cifra.
- Si el dueño pide ideas, el asistente puede sugerir en una frase alguna de las que muestra la página: promoción, combo, devolución o baja.

La sugerencia de qué hacer no lleva cifras propias.

### Módulos afectados

- `assistant`: `herramientas.ts`, `instrucciones.ts` y `assistant.module.ts`, que importa `StockoutsModule` y `DeadStockModule`.
- `packages/shared`: `asistente.ts`, con las claves y los nombres legibles. Hay que recompilar `dist`.
- Sin cambios de base, OpenAPI ni ADR nuevo: la decisión de sumar consultas está en ADR 0018, que suma una nota fechada.

## Risks / Trade-offs

- [El modelo confunde stock parado con falta de stock] → Las descripciones dicen explícitamente para qué pregunta es cada una y para cuál no. Hay un caso con el modelo real (CP-08.8b) que se corre con aviso.
- [El e2e del asistente sigue creciendo] → Los datos de los dos casos se arman en un comercio propio dentro de un `describe`, como en `assistant-top-sellers`.
