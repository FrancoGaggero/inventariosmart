## Purpose
Remarcación asistida de precios (HU-17, RF-18): el dueño elige un criterio, revisa en una vista previa el precio nuevo de cada producto con su margen, lo aplica en lote en una sola operación y puede deshacerlo (RN-12). Disponible desde el plan PRO.

## ADDED Requirements

### Requirement: Vista previa de remarcación por criterio
El sistema SHALL calcular, sin modificar ningún dato, el precio de venta nuevo de los productos activos elegidos (por lista de productos, por estado frente a la inflación o todos) según uno de cuatro criterios: `INFLACION` (precio sugerido para alcanzar la inflación del período, HU-15), `MARGEN` (precio sugerido para sostener el margen bruto del inicio del período), `PORCENTAJE` (precio actual × (1 + porcentaje ÷ 100)) y `MARGEN_OBJETIVO` (precio neto = costo de reposición ÷ (1 − margen ÷ 100), llevado a precio con IVA según la alícuota del producto, RN-01 y RN-03). SHALL informar por producto el precio actual, el precio nuevo, la variación porcentual, el margen bruto porcentual actual y el nuevo, y el resultado: `SUBE`, `BAJA`, `SIN_CAMBIO` o `SIN_DATOS` cuando el criterio no se puede calcular; y un resumen con la cantidad de cada resultado.

#### Scenario: CP-17.1 Alcanzar la inflación
- **GIVEN** un comercio PRO con `A` (precio 1000 en enero y 1100 hoy, costo 720, IVA 21 %), `B` (2000 en enero y 2600 hoy) y `C` (1000 en enero y 1210 hoy), y un IPC que subió 20 % entre enero y junio
- **WHEN** el DUENIO envía `POST /api/v1/repricing/preview` con `{ "criterio": "INFLACION", "desde": "2026-01", "hasta": "2026-06" }`
- **THEN** `A` tiene `precioActual: "1100.00"`, `precioNuevo: "1200.00"`, `variacion: "9.09"`, `margenBrutoPctActual: "20.80"`, `margenBrutoPctNuevo: "27.40"` y `resultado: "SUBE"`; `B` y `C` tienen `resultado: "SIN_CAMBIO"` con `precioNuevo` igual al actual; `resumen` es `{ suben: 1, bajan: 0, sinCambio: 2, sinDatos: 0 }`; ningún precio cambia

#### Scenario: CP-17.1b Porcentaje fijo con redondeo
- **GIVEN** los productos anteriores
- **WHEN** el DUENIO pide la vista previa con `{ "criterio": "PORCENTAJE", "porcentaje": 15, "redondeo": "DECENA" }`
- **THEN** `A` pasa de `"1100.00"` a `"1270.00"`, `B` de `"2600.00"` a `"2990.00"` y `C` de `"1210.00"` a `"1400.00"`, los tres con `resultado: "SUBE"`

#### Scenario: CP-17.1c Margen objetivo
- **GIVEN** `A` con costo 720 e IVA 21 %, y `D` con costo de reposición 0
- **WHEN** el DUENIO pide la vista previa con `{ "criterio": "MARGEN_OBJETIVO", "margen": 40, "redondeo": "CENTENA" }`
- **THEN** `A` tiene `precioNuevo: "1500.00"` (neto 1200, con IVA 1452, redondeado a la centena) y `margenBrutoPctNuevo: "41.92"`; `D` tiene `resultado: "SIN_DATOS"` y `precioNuevo: null`

#### Scenario: CP-17.1d Elegir productos por estado
- **GIVEN** los productos de CP-17.1, con `A` atrasado, `C` alineado y `B` adelantado
- **WHEN** el DUENIO pide la vista previa con criterio `INFLACION` y `{ "estado": "ATRASADO" }`
- **THEN** la respuesta sólo incluye a `A`

#### Scenario: CP-17.1e Parámetros inválidos
- **WHEN** el DUENIO pide la vista previa con criterio `PORCENTAJE` sin porcentaje, con porcentaje mayor a 500, con `MARGEN_OBJETIVO` y margen 100, o con un criterio desconocido
- **THEN** la API responde 400 `VALIDACION` con `details` por campo

