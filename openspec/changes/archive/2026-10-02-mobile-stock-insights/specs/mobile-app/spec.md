## ADDED Requirements

### Requirement: Alertas de reposición en el celular

La app SHALL mostrar al DUENIO y al CONTADOR las alertas de reposición del comercio (HU-06, RN-04), con los mismos datos que la web: producto, stock y stock de seguridad, ventas por día, cobertura y severidad, proveedor y lead time, y cantidad sugerida. La lista SHALL filtrarse por Activas, Pospuestas o Todas y paginarse con "Cargar más". El DUENIO SHALL poder marcar una alerta como atendida, posponerla 7 días o ir a registrar el ingreso del producto. El CONTADOR SHALL sólo consultar. En plan FREE la app SHALL explicar que las alertas son del plan PRO sin consultar la API.

#### Scenario: CP-M.9 Alertas activas (CP-06.2)
- **GIVEN** un comercio PRO con un producto que se agota antes de que llegue la reposición
- **WHEN** el dueño abre "Más" y toca "Alertas de reposición"
- **THEN** ve la frase de resumen y la alerta con el stock, el mínimo, las ventas por día, la cobertura con su severidad ("Crítica" o "Próxima al quiebre"), el proveedor con su lead time y la cantidad sugerida

#### Scenario: CP-M.9b Atender y posponer (CP-06.5)
- **GIVEN** el dueño en la lista de alertas activas
- **WHEN** toca "Atendida" en una alerta y "Posponer 7 días" en otra
- **THEN** la app avisa "{producto}: alerta atendida." y "{producto}: alerta pospuesta 7 días.", y las dos dejan de figurar entre las activas

#### Scenario: CP-M.9c Registrar el ingreso desde una alerta
- **GIVEN** el dueño en la lista de alertas
- **WHEN** toca "Registrar ingreso" en una alerta
- **THEN** se abre Registrar movimiento con el tipo Ingreso y ese producto ya elegidos

#### Scenario: CP-M.9d El contador sólo consulta (CP-06.6b)
- **GIVEN** un CONTADOR de un comercio PRO
- **WHEN** abre las alertas
- **THEN** ve la lista sin los botones "Atendida", "Posponer 7 días" ni "Registrar ingreso"

#### Scenario: CP-M.9e Sin alertas
- **GIVEN** un comercio PRO sin productos por reponer
- **WHEN** el dueño abre las alertas activas
- **THEN** ve "No hay productos por reponer." y la explicación de que el cálculo usa las ventas de los últimos 30 días y el lead time del proveedor principal

#### Scenario: CP-M.9f Plan FREE (CP-06.6)
- **GIVEN** un comercio en plan FREE
- **WHEN** el dueño abre "Alertas de reposición"
- **THEN** ve que las alertas predictivas son del plan PRO y que el plan se cambia desde la web, y la app no consulta las alertas

#### Scenario: CP-M.9g Error del servidor al atender
- **GIVEN** una alerta que otra persona ya cerró desde la web
- **WHEN** el dueño toca "Atendida"
- **THEN** la app muestra el mensaje en español que devolvió la API y vuelve a cargar la lista

### Requirement: Falta de stock y stock parado en el celular

La app SHALL mostrar al DUENIO y al CONTADOR de un comercio PRO o PREMIUM cuánto se dejó de ganar por quedarse sin stock (HU-18, RN-14), en los últimos 30, 60 o 90 días, y cuánta plata hay en productos sin ventas (HU-19, RN-15), en 30, 60, 90 o 180 días, con los mismos totales y productos que la web. Las pérdidas SHALL presentarse como estimación, y un producto sin historial suficiente SHALL mostrarse sin cifra. Los montos SHALL ser sin IVA.

#### Scenario: CP-M.10 Pérdidas del período (CP-18.6)
- **GIVEN** un comercio PRO con un producto que estuvo 5 días sin stock y vendía 2 por día con $ 400 de margen
- **WHEN** el dueño abre "Falta de stock"
- **THEN** ve "Ganancia perdida $ 4.000", las ventas perdidas, los productos afectados y el producto con "5,0 días" sin stock, "Sin stock ahora" si sigue así, y la explicación de que es una estimación

#### Scenario: CP-M.10b Cambio de período
- **WHEN** en "Falta de stock" elige "Últimos 90 días", o en "Stock parado" elige "180 días"
- **THEN** la pantalla consulta ese período y muestra sus totales

#### Scenario: CP-M.10c Producto sin historial (CP-18.2b)
- **GIVEN** un producto con menos de 7 días con stock en los últimos 90
- **WHEN** aparece en "Falta de stock"
- **THEN** en lugar de la ganancia perdida dice "Sin historial suficiente"

#### Scenario: CP-M.10d Plata parada (CP-19.5)
- **GIVEN** un comercio PRO con 10 unidades a $ 2.100 de costo sin ventas hace 120 días
- **WHEN** el dueño abre "Stock parado" con el período de 90 días
- **THEN** ve "Plata parada $ 21.000", qué parte del stock es, la cantidad de productos y el producto con su stock, su costo, la última venta y "120 días" sin vender, y las ideas para liberar esa plata

#### Scenario: CP-M.10e Nunca se vendió
- **GIVEN** un producto parado que nunca tuvo ventas
- **WHEN** aparece en "Stock parado"
- **THEN** dice "Nunca se vendió" en lugar de la fecha de la última venta

