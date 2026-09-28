## Why

La Propuesta dice que InventarioSmart está "diseñado específicamente para el contexto inflacionario argentino" (§2.6, RNF-08), pero hoy nada del producto es específico de vender con inflación: stock, márgenes, alertas, órdenes y reportes los ofrece cualquier sistema de gestión. El comerciante entrevistado señaló como mayor cuello de botella actualizar precios y recalcular márgenes, y el 79,2 % de los encuestados no conoce su margen real. La pregunta que ningún competidor de la tabla de mercado responde es: **¿mis precios le están ganando o perdiendo a la inflación y a mis costos?**

Esta change incorpora datos públicos oficiales (INDEC y Banco Central, por sus APIs abiertas) y los cruza con los precios y costos del comercio. Es el diferencial que Franco pidió trabajar, a partir de la sugerencia de la cátedra de usar una API del Estado.

Cubre una historia nueva, **HU-15 "Mis precios frente a la inflación"** (RF-16 nuevo; RNF-08; RN-01, RN-08 y la nueva **RN-11**), en la **Fase 2**; plan mínimo **PRO** para la comparación, indicadores sueltos disponibles en todos los planes. Es la decimoquinta capacidad de `openspec/CAPACIDADES.md`.

## What Changes

- **Indicadores económicos oficiales**: la API consulta el IPC nacional (nivel general y bienes, mensual) en la API de Series de Tiempo de datos.gob.ar (fuente INDEC) y la inflación mensual e interanual y el tipo de cambio minorista en la API de estadísticas del BCRA, los guarda en una tabla de referencia y los expone en `GET /indicators`. Se actualizan una vez por día y bajo demanda; si la fuente no responde, se sirve el último dato guardado marcado como desactualizado.
- **Historial de precios de venta**: cada alta, edición o importación que cambia el precio de un producto deja una fila de sólo inserción con el precio y su fecha. La migración reconstruye el pasado con los precios distintos observados en las ventas ya registradas más el precio actual.
- **RN-11 (nueva)**: variación real = ((1 + variación nominal) ÷ (1 + variación del IPC del mismo período) − 1) × 100. Un precio está **atrasado** si su variación real es menor a −2 %, **adelantado** si supera +2 % y **alineado** en el medio.
- **Comparación "mis precios frente a la inflación"** en `GET /insights/inflation`: series mensuales en índice base 100 de mis precios y mis costos (canasta fija ponderada por las unidades vendidas en el período) junto al IPC general y de bienes; variación de cada serie y brechas en términos reales; y por producto, variación de precio y de costo, estado (atrasado, alineado, adelantado) y dos precios sugeridos: el que alcanza la inflación y el que sostiene el margen bruto del inicio del período.
- **Web**: página "Precios e inflación" (`/inflacion`) con un gráfico de líneas propio en SVG, tarjetas de variación y brecha, tabla de productos con estado y precios sugeridos y selector de período (3, 6 y 12 meses); tarjeta "Contexto" en Inicio con inflación del mes, interanual, dólar y stock valorizado en dólares; enlace en la navegación.
- **Contrato**: shared, OpenAPI y cliente regenerados; migración `20260929_inflation_insights`.

Supuestos registrados:
- **Precios Claros / SEPA queda fuera**: el servicio de consulta respondió con error 500 y timeout en las pruebas del 28/09/2026, los datos abiertos son archivos diarios de unos 12 millones de filas y sólo cubren grandes supermercados; no aporta a rubros como el lubricentro de la demo.
- **El IPC se publica con un mes de rezago**: la comparación llega hasta el último mes con IPC publicado y lo informa.
- **Canasta fija**: el índice propio pondera por las unidades vendidas en todo el período consultado; los productos sin ventas en el período no entran al índice pero sí a la tabla.
- **Costos**: historial de `precio_proveedor` del proveedor principal; sin historial, el costo vigente se considera constante.
- **Precios sugeridos son informativos**: aplicar la remarcación en lote es una change posterior.
- **Backlog**: HU-15, RF-16 y RN-11 son altas nuevas que Franco debe sumar al backlog y a la Propuesta.

## Capabilities

### New Capabilities

- `inflation-insights`: indicadores económicos oficiales (IPC, inflación, tipo de cambio) con caché y tolerancia a fallos, historial de precios de venta, comparación de precios y costos propios contra la inflación en índice base 100 con variación real (RN-11), estado por producto y precios sugeridos, plan y permisos.

### Modified Capabilities

Ninguna: el panel de HU-04 no cambia su contrato (la tarjeta "Contexto" de Inicio consume `GET /indicators` y calcula el stock en dólares en la web); el catálogo de HU-01 no cambia su respuesta.

## Impact

- **Código:** `apps/api` módulos nuevos `indicators` (fuentes INDEC y BCRA con `fetch` y timeout, servicio con caché, cron, controller) e `insights` (servicio de comparación, controller, DTOs); `products` e `import` registran el historial de precios; `packages/shared` `inflacion.ts` (RN-11, índices base 100, estado, precios sugeridos, esquemas); `packages/api-client` regenerado; `apps/web` `lib/inflacion.ts`, `features/inflacion/InflacionPage.tsx`, `ui/GraficoLineas.tsx`, tarjeta en `HomePage`, enlace en `AppShell`.
- **Base de datos:** migración con `indicador_economico` e `indicador_actualizacion` (tablas de referencia globales, sin `comercio_id`, sólo lectura para `app_api` fuera del contexto de sistema) y `precio_venta_historial` (por comercio, sólo inserción, RLS), más el relleno inicial del historial.
- **Servicios externos:** `apis.datos.gob.ar` y `api.bcra.gob.ar`, públicos y sin credenciales; variables opcionales `INDEC_API_URL` y `BCRA_API_URL` para apuntar a otro host.
- **Documentación:** ADR 0014 (datos públicos oficiales con caché y tolerancia a fallos; índice propio de canasta fija; RN-11), README, `docs/arquitectura.html` (§6 `indicators` e `insights`, RN-11), `docs/runbooks/rls.md` (tabla de referencia sin tenant), `openspec/config.yaml` (HU-15, RN-11), `openspec/CAPACIDADES.md`.
- **Trazabilidad:** CU-15, casos CP-15.1 a CP-15.6.
- **Fuera de alcance:** Precios Claros / SEPA, remarcación en lote, inflación por rubro elegido por el usuario, proyección de inflación futura, dólar paralelo o financiero, envío por WhatsApp (change aparte), app Android.