### Requirement: Redondeo y protección contra bajas
El sistema SHALL redondear el precio nuevo hacia arriba según el redondeo pedido: `NINGUNO` (dos decimales), `PESO`, `DECENA` o `CENTENA`. Un precio nuevo menor o igual al actual SHALL informarse como `SIN_CAMBIO` y conservar el precio actual, salvo que el dueño indique `permitirBajas: true`, caso en el que se informa como `BAJA` con el precio calculado (RN-12).

#### Scenario: CP-17.2 No se bajan precios sin pedirlo
- **GIVEN** `B` con precio 2600 y precio sugerido por inflación 2400
- **WHEN** el DUENIO pide la vista previa con criterio `INFLACION`, primero sin `permitirBajas` y después con `permitirBajas: true`
- **THEN** la primera vez `B` tiene `resultado: "SIN_CAMBIO"` y `precioNuevo: "2600.00"`; la segunda, `resultado: "BAJA"`, `precioNuevo: "2400.00"` y `variacion: "-7.69"`

#### Scenario: CP-17.2b Redondeos
- **WHEN** se redondea el precio 1452,30 con cada redondeo
- **THEN** `NINGUNO` da `"1452.30"`, `PESO` `"1453.00"`, `DECENA` `"1460.00"` y `CENTENA` `"1500.00"`; un precio que ya es múltiplo (1500) no cambia

### Requirement: Aplicación atómica de la remarcación
El sistema SHALL permitir al DUENIO aplicar una remarcación enviando, por producto, el precio actual que vio y el precio nuevo, que puede haber ajustado a mano. SHALL verificar que cada producto esté activo, que su precio actual coincida con el enviado y que el precio nuevo sea un monto mayor a cero y distinto del actual; si alguna verificación falla SHALL no aplicar ningún cambio e informar los productos afectados. Si todas pasan, SHALL actualizar los precios en una sola transacción, registrar cada cambio en el historial de precios con origen `REMARCACION` y crear un lote con el criterio, sus parámetros, el usuario, la fecha y el precio anterior y nuevo de cada producto (RN-12).

#### Scenario: CP-17.3 Aplicar la vista previa
- **GIVEN** la vista previa de CP-17.1b
- **WHEN** el DUENIO envía `POST /api/v1/repricing/apply` con el criterio, sus parámetros y los tres productos con sus precios
- **THEN** la respuesta es 201 con el lote (`cantidad: 3`, `criterio: "PORCENTAJE"`, `revertidoEn: null`); los productos quedan con precio `"1270.00"`, `"2990.00"` y `"1400.00"`; y el historial de precios de cada uno suma una fila con origen `REMARCACION`

#### Scenario: CP-17.3b Un precio cambió desde la vista previa
- **GIVEN** la vista previa de tres productos y el precio de `B` editado después a 2700
- **WHEN** el DUENIO aplica la remarcación
- **THEN** la API responde 409 `CONFLICTO` con `details.productos` que incluye a `B` con su precio actual, y ningún producto cambia de precio

#### Scenario: CP-17.3c Datos inválidos
- **WHEN** el DUENIO aplica una remarcación sin productos, con un producto repetido, con precio nuevo 0 o igual al actual, con un producto dado de baja o con más de 5.000 productos
- **THEN** la API responde 400 `VALIDACION` con `details` por campo; con un producto de otro comercio responde 404 `NO_ENCONTRADO`; y en ningún caso cambia un precio

### Requirement: Lotes de remarcación y deshacer
El sistema SHALL listar las remarcaciones del comercio de la más reciente a la más antigua, paginadas por cursor, con criterio, parámetros, usuario, fecha, cantidad de productos y estado, y SHALL exponer el detalle con el precio anterior y nuevo de cada producto. El DUENIO SHALL poder deshacer una remarcación una sola vez: los productos cuyo precio sigue siendo el remarcado vuelven al precio anterior, con su fila en el historial de precios; los que cambiaron después SHALL no tocarse e informarse como omitidos (RN-12).

