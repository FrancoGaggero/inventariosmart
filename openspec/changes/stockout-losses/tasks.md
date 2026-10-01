## 1. Shared

- [x] 1.1 `packages/shared/src/quiebres.ts` con `tramosSinStock`, `diasConStock` y `estimarPerdida` (D3) y sus esquemas; exportado desde `index.ts`. Listo cuando: los unitarios de RN-14 cubren un quiebre cerrado, uno en curso, varios en el período, el recorte de un quiebre que empezó antes, la venta anulada que vuelve el stock (CP-18.1 a CP-18.1d), la demanda de CP-18.2 (`2.0`, `10.0`, `10000.00`, `4000.00`) y los dos casos de `SIN_HISTORIAL` (CP-18.2b)
- [x] 1.2 Funcionalidad `quiebres` "Pérdidas por falta de stock" en `FUNCIONALIDADES` con plan PRO, y el bloque `quiebres` (nullable) en `DashboardSchema`. Listo cuando: el test de `planes.ts` cuenta 13 funcionalidades, `pnpm --filter @inventariosmart/shared build` compila y `pnpm typecheck` pasa

## 2. Base de datos

- [x] 2.1 Migración `20261004_stockout_losses` con el índice `movimiento (comercio_id, creado_en)` y el `@@index` en el schema de Prisma (D2). Listo cuando: `prisma migrate deploy` la aplica en la base de desarrollo y `prisma migrate diff` no muestra diferencias con el schema

## 3. API

- [x] 3.1 `StockoutsService` con la reconstrucción en tres consultas (D2), período y ventana (D4), orden, totales y cursor de posición (D5). Listo cuando: los e2e de CP-18.1 a CP-18.1d, CP-18.2, CP-18.2b, CP-18.3, CP-18.3b y CP-18.3d pasan
- [x] 3.2 `StockoutsController` (`GET /stockouts`) con `@RequierePlan('PRO')`, `@Roles('DUENIO', 'CONTADOR')`, validación de `dias` y DTOs Swagger; `StockoutsModule` en `AppModule`. Listo cuando: CP-18.3c, CP-18.4, CP-18.4b y CP-18.4c pasan
- [x] 3.3 Bloque `quiebres` en `DashboardService` (D7). Listo cuando: CP-18.7 pasa (igual a los totales de `/stockouts?dias=30`, `null` en FREE, independiente de `periodo`) y el resto de `dashboard.e2e-spec.ts` sigue pasando
- [x] 3.4 Ruta `quiebres: '/api/v1/stockouts'` en el mapa `RUTA` de `plans.e2e-spec.ts`. Listo cuando: CP-14.2 y CP-14.3 pasan con la funcionalidad nueva
- [ ] 3.5 Prueba de carga CP-18.5 (5.000 productos, 50.000 movimientos, 500 con quiebres) en el estilo de las existentes. Listo cuando: pasa en CI en menos de 3 s y CP-04.3 sigue pasando con el bloque nuevo
- [x] 3.6 Regenerar contrato y cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene `/stockouts` y el bloque `quiebres` del panel, y CI no reporta contrato desactualizado

## 4. Web

- [x] 4.1 `lib/quiebres-formato.ts` con test y `lib/quiebres.ts` (D8). Listo cuando: el test de los textos pasa sin variables de entorno, como en CI
- [x] 4.2 `QuiebresPage` en `/quiebres` con KPI, selector de período, tabla, "Ver más", explicación y aviso de plan. Listo cuando: CP-18.6 y CP-18.6b se ven en el arnés de vista previa y la página no desborda a 360, 768 y 1280 px en los dos temas
- [x] 4.3 Tarjeta "Perdiste por falta de stock" en el panel y enlace en Alertas. Listo cuando: la tarjeta aparece sólo con pérdida mayor a cero y lleva a `/quiebres`, y el enlace de Alertas se ve en los dos temas

## 5. Documentación y cierre

- [x] 5.1 ADR 0020, README (ruta de HU-18), `docs/arquitectura.html`, `openspec/CAPACIDADES.md` y RN-14, HU-18 y RF-19 en el contexto de `openspec/config.yaml`. Listo cuando: los documentos reflejan D1 a D8
- [ ] 5.2 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, e2e de la API; push y CI en verde. Listo cuando: el run de CI del commit final tiene los dos jobs en verde
- [ ] 5.3 Producción: Franco deja un producto de la demo en 0 con un ajuste, lo repone después, y abre "Falta de stock". Listo cuando: el quiebre figura con sus días y la cifra coincide con lo que da RN-14 sobre los movimientos de la base de producción
- [ ] 5.4 (manual, Franco) Sumar HU-18, RF-19 y RN-14 a la Propuesta, el backlog y el Gantt, y crear la tarjeta en Trello. Listo cuando: los cuatro documentos coinciden
