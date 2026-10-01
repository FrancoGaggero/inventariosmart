## Why

Las alertas de reposición (HU-06) avisan **antes** de que un producto se agote, pero el sistema no dice nada sobre lo que ya pasó. Cuando un producto estuvo sin stock, el comercio dejó de vender y no lo ve en ningún lado: el panel muestra cuántos productos están hoy en cero, no cuánta plata costó. Poner un monto en pesos a esos quiebres es el argumento más directo para que el dueño use las alertas y las órdenes de compra, y es un diferencial del producto frente a una planilla. Es la idea que quedó en cola al cerrar el backlog. Esta change crea la historia **HU-18 "Cuánto pierdo por quedarme sin stock"** (nuevo **RF-19**; RN-01, RN-03; nueva **RN-14**), de la **Fase 2** y del plan **PRO**, igual que las alertas.

## What Changes

- **RN-14 (nueva)**:
  - Un **quiebre** es el tiempo en que un producto activo estuvo con stock 0. Empieza con el movimiento que lo dejó en cero y termina con el siguiente que lo repuso, o sigue **en curso** si todavía está en cero.
  - La **demanda diaria estimada** es lo que el producto vendió en los días en que **tuvo** stock dentro de los últimos 90 días, dividido por esos días.
  - Las **unidades perdidas** se calculan como días sin stock por demanda diaria. La **venta perdida** son esas unidades por el precio neto vigente (RN-03), y la **ganancia perdida**, esas unidades por el margen bruto unitario vigente (RN-01).
  - Si el producto tuvo stock menos de 7 días o no vendió nada en esos 90 días, la pérdida es "no calculable" y no se estima.
- **API**: `GET /api/v1/stockouts?dias=30|60|90` (30 por defecto) devuelve los totales del período y los productos con quiebres, ordenados por ganancia perdida, con paginación por cursor. Totales: ganancia perdida, venta perdida, unidades perdidas, productos afectados y quiebres en curso. Por producto: cantidad de quiebres, días sin stock, si sigue en curso, inicio del último quiebre, demanda diaria, unidades, venta y ganancia perdidas, o el motivo por el que no se calcula.
- **Panel**: `GET /dashboard` suma `quiebres` (ganancia perdida y productos afectados de los últimos 30 días), que vale `null` si el plan no incluye la funcionalidad. La web muestra una tarjeta "Perdiste por falta de stock" que enlaza a la página nueva.
- **Planes**: el catálogo de funcionalidades suma "Pérdidas por falta de stock" en PRO. La página Plan y la portada lo muestran sin cambios propios.
- **Web**: página `/quiebres` "Falta de stock":
  - tarjetas con los totales y un selector de 30, 60 o 90 días;
  - tabla de productos con días sin stock, una marca "Sin stock ahora" si el quiebre sigue en curso, unidades y ganancia perdidas, y un enlace a la alerta del producto;
  - texto que explica en una línea cómo se estima.

  Se llega desde el panel y desde la página de Alertas; no suma un ítem a la navegación, que ya tiene catorce.
- Contrato OpenAPI y cliente TS regenerados.

### Fuera de alcance

- Una consulta del asistente sobre quiebres: queda para otra change, que reutilizaría el mismo servicio.
- Incluir los quiebres en el reporte semanal por correo (HU-09).
- Estacionalidad o tendencia en la demanda estimada: se usa un promedio simple, explicado en pantalla.
- Productos que nunca tuvieron stock: sin un período con stock no hay de dónde estimar demanda, así que no aparecen.
- Cambios en la app móvil.

## Capabilities

### New Capabilities

- `stockout-losses`: detección de quiebres de stock a partir del historial de movimientos y estimación de la venta y la ganancia perdidas (RN-14), por API y en la web.

### Modified Capabilities

- `financial-dashboard`: el panel suma el bloque `quiebres` con la ganancia perdida de los últimos 30 días.
- `subscription-plans`: el catálogo de funcionalidades suma "Pérdidas por falta de stock" en el plan PRO.

## Impact

- **API**: módulo nuevo `stockouts` (servicio, controller y DTOs), `dashboard.service.ts` (bloque nuevo) y `AppModule`.
- **Shared**: `packages/shared/src/quiebres.ts` con los esquemas y las funciones puras de RN-14 (intervalos sin stock, demanda, pérdidas); `planes.ts` suma la funcionalidad; `dashboard.ts` suma el bloque.
- **Base de datos**: sin tablas nuevas. Todo sale de `movimiento.stock_resultante`, que ya registra el stock después de cada operación. Una migración sólo agrega el índice `movimiento (comercio_id, creado_en)` para leer los últimos 90 días en el orden en que cambió el stock. Las consultas corren con la extensión de tenant y RLS existentes.
- **Web**: `features/quiebres/QuiebresPage.tsx`, `lib/quiebres.ts` y `lib/quiebres-formato.ts`, una tarjeta en el panel, un enlace en Alertas y la ruta.
- **Tests**: unitarios de RN-14 en shared, e2e de la API por cada criterio de aceptación (incluidos aislamiento, roles y plan), el e2e de planes con la ruta nueva y una prueba de carga.
- **Documentos de Franco**: HU-18, RF-19 y RN-14 hay que sumarlos a la Propuesta, el backlog, el Gantt y Trello.
