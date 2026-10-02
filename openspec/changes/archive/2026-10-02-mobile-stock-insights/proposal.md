## Why

ADR 0024 fijó que al celular van las consultas rápidas que se hacen paradas en el local. Las tres primeras de esa lista ya existen en la API y en la web, pero la app no las muestra:
- **qué hay que reponer** (HU-06, RF-06);
- **cuánto se perdió por quedarse sin stock** (HU-18, RF-19);
- **cuánta plata hay parada en productos que no se venden** (HU-19, RF-20).

Hoy el inicio de la app sólo muestra "Sin stock" y "Stock bajo", e ignora los bloques `alertas.reposicion`, `quiebres` y `stockParado` que el panel ya devuelve. La pestaña "Más", armada en `mobile-redesign` para alojar estas pantallas, está vacía.

Es la **Fase 2** del backlog llevada al celular. No cambia la API, la base ni el contrato OpenAPI: usa `GET /alerts`, `PATCH /alerts/:id`, `GET /stockouts`, `GET /dead-stock` y `GET /dashboard` tal como están.

## What Changes

- **Sección "Análisis" en "Más"**, filtrada por rol y plan como en la web:
  - "Alertas de reposición" para DUENIO y CONTADOR en cualquier plan;
  - "Falta de stock" y "Stock parado" para DUENIO y CONTADOR con plan PRO o superior;
  - el EMPLEADO no ve la sección, porque las tres consultas responden 403 para su rol.
- **Pantalla "Alertas de reposición":**
  - frase de resumen y filtro Activas / Pospuestas / Todas;
  - cada alerta muestra producto, stock y mínimo, ventas por día, cobertura ("se agota hoy", "N días", "sin ventas") con su severidad, proveedor con su lead time y cantidad sugerida;
  - acciones del DUENIO: "Registrar ingreso", que abre Movimiento con el producto y el tipo Ingreso ya elegidos, "Atendida" y "Posponer 7 días";
  - "Cargar más" para paginar;
  - el CONTADOR sólo consulta.
- **Pantalla "Falta de stock":**
  - período de 30, 60 o 90 días;
  - frase y tres indicadores: ganancia perdida, ventas perdidas y productos afectados;
  - por producto, días sin stock, lo que vendía por día, unidades y ganancia perdidas, "Sin stock ahora" y "Sin historial suficiente" cuando no se estima (RN-14);
  - la explicación de cómo se estima.
- **Pantalla "Stock parado":**
  - período de 30, 60, 90 o 180 días;
  - frase y tres indicadores: plata parada, qué parte del stock es y productos;
  - por producto, stock, costo, última venta o "Nunca se vendió", días sin vender y plata parada (RN-15);
  - las ideas para liberar esa plata.
- **Inicio más completo** con los bloques que el panel ya trae:
  - tarjetas "Perdiste por falta de stock" y "Plata parada en stock", sólo si el monto es mayor a cero y con acceso a su pantalla;
  - bloque "Reposición" con hasta cinco productos, su cobertura y cuánto pedir, y "Ver alertas";
  - en FREE, el inicio avisa que las alertas predictivas son del plan PRO.
- **Plan FREE:** las pantallas del plan PRO no consultan la API y muestran qué ofrecen y que el plan se cambia desde la web. Si la API igual responde 402, se muestra su mensaje.
- **Movimiento** acepta el tipo precargado, por ejemplo Ingreso desde una alerta.

### Fuera de alcance

- **"Generar orden" desde las alertas:** llega con `mobile-orders`, junto con las órdenes.
- **"Recalcular ahora":** la API ya recalcula al consultar si el último cálculo tiene más de una hora.
- **Configurar el umbral de alerta por producto:** se edita desde la web hasta `mobile-orders`, que suma la edición de un producto.
- **Notificaciones push.**
- **Estados "Atendidas" y "Resueltas" por separado:** quedan dentro de "Todas".
- Cambios en la API, la web y el contrato.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `mobile-app`: suma tres requisitos: "Alertas de reposición en el celular", "Falta de stock y stock parado en el celular" y "Análisis en el inicio". Modifica "Pestaña Más" para que muestre la sección "Análisis" según el rol y el plan. Las reglas (RN-04, RN-14 y RN-15), los permisos y los planes son los que ya fijan `restock-alerts`, `stockout-losses`, `dead-stock` y `financial-dashboard`; la app sólo los muestra.

## Impact

- **Mobile (`apps/mobile`):**
  - **Modelos nuevos** en `lib/core/modelos/`: alerta, quiebres y stock parado.
  - **El panel:** `dashboard.dart` suma `reposicion`, `quiebres` y `stockParado`, los tres opcionales.
  - **Errores:** `ApiException.esPlanRequerido`.
  - **Plan:** helpers en `Me`, como `planCumple` y `vePro`.
  - **Formato:** `formato.dart` suma pesos sin centavos y días con un decimal.
  - **Pantallas nuevas:** `lib/features/alertas/`, `lib/features/quiebres/` y `lib/features/stock_parado/`, con sus providers.
  - **Navegación:** `features/mas/secciones.dart` suma la sección "Análisis", y `app/router.dart` suma tres rutas con permiso por rol y plan.
  - **Inicio y movimiento:** `features/inicio/inicio_screen.dart` suma los bloques nuevos, y `features/movimientos/` acepta `?tipo=`.
- **Tests:** las fixtures y los widget tests de las tres pantallas, del inicio, de "Más" y del router.
- **Docs:** `docs/arquitectura.html` (la tabla web/mobile y la nota de la app), `apps/mobile/README.md` y `openspec/CAPACIDADES.md`.
- Sin cambios en la API, la base, el contrato OpenAPI ni la web.
