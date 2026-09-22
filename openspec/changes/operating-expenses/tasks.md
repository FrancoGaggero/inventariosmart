## 1. Contrato compartido y modelo de datos

- [x] 1.1 Agregar en `packages/shared` `gastos.ts`: `TIPOS_GASTO`, `PERIODICIDADES`, etiquetas, `MesSchema`, `GastoSchema`, `GastoCreateSchema`, `GastoPatchSchema`, `GastosQuerySchema`, `ListaGastosMesSchema`, `ResumenGastosSchema`, `MOTIVOS_RESUMEN`, `aplicaAlMes()`, `importeDelMes()`, `mesActual()`, `sumarMeses()`, con tests unitarios. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con los cuatro gastos de CP-13.2, el fin de CP-13.2b y la validación de CP-13.1c
- [x] 1.2 Modelo `Gasto` y enums en `schema.prisma` (D1); migración `20260924_operating_expenses` con índice, `CHECK`s y RLS; `Gasto` en `TENANT_MODELS`; `helpers.ts` limpia `gasto`; `rls.e2e-spec.ts` lo mapea. Listo cuando: `prisma migrate deploy` aplica en Neon dev y `rls.e2e-spec.ts` pasa incluyendo `gasto` (CP-13.6b)

## 2. API · módulo expenses

- [x] 2.1 `ExpensesService`: `crear()`, `obtener()`, `actualizar()` (revalida periodo/fin/periodicidad con los valores resultantes), `eliminar()`, `listarMes(periodo, tipo)` (filtro SQL por `periodo <= mes` y `fin`, `aplicaAlMes` en memoria, totales). Listo cuando: CP-13.1, CP-13.1b, CP-13.1c, CP-13.2, CP-13.2b y CP-13.2c pasan
- [x] 2.2 `resumen(periodo)` (D3, D4): unidades vendidas del mes en Buenos Aires sobre `movimiento` (VENTA no anuladas), totales y `gastoPorUnidad` o `null` con motivo. Listo cuando: CP-13.3, CP-13.5 y CP-13.5b pasan
- [x] 2.3 `ExpensesController` con `@Roles('DUENIO', 'CONTADOR')` en lectura y `@Roles('DUENIO')` en escritura, `summary` antes de `:id`, DTOs Swagger, 204 en `DELETE`, respuestas 400/401/403/404. Listo cuando: CP-13.4 y CP-13.6 pasan y `expenses.e2e-spec.ts` pasa completo junto con las suites existentes
- [x] 2.4 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene las seis rutas de D5 y CI no reporta contrato desactualizado

## 3. Web · gastos

- [ ] 3.1 Cliente de datos `lib/gastos.ts`: `useGastosMes(periodo, tipo)`, `useResumenGastos(periodo)`, `useGasto(id)`, mutaciones crear/editar/eliminar con invalidación. Listo cuando: crear, editar o eliminar un gasto refresca la tabla, los totales y el resumen sin recargar
- [ ] 3.2 Página `/gastos` (D7): selector de mes con flechas, tarjeta de resumen con el aviso de no calculable, tabla con badges y totales, "Nuevo gasto" y acciones sólo DUENIO. Listo cuando: CONTADOR ve tabla y resumen sin botones; un mes sin gastos muestra el aviso "cargá los gastos del mes" y con gastos pero sin ventas el de "no hubo ventas"
- [ ] 3.3 `GastoForm` en `/gastos/nuevo` y `/gastos/:id`: segmentos de tipo y periodicidad, importe con ayuda "sin IVA", mes de inicio, fin opcional sólo si es recurrente, notas; validación con `shared`, errores por campo desde `details`. Listo cuando: un fin anterior al período muestra el error junto al campo y al guardar el gasto aparece en el mes elegido
- [ ] 3.4 Enlace "Gastos" en `AppShell` y tarjeta en el inicio para DUENIO y CONTADOR; `RequireRole(['DUENIO', 'CONTADOR'])` en `/gastos` y `RequireRole(['DUENIO'])` en las rutas de escritura. Listo cuando: EMPLEADO no ve el enlace y, si escribe `/gastos`, ve "No tenés permiso"

## 4. Documentación y cierre

- [x] 4.1 README (rutas de HU-13 y formato `YYYY-MM`), `docs/arquitectura.html` (§5 DER: `Gasto` con las columnas de D1; §6 endpoints de `expenses`; RN-02 con la implementación del resumen), `openspec/CAPACIDADES.md`. Listo cuando: los documentos reflejan D1 a D5
- [ ] 4.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API en verde local; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 4.3 Desplegar y verificar en producción: migración aplicada en Neon production, cargar un gasto real desde la web publicada y ver el resumen del mes con las ventas ya registradas. Listo cuando: el gasto aparece en `https://inventariosmart0.vercel.app/gastos` y el resumen muestra el gasto por unidad
- [ ] 4.4 (manual, Franco) Mover HU-13 a Hecho en Trello, actualizar `Backlog_InventarioSmart_v2.xlsx` y la tarea correspondiente del Gantt. Listo cuando: Trello, backlog y Gantt coinciden
