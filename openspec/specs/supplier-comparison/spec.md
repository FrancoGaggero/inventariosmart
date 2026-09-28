# supplier-comparison Specification

## Purpose
Comparador de precios entre proveedores (HU-12, RF-12): para cada insumo, el sistema compara el costo vigente de todos los proveedores que lo venden, los puntúa por precio, plazo de entrega y confiabilidad (RN-13) y recomienda a quién comprarle. Disponible en el plan PREMIUM.

## Requirements

### Requirement: Comparación de proveedores de un insumo
El sistema SHALL devolver en `GET /api/v1/products/:id/supplier-comparison`, para un producto del comercio, todos los proveedores activos con al menos un costo cargado para ese producto, tomando de cada uno sólo su costo más reciente, con: costo neto vigente y desde cuándo rige, plazo de entrega, confiabilidad, diferencia porcentual contra el costo más bajo, si es el proveedor principal del producto, los tres componentes del puntaje y el puntaje total. Los proveedores SHALL venir ordenados de mayor a menor puntaje, y la respuesta SHALL indicar el proveedor recomendado, el más barato y el principal actual (RN-08).

#### Scenario: CP-12.1 Tres proveedores para un insumo
- **GIVEN** un comercio PREMIUM con `FA-220`, cuyo proveedor principal es "Norte", y los costos vigentes "Norte" 2340 (plazo 5 días, confiabilidad 3), "Sur" 2000 (plazo 7, confiabilidad 4) y "Este" 2100 (plazo 2, confiabilidad 5)
- **WHEN** el DUENIO consulta `GET /api/v1/products/:id/supplier-comparison`
- **THEN** obtiene tres proveedores en el orden "Este", "Sur", "Norte"; "Este" con `costoNeto: "2100.00"`, `diferenciaPct: "5.00"` y `puntaje: "97.14"`; "Sur" con `diferenciaPct: "0.00"` y `puntaje: "81.38"`; "Norte" con `diferenciaPct: "17.00"`, `esPrincipal: true` y `puntaje: "72.78"`; `recomendado` es "Este", `masBarato` es "Sur" y `principal` es "Norte"

#### Scenario: CP-12.1b Un solo proveedor o ninguno
- **GIVEN** `AM-1L` con precio cargado sólo por "Norte" (confiabilidad 3) y `BI-09` sin ningún precio cargado
- **WHEN** el DUENIO consulta la comparación de cada uno
- **THEN** `AM-1L` trae un proveedor con `puntaje: "94.00"` (precio 100, plazo 100, confiabilidad 60), `recomendado` "Norte" y `comparable: false`; `BI-09` trae la lista vacía, `recomendado: null` y `comparable: false`

#### Scenario: CP-12.1c Sólo cuenta el último costo de los proveedores activos
- **GIVEN** `FA-220` con dos costos de "Sur" (2200 primero y 2000 después) y un costo de "Oeste", que está dado de baja
- **WHEN** el DUENIO consulta la comparación
- **THEN** "Sur" figura una sola vez con `costoNeto: "2000.00"` y "Oeste" no figura

### Requirement: Puntaje del proveedor
El sistema SHALL calcular el puntaje de cada proveedor para un insumo según RN-13: 0,60 × precio + 0,25 × plazo + 0,15 × confiabilidad, con dos decimales, donde precio = 100 × costo mínimo ÷ costo, plazo = 100 × (plazo mínimo + 1) ÷ (plazo + 1) y confiabilidad = 100 × confiabilidad ÷ 5, tomando los mínimos entre los proveedores comparados. El recomendado SHALL ser el de mayor puntaje; ante un empate, el de menor costo, luego el de menor plazo, luego el de mayor confiabilidad y por último el primero por nombre.

#### Scenario: CP-12.2 Componentes del puntaje
- **GIVEN** los proveedores de CP-12.1
- **WHEN** se calcula el puntaje
- **THEN** "Norte" tiene precio `"85.47"`, plazo `"50.00"` y confiabilidad `"60.00"`; "Sur" tiene `"100.00"`, `"37.50"` y `"80.00"`; "Este" tiene `"95.24"`, `"100.00"` y `"100.00"`

#### Scenario: CP-12.2b Entrega en el día y empates
- **GIVEN** un insumo con "A" (costo 1000, plazo 0, confiabilidad 3) y "B" (costo 900, plazo 3, confiabilidad 3), y otro con "C" y "D" idénticos en costo, plazo y confiabilidad
- **WHEN** se calcula el puntaje
- **THEN** en el primero "A" obtiene `"88.00"` y "B" `"75.25"`, y el recomendado es "A"; en el segundo los dos obtienen el mismo puntaje y el recomendado es "C"

### Requirement: Resumen de insumos con proveedor recomendado
El sistema SHALL listar en `GET /api/v1/supplier-comparison` los productos activos con dos o más proveedores comparables, paginados por cursor y ordenados por ahorro estimado de mayor a menor, con: producto, cantidad de proveedores, proveedor recomendado con su costo y puntaje, proveedor principal actual con su costo, si conviene cambiar (`cambiaProveedor`) y el ahorro mensual estimado, igual a (costo del principal − costo del recomendado) × unidades vendidas en los últimos 30 días cuando es positivo. Con `soloOportunidades=true` SHALL incluir únicamente los productos cuyo recomendado no es su proveedor principal. El resumen SHALL informar también el total de insumos comparables, cuántos conviene cambiar y la suma del ahorro estimado.

