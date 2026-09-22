## Why

Hoy el stock de un producto se fija al crearlo y después no cambia: la web dice "el stock se ajusta con movimientos" pero no hay forma de registrar una venta, un ingreso de mercadería ni una corrección. Sin movimientos no existe la fuente de datos de la velocidad de venta (RN-04), de los indicadores de venta del dashboard (HU-04) ni de las unidades vendidas del período que necesita el margen neto (RN-02). Esta change cierra ese hueco con la entidad que el resto de la Fase 1 consume.

Cubre **HU-10** (RF-13, RF-02) en la **Fase 1 – MVP**, con las reglas RN-07 (los movimientos no se eliminan ni modifican; una corrección es un AJUSTE que referencia al original) y la regla de stock nunca negativo que HU-10 fija como criterio ("impide registrar una venta por una cantidad superior al stock disponible"). Es la cuarta capacidad del mapa de `openspec/CAPACIDADES.md`.

## What Changes

- **Entidad Movimiento**, inmutable: tipo (`VENTA`, `INGRESO`, `AJUSTE`), producto, cantidad, efecto sobre el stock, stock resultante, fecha, motivo, observación, usuario que lo registró y referencia al movimiento que corrige. Migración con RLS según el checklist del runbook y restricción `stock_actual >= 0` en `producto`.
- **Stock consistente**: cada movimiento actualiza `producto.stock_actual` en la misma transacción, con bloqueo de la fila del producto; una venta o un ajuste negativo mayor al stock disponible se rechaza con 409.
- **API** `GET /api/v1/movements` (historial global o por producto, filtros por tipo y rango de fechas, cursor), `GET /api/v1/movements/:id`, `POST /api/v1/movements` (con `Idempotency-Key` opcional para no duplicar una venta ante un reintento) y `POST /api/v1/movements/:id/anular` (crea el AJUSTE inverso que referencia al original; no borra nada).
- **Stock inicial como movimiento**: `POST /products` con `stockInicial > 0` registra un `INGRESO` con motivo `STOCK_INICIAL` en la misma transacción, para que el histórico de todo producto empiece en su primer movimiento. Los productos ya existentes con stock reciben ese movimiento retroactivo en la migración.
- **Aviso de stock bajo**: la respuesta de cada movimiento trae el `estadoStock` resultante del producto; la web lo muestra al confirmar ("Quedan 3 unidades, por debajo del stock de seguridad") y el inicio muestra cuántos productos están en `BAJO` y `SIN_STOCK`. Las alertas predictivas y por correo siguen siendo HU-06 (Fase 2).
- **Web**: página Movimientos con historial filtrable y formulario rápido de registro (tipo, producto con buscador, cantidad, fecha, motivo, observación); acceso desde la fila del producto en Inventario ("Registrar movimiento", "Ver historial") y desde el inicio. Empleado registra y consulta sin ver costos; Contador sólo consulta.
- **Contrato**: `packages/shared` con esquemas de movimiento; OpenAPI y cliente regenerados.

Supuestos registrados:
- **Tipos según la Propuesta v2.0**: `VENTA`, `INGRESO` y `AJUSTE`. Un egreso que no es venta (rotura, vencimiento, robo, uso interno) se registra como `AJUSTE` negativo con su motivo; así el histórico distingue ventas reales de pérdidas, que es lo que RN-04 y el dashboard necesitan.
- **Sin costos en el movimiento**: el costo vigente vive en `producto.costo_reposicion` y HU-02 lo mantiene (RN-08: al cambiar el costo, los márgenes se recalculan). La `VENTA` sí guarda el **precio unitario de venta** vigente al momento (con IVA, como el precio del producto), porque HU-04 necesita el importe vendido del período y ese dato no se puede reconstruir después. No es un campo sensible para el Empleado.
- **La fecha del movimiento es editable hacia atrás** (cargar las ventas del día a la noche o del fin de semana el lunes), nunca hacia adelante. Por defecto es el momento del registro.
- **No hay plan mínimo**: FREE registra movimientos sin límite; es la operación diaria del comercio.

## Capabilities

### New Capabilities

- `stock-movements`: registro inmutable de ventas, ingresos y ajustes por producto, actualización transaccional del stock sin negativos, anulación por ajuste inverso, historial filtrable con paginación por cursor, idempotencia del registro y aviso de stock bajo resultante.

### Modified Capabilities

Ninguna. El registro del stock inicial como movimiento `INGRESO` se especifica como requisito de `stock-movements` (es comportamiento del historial, no del catálogo) y no cambia ningún escenario de `product-catalog`; los permisos de `user-roles` aplican tal cual (DUENIO y EMPLEADO registran, CONTADOR sólo lectura). Prerrequisito: `product-catalog` archivada antes de aplicar esta change.

## Impact

- **Código:** `apps/api` nuevo módulo `movements`; `ProductsService.crear()` registra el ingreso inicial; `TENANT_MODELS` y migración con RLS; `packages/shared` esquemas de movimiento; `packages/api-client` regenerado; `apps/web` página de movimientos, formulario, accesos desde inventario e inicio.
- **Base de datos:** tabla `movimiento` con índices `(comercio_id, fecha desc, id desc)` y `(comercio_id, producto_id, fecha desc)`, índice único parcial `(comercio_id, clave_idempotencia)`, políticas RLS, `CHECK (stock_actual >= 0)` en `producto`, sin `UPDATE`/`DELETE` para el rol `app_api` sobre `movimiento` (la inmutabilidad también la garantiza la base). Migración aditiva más un backfill de los productos con stock.
- **Trazabilidad:** CU-10, casos de prueba CP-10.1 a CP-10.6, más aislamiento, roles e idempotencia.
- **Fuera de alcance:** costos en movimientos y valorización del stock (HU-02/HU-03), velocidad de venta y punto de reposición (HU-06, RN-04, se calculan sobre este histórico), alertas por correo (HU-06), ventas con varios productos o comprobantes (no está en la Propuesta), importación masiva de movimientos (HU-05 importa productos), edición o borrado de movimientos (RN-07), pantallas mobile (`mobile-mvp`), job de consistencia stock vs. histórico (queda anotado en design como candidato para HU-04).
