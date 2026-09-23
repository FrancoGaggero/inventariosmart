# excel-import Specification

## Purpose
Importación del inventario desde una planilla Excel o CSV con vista previa validada, conteos y cancelación antes de confirmar, creación de productos con su stock inicial y actualización de existentes, dentro de un onboarding guiado (HU-05, RF-08, RN-05, RN-03).

## Requirements

### Requirement: Vista previa de la planilla
El sistema SHALL aceptar del DUENIO un archivo `.xlsx` o `.csv` de hasta 5.000 filas y 2 MB con columnas de código, nombre y precio de venta obligatorias y costo, stock inicial, stock de seguridad, categoría y alícuota opcionales, SHALL validar cada fila con las mismas reglas del alta de producto y SHALL devolver cada fila clasificada como `NUEVO`, `ACTUALIZA` (el código ya existe y está activo) o `INVALIDA` con el error por campo, más un resumen con los conteos y si la importación superaría el límite de productos del plan; nada se registra en este paso (HU-05 criterios 1, 2 y 3).

#### Scenario: CP-05.1 Planilla válida con productos nuevos y existentes
- **GIVEN** un comercio con el producto `FA-220` activo y una planilla con las filas `FA-220 | Filtro Aire | 3990 | 2400 | 10 | 5 | Filtros | 21`, `AM-1L | Aceite Mineral 1L | 1240 | 880 | 8 | 10 | Lubricantes |` y `BI-09 | Bujía | 950 | 500 | 0 | 2 | |`
- **WHEN** el DUENIO envía la planilla a `POST /api/v1/import/preview`
- **THEN** la API responde 200 con `FA-220` como `ACTUALIZA`, `AM-1L` y `BI-09` como `NUEVO` (con `alicuotaIva` igual a la del comercio cuando falta) y `resumen: { total: 3, nuevos: 2, actualizan: 1, invalidas: 0, superaLimite: false }`, y el catálogo no cambió

#### Scenario: CP-05.2 Errores detectados antes de confirmar
- **GIVEN** una planilla con una fila sin nombre, otra con precio negativo, otra con stock "diez", otra con el código de un producto dado de baja y dos filas con el mismo código
- **WHEN** solicita la vista previa
- **THEN** cada una figura como `INVALIDA` con un `error` que nombra el campo o el motivo ("El nombre debe tener al menos 2 caracteres", "reactivalo", "código repetido: se usa la fila N"), la fila repetida posterior queda válida, y `resumen.invalidas` las cuenta

#### Scenario: CP-05.2b Encabezados y formatos flexibles
- **GIVEN** una planilla `.xlsx` con encabezados "Código", "Descripción", "Precio de venta", "Costo neto", "Stock inicial", "Stock mínimo", "Rubro", "IVA %" y precios escritos como `3.990,00`
- **WHEN** solicita la vista previa
- **THEN** las columnas se reconocen y los montos se interpretan (`precioVenta: "3990.00"`)

#### Scenario: CP-05.2c Archivo inválido
- **GIVEN** un DUENIO
- **WHEN** sube un archivo que no es `.xlsx` ni `.csv`, o sin las columnas de código, nombre y precio, o de más de 5.000 filas
- **THEN** la API responde 400 `VALIDACION` con un mensaje que explica el problema

#### Scenario: CP-05.3 Conteo y límite del plan
- **GIVEN** un comercio FREE con 45 productos activos y una planilla con 10 productos nuevos válidos
- **WHEN** solicita la vista previa
- **THEN** `resumen.nuevos: 10`, `resumen.productosResultantes: 55` y `resumen.superaLimite: true`; la respuesta sigue siendo 200 para que el dueño decida