#### Scenario: CP-12.3 Resumen y oportunidades
- **GIVEN** `FA-220` de CP-12.1 con 60 unidades vendidas en los últimos 30 días, `AC-5L` con dos proveedores cuyo recomendado ya es su principal, y `AM-1L` con un solo proveedor
- **WHEN** el DUENIO consulta `GET /api/v1/supplier-comparison` y luego `?soloOportunidades=true`
- **THEN** la primera respuesta trae `FA-220` y `AC-5L` y no trae `AM-1L`; `FA-220` tiene `recomendado` "Este", `principal` "Norte", `cambiaProveedor: true` y `ahorroEstimado: "14400.00"`; `totales` es `{ comparables: 2, conCambio: 1, ahorroEstimado: "14400.00" }`; la segunda respuesta sólo trae `FA-220`

#### Scenario: CP-12.3b Sin proveedor principal o sin ventas
- **GIVEN** un producto con dos proveedores y sin proveedor principal, y otro con principal distinto del recomendado y sin ventas en 30 días
- **WHEN** el DUENIO consulta el resumen
- **THEN** los dos figuran con `cambiaProveedor: true` y `ahorroEstimado: null`

### Requirement: Comparación siempre al día
El sistema SHALL calcular la comparación en el momento de la consulta con los costos vigentes, sin almacenar puntajes, de modo que cargar o importar una lista de precios, cambiar el plazo o la confiabilidad de un proveedor o darlo de baja se refleje en la consulta siguiente.

#### Scenario: CP-12.4 Una lista importada cambia el recomendado
- **GIVEN** la comparación de CP-12.1
- **WHEN** el DUENIO importa una lista de "Norte" con `FA-220` a 1700 y vuelve a consultar
- **THEN** "Norte" pasa a `costoNeto: "1700.00"`, `diferenciaPct: "0.00"` y `puntaje: "81.50"`; "Este" queda con `puntaje: "88.57"` y sigue siendo el recomendado; "Sur" baja a `"72.38"`; y `masBarato` pasa a ser "Norte"

#### Scenario: CP-12.4b Cambios en el proveedor
- **GIVEN** la comparación de CP-12.1
- **WHEN** el DUENIO da de baja a "Este" y vuelve a consultar
- **THEN** la comparación trae sólo "Sur" y "Norte", recalcula los puntajes entre ellos y recomienda a "Sur"

### Requirement: Plan, permisos y aislamiento del comparador
El comparador SHALL requerir plan PREMIUM: en los planes FREE y PRO sus rutas responden 402 `PLAN_REQUERIDO` con `planMinimo: "PREMIUM"`. Sólo el DUENIO SHALL consultarlo; el CONTADOR y el EMPLEADO SHALL recibir 403 `SIN_PERMISO`, igual que en proveedores y costos (CP-02.7). Un comercio SHALL ver únicamente sus productos, proveedores y costos (RNF-10).

#### Scenario: CP-12.5 Planes FREE y PRO
- **GIVEN** un comercio FREE y otro PRO
- **WHEN** sus dueños consultan el resumen o la comparación de un producto
- **THEN** la API responde 402 `PLAN_REQUERIDO` con `details.planMinimo: "PREMIUM"`

#### Scenario: CP-12.5b Roles
- **GIVEN** un comercio PREMIUM
- **WHEN** el CONTADOR y el EMPLEADO consultan el resumen
- **THEN** los dos obtienen 403 `SIN_PERMISO`

#### Scenario: CP-12.5c Aislamiento
- **GIVEN** dos comercios PREMIUM con productos, proveedores y costos
- **WHEN** el dueño de uno consulta el resumen y la comparación de un producto del otro
- **THEN** el resumen sólo trae sus productos y la comparación ajena responde 404 `NO_ENCONTRADO`

### Requirement: Comparador en la web
La web SHALL ofrecer la página "Comparador" desde Proveedores, con los totales en lenguaje claro, el filtro "Sólo los que conviene cambiar" y la lista de insumos con su proveedor recomendado, el principal actual y el ahorro estimado. El detalle de un insumo SHALL mostrar cada proveedor con su costo, plazo, confiabilidad, diferencia contra el más barato y una barra con el puntaje y sus tres componentes, marcando el recomendado y el principal, explicar cómo se calcula el puntaje, y permitir al DUENIO "Usar como principal" con confirmación.

#### Scenario: CP-12.6 Comparar y cambiar de proveedor
- **GIVEN** la página "Comparador" con `FA-220` como oportunidad
- **WHEN** el DUENIO abre el detalle, ve a "Este" como recomendado y toca "Usar como principal"
- **THEN** tras confirmar, "Este" queda como proveedor principal, el costo de reposición del producto pasa a 2100 (RN-08) y `FA-220` deja de figurar entre los que conviene cambiar

#### Scenario: CP-12.6b Plan sin comparador
- **GIVEN** un DUENIO de un comercio PRO
- **WHEN** abre la página "Comparador"
- **THEN** ve el aviso de que está disponible en el plan PREMIUM y ningún dato