#### Scenario: CP-17.4 Listado y detalle
- **GIVEN** la remarcación de CP-17.3
- **WHEN** el DUENIO consulta `GET /api/v1/repricing/batches` y el detalle del lote
- **THEN** el listado la muestra primera con `cantidad: 3` y el nombre de quien la hizo, y el detalle trae los tres productos con `precioAnterior` y `precioNuevo`

#### Scenario: CP-17.4b Deshacer
- **GIVEN** el lote de CP-17.3 y el precio de `C` editado después a 1450
- **WHEN** el DUENIO envía `POST /api/v1/repricing/batches/:id/revert`
- **THEN** la respuesta es 200 con `revertidos: 2`, `omitidos: 1` (el producto `C`) y `revertidoEn`; `A` vuelve a `"1100.00"` y `B` a `"2600.00"`; `C` sigue en `"1450.00"`; y el historial de `A` y `B` suma una fila con origen `REMARCACION`

#### Scenario: CP-17.4c No se deshace dos veces
- **GIVEN** un lote ya revertido
- **WHEN** el DUENIO intenta deshacerlo de nuevo
- **THEN** la API responde 409 `CONFLICTO` y ningún precio cambia

### Requirement: Plan, permisos y aislamiento de la remarcación
La remarcación SHALL requerir plan PRO o superior: en plan FREE todas las rutas responden 402 `PLAN_REQUERIDO`. El DUENIO SHALL ver la vista previa, aplicar, listar y deshacer; el CONTADOR SHALL sólo ver la vista previa y los lotes; el EMPLEADO SHALL recibir 403 `SIN_PERMISO` en todas. Un comercio SHALL ver y operar únicamente sus productos y sus lotes (RNF-10).

#### Scenario: CP-17.5 Plan FREE
- **GIVEN** un comercio en plan FREE
- **WHEN** el DUENIO pide una vista previa o el listado de lotes
- **THEN** la API responde 402 `PLAN_REQUERIDO`

#### Scenario: CP-17.5b Roles
- **GIVEN** un comercio PRO con un lote
- **WHEN** el CONTADOR pide una vista previa, lista los lotes e intenta aplicar y deshacer, y el EMPLEADO pide una vista previa
- **THEN** el CONTADOR obtiene 200 en las dos primeras y 403 `SIN_PERMISO` en las otras dos; el EMPLEADO obtiene 403 `SIN_PERMISO`

#### Scenario: CP-17.5c Aislamiento
- **GIVEN** dos comercios PRO con productos y lotes
- **WHEN** el dueño de uno lista los lotes, consulta o deshace un lote del otro
- **THEN** sólo ve los propios y las operaciones sobre el lote ajeno responden 404 `NO_ENCONTRADO`

### Requirement: Remarcación en la web
La web SHALL ofrecer en "Precios e inflación" el botón "Remarcar", que abre el asistente con los productos atrasados elegidos y el criterio de inflación del período que se estaba mirando. El asistente SHALL permitir cambiar el criterio, sus parámetros y el redondeo, quitar productos, ajustar a mano el precio nuevo de cada uno, y SHALL mostrar antes de aplicar cuántos productos suben, el precio actual y el nuevo de cada uno y el margen antes y después. Aplicar SHALL pedir confirmación. La página "Remarcaciones" SHALL listar los lotes y permitir deshacerlos, también con confirmación.

#### Scenario: CP-17.6 Del diagnóstico a la remarcación
- **GIVEN** la página "Precios e inflación" con productos atrasados
- **WHEN** el DUENIO toca "Remarcar", revisa la vista previa, ajusta un precio a mano y confirma
- **THEN** ve cuántos productos se remarcaron, los precios quedan actualizados en Inventario y el lote aparece en "Remarcaciones" con la opción de deshacer

#### Scenario: CP-17.6b El contador sólo mira
- **GIVEN** un CONTADOR en el asistente
- **WHEN** revisa una vista previa
- **THEN** ve los precios calculados y no tiene el botón de aplicar ni el de deshacer