#### Scenario: CP-M.10f Sin datos en el período (CP-18.3d)
- **WHEN** el período elegido no tiene quiebres o no tiene stock parado
- **THEN** la pantalla lo dice con "No te quedaste sin stock en este período." o "No tenés stock parado en este período.", sin cifras

#### Scenario: CP-M.10g Plan FREE (CP-18.4, CP-19.3)
- **GIVEN** un comercio en plan FREE
- **WHEN** el dueño abre "Más"
- **THEN** no aparecen "Falta de stock" ni "Stock parado"; si llega a esas pantallas igual, ve que son del plan PRO y la app no consulta la API

#### Scenario: CP-M.10h Aislamiento por comercio (CP-18.4c, CP-19.3c)
- **GIVEN** dos comercios PRO con productos distintos
- **WHEN** cada dueño abre "Falta de stock" y "Stock parado"
- **THEN** ve sólo los productos de su comercio, porque las consultas se hacen con su identidad y sin parámetros de comercio

### Requirement: Análisis en el inicio

El inicio del DUENIO y del CONTADOR SHALL mostrar, con los datos que ya trae el panel (HU-04), la ganancia perdida por falta de stock de los últimos 30 días, la plata parada en productos sin ventas en 90 días y hasta cinco productos por reponer. Cada bloque SHALL llevar a su pantalla. En plan FREE el inicio SHALL avisar que las alertas predictivas son del plan PRO y no SHALL mostrar las tarjetas de pérdidas ni de plata parada.

#### Scenario: CP-M.11 Tarjetas de análisis
- **GIVEN** un comercio PRO con $ 4.000 de ganancia perdida y $ 21.000 parados
- **WHEN** el dueño abre el inicio
- **THEN** ve "Perdiste por falta de stock $ 4.000" y "Plata parada en stock $ 21.000", y al tocar cada una llega a su pantalla

#### Scenario: CP-M.11b Montos en cero
- **GIVEN** un comercio PRO sin quiebres ni stock parado
- **WHEN** abre el inicio
- **THEN** no aparecen esas dos tarjetas

#### Scenario: CP-M.11c Reposición en el inicio (CP-06.3)
- **GIVEN** un comercio PRO con tres productos por reponer, uno crítico
- **WHEN** el dueño abre el inicio
- **THEN** el bloque "Reposición" lista los tres con su cobertura y "pedir N", dice "3 productos por reponer en total, 1 crítico." y "Ver alertas" lleva a la pantalla de alertas

#### Scenario: CP-M.11d Inicio en plan FREE
- **GIVEN** un comercio en plan FREE
- **WHEN** el dueño abre el inicio
- **THEN** el bloque "Reposición" avisa que las alertas predictivas son del plan PRO, y no aparecen las tarjetas de pérdidas ni de plata parada

## MODIFIED Requirements

### Requirement: Pestaña Más

La barra inferior SHALL terminar en una pestaña "Más" para todos los roles. La pestaña SHALL mostrar la cuenta (comercio, email, rol y plan), la elección de tema y "Cerrar sesión", y SHALL aclarar qué tareas se hacen desde la web. Las pestañas de negocio SHALL seguir dependiendo del rol, como hasta ahora (CP-M.2e, CP-M.3d, CP-M.4g). Para el DUENIO y el CONTADOR, "Más" SHALL mostrar además una sección "Análisis" con "Alertas de reposición" en cualquier plan, y con "Falta de stock" y "Stock parado" desde el plan PRO. El EMPLEADO no SHALL ver esa sección.

#### Scenario: CP-M.8 Pestañas del dueño
- **GIVEN** un usuario DUENIO
- **WHEN** entra a la app
- **THEN** la barra inferior muestra Inicio, Inventario, Movimiento y Más, en ese orden

#### Scenario: CP-M.8b Pestañas del empleado y del contador
- **GIVEN** un usuario EMPLEADO y otro CONTADOR
- **WHEN** cada uno entra a la app
- **THEN** el empleado ve Inventario, Movimiento y Más; el contador ve Inicio y Más, sin inventario ni movimientos

#### Scenario: CP-M.8c La cuenta en "Más"
- **GIVEN** la dueña de "Repuestos Carlos" con plan PRO
- **WHEN** toca "Más"
- **THEN** ve el nombre del comercio, su email, "Dueño" y "Pro"

#### Scenario: CP-M.8d Lo que se hace desde la web
- **WHEN** un usuario abre "Más"
- **THEN** ve que importar planillas, proveedores y listas de precios, gastos, remarcación, usuarios y planes se manejan desde la web, con la dirección de la web

#### Scenario: CP-M.8e La cuenta es la de quien inició sesión
- **GIVEN** dos comercios distintos con sus usuarios
- **WHEN** cada usuario abre "Más"
- **THEN** ve sólo su comercio, su email, su rol y su plan, tomados de su propia identidad (CP-11.5)

#### Scenario: CP-M.8f Sección "Análisis" por rol y plan (CP-11.4)
- **GIVEN** un DUENIO y un CONTADOR de un comercio PRO, un DUENIO de un comercio FREE y un EMPLEADO
- **WHEN** cada uno abre "Más"
- **THEN** el dueño y el contador PRO ven "Alertas de reposición", "Falta de stock" y "Stock parado"; el dueño FREE ve sólo "Alertas de reposición"; el empleado no ve la sección "Análisis" y, si llega a una de esas pantallas, la app lo devuelve a su inicio
