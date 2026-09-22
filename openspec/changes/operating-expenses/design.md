## Context

Existen `stock-movements` (tabla `movimiento` con `tipo`, `cantidad`, `fecha`, `anulado_por_id`) y el patrón de módulo de negocio (extensión de tenant, RLS forzada, `ZodValidationPipe`, errores `{ code, message, details }`, cursor `{ items, siguienteCursor }`, `comoPropietaria` en tests). El DER del documento de arquitectura ya prevé `Gasto` con `tipo (FIJO|VARIABLE) · importe · periodo · periodicidad`. Los roles: EMPLEADO recibe 403 en gastos (CP-11.4), CONTADOR lectura. La web tiene `AppShell`, `Campo`, `Aviso`, selects con la clase de `MovimientoFormPage`. Comportamiento en `specs/operating-expenses`; motivación en proposal.md.

## Goals / Non-Goals

**Goals:**
- Fuente única del prorrateo de RN-02: `ExpensesService.resumen(periodo)`, que HU-03 y HU-04 llamarán tal cual.
- Regla de aplicabilidad por mes en una función pura y testeable (`aplicaAlMes`), compartida por listado y resumen.
- Listado mensual pequeño (decenas de gastos), sin cursor: la Propuesta no prevé volúmenes grandes de gastos.

**Non-Goals:**
- Margen por producto, dashboard, categorías configurables, comprobantes, sucursales, mobile.

## Decisions