### Requirement: Confirmación transaccional
El sistema SHALL aplicar las filas confirmadas en una sola operación: crear los productos nuevos con su stock inicial registrado como `INGRESO` de motivo `STOCK_INICIAL`, actualizar en los existentes nombre, precio, costo, categoría, alícuota y stock de seguridad sin tocar el stock actual, y responder con los conteos; si el comercio supera el límite de productos del plan la API SHALL responder 402 `PLAN_REQUERIDO` sin aplicar nada, y si alguna fila resulta inválida al confirmar (por ejemplo un código creado entre la vista previa y la confirmación por otro usuario) SHALL aplicar igual las demás e informarla (HU-05 criterio 4, RN-05, RN-07).

#### Scenario: CP-05.4 Los datos quedan cargados
- **GIVEN** la vista previa del escenario CP-05.1
- **WHEN** el DUENIO envía las tres filas a `POST /api/v1/import/commit`
- **THEN** la API responde 201 con `{ creados: 2, actualizados: 1, omitidos: 0 }`; `AM-1L` existe con `stockActual: 8` y un `INGRESO` `STOCK_INICIAL` de 8; `BI-09` existe con stock 0 y sin movimientos; `FA-220` tiene precio 3990 y stock de seguridad 5 pero su `stockActual` no cambió

#### Scenario: CP-05.4b Reimportar la misma planilla no duplica
- **GIVEN** la importación anterior
- **WHEN** vuelve a confirmar las mismas filas
- **THEN** responde 201 con `{ creados: 0, actualizados: 3, omitidos: 0 }` y no hay movimientos nuevos

#### Scenario: CP-05.4c Límite del plan al confirmar
- **GIVEN** el comercio FREE del escenario CP-05.3
- **WHEN** confirma las 10 filas
- **THEN** la API responde 402 `{ code: "PLAN_REQUERIDO", details: { planMinimo: "PRO" } }` y no se crea ningún producto; con plan PRO la misma confirmación responde 201 con `creados: 10`

#### Scenario: CP-05.4d Fila que dejó de ser válida
- **GIVEN** una confirmación con una fila cuyo código pertenece ahora a un producto dado de baja
- **WHEN** confirma
- **THEN** las demás filas se aplican y la respuesta informa `omitidos: 1` con el código y el motivo en `detalles`

### Requirement: Onboarding guiado
La interfaz web SHALL ofrecer, al terminar de nombrar el comercio, la opción de importar el inventario desde Excel o cargarlo a mano, y SHALL guiar la importación en tres pasos con la plantilla descargable, la vista previa con errores y conteos, la posibilidad de cancelar en cualquier paso y el resultado final; el mismo asistente SHALL estar disponible desde Inventario (HU-05 criterios 3 y 5).

#### Scenario: CP-05.5 Asistente completo
- **GIVEN** un DUENIO recién registrado que acaba de nombrar su comercio
- **WHEN** elige "Importar desde Excel", descarga la plantilla, la completa con 3 productos, la sube, revisa la vista previa y confirma
- **THEN** ve en cada paso cuántos productos se van a crear y un botón para cancelar, y al terminar ve "3 productos creados" con un enlace a Inventario donde figuran los tres

#### Scenario: CP-05.5b Cancelar no deja rastro
- **GIVEN** una vista previa con productos nuevos
- **WHEN** el DUENIO cancela
- **THEN** vuelve al inicio o a Inventario y el catálogo no cambió

### Requirement: Permisos y aislamiento de la importación
El sistema SHALL permitir importar sólo al DUENIO (EMPLEADO y CONTADOR reciben 403 `SIN_PERMISO`) y SHALL crear y actualizar productos únicamente en el comercio del usuario, comparando los códigos sólo contra su propio catálogo (RNF-10).

#### Scenario: CP-05.6 Roles y aislamiento
- **GIVEN** un EMPLEADO, un CONTADOR y dos comercios A y B con el mismo código `FA-220`
- **WHEN** el EMPLEADO y el CONTADOR piden una vista previa, y el DUENIO de A importa una planilla con `FA-220`
- **THEN** los dos primeros reciben 403, la vista previa de A clasifica `FA-220` como `ACTUALIZA` (el de A) y el `FA-220` de B no cambia