**D1 · Modelo `Gasto` (tabla `gasto`).**

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id`, `comercio_id` | uuid | RLS; índice `(comercio_id, periodo)` |
| `concepto` | varchar(120) | |
| `tipo` | enum `tipo_gasto` (`FIJO`, `VARIABLE`) | |
| `importe` | decimal(14,2) > 0 | neto sin IVA (RN-03); `CHECK` |
| `periodo` | date | primer día del mes de inicio; en la API viaja como `YYYY-MM` |
| `periodicidad` | enum `periodicidad_gasto` (`UNICO`, `MENSUAL`, `ANUAL`) | |
| `fin` | date nullable | primer día del último mes en que aplica; sólo recurrentes; `CHECK (fin IS NULL OR fin >= periodo)` |
| `notas` | varchar(300) nullable | |
| `usuario_id` | uuid | quién lo cargó |
| `creado_en`, `actualizado_en` | timestamptz | |

Privilegios normales (`SELECT, INSERT, UPDATE, DELETE`): los gastos se corrigen y borran. Alternativa descartada: `periodo` como `char(7)`; `date` permite comparar con `<=` y usar índices sin conversiones.

**D2 · Aplicabilidad e importe del mes (`aplicaAlMes(gasto, mes)` en `packages/shared`).**
`mes` es `YYYY-MM`. `UNICO`: aplica si `periodo === mes`, importe completo. `MENSUAL`: aplica si `periodo <= mes` y (`fin` nulo o `fin >= mes`), importe completo. `ANUAL`: aplica si `periodo <= mes < periodo + 12 meses` y (`fin` nulo o `fin >= mes`), importe `importe / 12` redondeado a 2 decimales (la diferencia de centavos por redondeo se acepta). Función pura con tests unitarios; el servicio filtra en SQL sólo por `periodo <= mes` (y `fin`) y aplica la función en memoria. Alternativa descartada: expandir cada gasto recurrente en filas por mes; complica la edición y no aporta para el volumen previsto.

**D3 · Unidades vendidas del mes.**
`SELECT COALESCE(SUM(cantidad), 0) FROM movimiento WHERE comercio_id = $1 AND tipo = 'VENTA' AND anulado_por_id IS NULL AND fecha >= inicio AND fecha < inicio + 1 mes`. Los límites del mes se calculan en la zona `America/Argentina/Buenos_Aires` (`inicio = fecha local 00:00 del día 1` convertida a UTC) para que una venta a las 23:30 del 30 no caiga en el mes siguiente. Se lee `movimiento` directo por Prisma dentro de la transacción de tenant (RLS activa); `ExpensesModule` no importa `MovementsModule`.

**D4 · Resumen (`GET /expenses/summary?periodo=`).**
`{ periodo, totalFijos, totalVariables, total, unidadesVendidas, gastoPorUnidad, motivo }`, montos como string decimal. `gastoPorUnidad = total / unidadesVendidas` redondeado a 2 decimales; `null` con `motivo: 'SIN_GASTOS'` si `total == 0` (aunque tampoco haya ventas: el primer motivo que ve el dueño es que faltan gastos), `null` con `'SIN_VENTAS'` si hay gastos y `unidadesVendidas == 0`. Alternativa descartada: devolver 0; contradice HU-13 criterio 5.

**D5 · Endpoints (bajo `/api/v1`, Bearer, plan FREE).**

| Método y ruta | Roles | Notas |
| --- | --- | --- |
| `GET /expenses?periodo=YYYY-MM&tipo=` | DUENIO, CONTADOR | `{ periodo, items: Gasto & { importeMes }, totales: { fijos, variables, total } }`; `periodo` default mes actual |
| `GET /expenses/summary?periodo=` | DUENIO, CONTADOR | D4; declarado antes de `:id` |
| `GET /expenses/:id` | DUENIO, CONTADOR | 404 si es de otro comercio |
| `POST /expenses` | DUENIO | 201 |
| `PATCH /expenses/:id` | DUENIO | mismas validaciones; `fin: null` quita el fin |
| `DELETE /expenses/:id` | DUENIO | 204, borrado físico |

EMPLEADO recibe 403 por `@Roles('DUENIO', 'CONTADOR')` en el controlador. Módulos NestJS afectados: nuevo `expenses`; `prisma` (`TENANT_MODELS` suma `Gasto`). Se toca `packages/shared` y el contrato OpenAPI.

**D6 · Esquemas compartidos.**
`TIPOS_GASTO`, `PERIODICIDADES`, etiquetas en español, `MesSchema` (`YYYY-MM`, mes 01–12), `GastoSchema`, `GastoCreateSchema` (concepto 2–120, importe `MontoSchema` > 0, periodo, periodicidad, fin opcional `>= periodo` sólo si periodicidad no es `UNICO`, notas ≤ 300), `GastoPatchSchema` (opcionales, al menos un campo; la coherencia periodo/fin/periodicidad se revalida en el servicio con los valores resultantes), `GastosQuerySchema` (`periodo` opcional, `tipo` opcional), `ListaGastosMesSchema`, `ResumenGastosSchema` con `MOTIVOS_RESUMEN`, `aplicaAlMes()`, `importeDelMes()`, `mesActual()`, `sumarMeses()`.

**D7 · Web.**
Ruta `/gastos` (DUENIO y CONTADOR): selector de mes (`<input type="month">` con flechas anterior/siguiente), tarjeta de resumen con tres cifras (total del mes, unidades vendidas, gasto por unidad) y el aviso "No se puede calcular el gasto por unidad: cargá los gastos del mes" o "…no hubo ventas en el mes", tabla (concepto, tipo con badge, periodicidad, importe del mes, notas) con totales al pie, botón "Nuevo gasto" y acciones editar/eliminar (con confirmación) sólo para DUENIO. `/gastos/nuevo` y `/gastos/:id` con `GastoForm` (concepto, tipo como segmentos, importe con ayuda "sin IVA", periodicidad como segmentos, mes de inicio, fin opcional visible sólo si es recurrente, notas). Enlace "Gastos" en `AppShell` y tarjeta en el inicio para DUENIO y CONTADOR; `RequireRole` en las rutas.

**D8 · Tests.**
Unit tests en `shared` de `aplicaAlMes`/`importeDelMes` (los cuatro gastos de CP-13.2, fin, doceavo, bordes de mes) y de los esquemas (CP-13.1c). e2e `expenses.e2e-spec.ts` con dos comercios y tres roles: CP-13.1 a CP-13.6, incluida la venta anulada de CP-13.3 y ventas registradas con fecha en el mes consultado (se usa un mes fijo, por ejemplo 2026-09, con `fecha` explícita en los movimientos). `rls.e2e-spec.ts` cubre `gasto` por `TENANT_MODELS`. `helpers.ts` limpia `gasto` junto con las demás tablas.

**D9 · ADR.**
No hace falta un ADR nuevo: no hay decisiones de arquitectura, sólo aplicación de patrones ya decididos (ADR 0002 para RLS). Se documenta en README, DER y endpoints.

## Risks / Trade-offs

- [Un gasto ANUAL prorrateado en doceavos no suma exactamente el importe por redondeo] → Diferencia máxima de $0,06 al año; aceptable y documentado en la ayuda del formulario.
- [Cambiar el mes de un gasto recurrente cambia meses ya "cerrados"] → Aceptado para el MVP; HU-09 (reportes emitidos) podrá congelar períodos.
- [Devoluciones no restan de las unidades vendidas] → Documentado; HU-03 puede ajustar la definición sin cambiar esta API (`unidadesVendidas` sale de una sola consulta).
- [Zona horaria en los límites del mes] → Se fija en Buenos Aires en el servicio (constante), coherente con la convención del contrato.

## Migration Plan

1. Migración `20260924_operating_expenses`: enums, tabla `gasto`, índice, `CHECK`s, RLS (bloque del runbook). Aditiva.
2. Aplicar en Neon dev, correr e2e; `prisma migrate deploy` corre en Render al desplegar `main`.
3. Rollback: `DROP TABLE gasto`, `DROP TYPE tipo_gasto, periodicidad_gasto`.

## Open Questions

- Si conviene un conjunto de conceptos sugeridos (alquiler, sueldos, servicios) como autocompletado en el formulario. No cambia specs ni tareas.
